/**
 * Lap time estimator — Stage 7.
 *
 * Point-mass simulation over a track defined as a sequence of corner + straight
 * segments. Uses the vehicle's current Pacejka + aero + suspension parameters.
 *
 * Algorithm per segment:
 *  Corner : V_max = iterative solve √(μ_eff × g × R) with aero grip boost
 *  Straight: forward Euler integration (dt = 0.005 s) from V_entry to V_exit
 *            under F_drive(V) − F_drag(V), bounded by braking decel to V_next_corner
 *
 * Braking zone: analytically estimated distance d = V²/(2 × a_brake),
 * then straight time is subdivided into accel and coast/brake phases.
 *
 * Reference: Milliken & Milliken RCVD App.B (Simple Lap Simulation)
 */

const G       = 9.81;
const RHO_AIR = 1.225;   // kg/m³

// ── Track definition ─────────────────────────────────────────────────────────

export interface TrackSegment {
  type:       'corner' | 'straight';
  length:     number;           // m — arc length for corners, distance for straights
  radius?:    number;           // m — corners only
  direction?: 'left' | 'right'; // corner turning direction (default: 'left')
  label?:     string;           // display name; auto-generated if omitted
}

export interface TrackLayout {
  name:     string;
  segments: TrackSegment[];
  /** Pre-computed normalized SVG path. viewBox should be "0 0 400 250" or similar.
   *  When present, TrackMapSVG uses this directly instead of buildTrackPath. */
  svgPath?: string;
  /** viewBox string matching the svgPath coordinate space, e.g. "0 0 400 250" */
  svgViewBox?: string;
  /** True for circuits whose svgPath is GPS-derived (TUMFTM or OSM).
   *  Used to switch zone overlay to GPS-curvature mode vs trace-based. */
  svgIsGps?: boolean;
  /** Attribution for the GPS data source. Shown in the UI. */
  svgSource?: 'tumftm' | 'osm';
}

export const TRACK_PRESETS: Record<string, TrackLayout> = {
  club: {
    name: 'Club circuit (~1.9 km)',
    // No svgPath — buildTrackPath() generates a physics-proportional path (zones accurate)
    // Symmetric twin-hairpin oval — closes within 3px (visually clean)
    segments: [
      { type: 'straight', length: 853, label: 'Start/Finish straight' },
      { type: 'corner',   length: 94,  radius: 30, direction: 'right', label: 'Hairpin A' },  // 180°, R=30m → 65 kph
      { type: 'straight', length: 853, label: 'Back straight'         },
      { type: 'corner',   length: 94,  radius: 30, direction: 'right', label: 'Hairpin B' },  // 180°
    ],
  },
  karting: {
    name: 'Karting circuit (~1.0 km)',
    // No svgPath — buildTrackPath() generates a physics-proportional path (zones accurate)
    // Twin-hairpin oval — closes within 3px
    segments: [
      { type: 'straight', length: 450, label: 'Main straight'  },
      { type: 'corner',   length: 25,  radius: 8,  direction: 'right', label: 'Hairpin 1' },  // 180°, R=8m → 35 kph (kart-tight)
      { type: 'straight', length: 450, label: 'Back straight'  },
      { type: 'corner',   length: 25,  radius: 8,  direction: 'right', label: 'Hairpin 2' },  // 180°
    ],
  },
  gt_circuit: {
    name: 'GT circuit (~3.2 km)',
    // No svgPath — buildTrackPath() generates a physics-proportional path (zones accurate)
    // Analytically closed: S1+S2·cos60°=S3, S2·sin60°=S4 — closes within 2px
    segments: [
      { type: 'straight', length: 887,  label: 'Start/Finish straight' },
      { type: 'corner',   length: 84,   radius: 80,  direction: 'right', label: 'Turn 1'      },  // 60°R — opening corner, R=80m → 120 kph
      { type: 'straight', length: 390                                   },
      { type: 'corner',   length: 209,  radius: 100, direction: 'right', label: 'Fast Sweeper' },  // 120°R — high-speed, R=100m → 134 kph
      { type: 'straight', length: 1059, label: 'Back straight'          },
      { type: 'corner',   length: 78,   radius: 50,  direction: 'right', label: 'Bus Stop'     },  // 90°R, R=50m → 94 kph
      { type: 'straight', length: 427                                   },
      { type: 'corner',   length: 78,   radius: 50,  direction: 'right', label: 'Return Bend'  },  // 90°R → returns to S/F
    ],
  },
  formula_test: {
    name: 'Formula test track (~2.1 km)',
    // No svgPath — buildTrackPath() generates a physics-proportional path (zones accurate)
    // Rectangular layout — closes within 1px. S1 < S3 to cancel corner arc x-displacement.
    segments: [
      { type: 'straight', length: 529,  label: 'Main straight'  },
      { type: 'corner',   length: 110,  radius: 70, direction: 'right', label: 'Turn 1'   },  // 90°R, R=70m → 103 kph
      { type: 'straight', length: 300                            },
      { type: 'corner',   length: 55,   radius: 35, direction: 'right', label: 'Turn 2'   },  // 90°R, R=35m → 73 kph — technical
      { type: 'straight', length: 600,  label: 'Back straight'  },
      { type: 'corner',   length: 55,   radius: 35, direction: 'right', label: 'Turn 3'   },  // 90°R
      { type: 'straight', length: 300                            },
      { type: 'corner',   length: 110,  radius: 70, direction: 'right', label: 'Turn 4'   },  // 90°R
    ],
  },

  // ── Real-world circuits (simplified schematic — correct corner radii & track length) ──

  monza: {
    name: 'Monza (5.793 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 137.0 186.2 L 137.3 183.7 L 137.5 181.2 L 137.7 178.6 L 138.0 176.1 L 138.2 173.6 L 138.5 171.1 L 138.7 168.6 L 139.0 166.0 L 139.2 163.5 L 139.5 161.0 L 139.8 158.5 L 140.0 155.9 L 140.3 153.4 L 140.5 150.9 L 140.7 148.4 L 141.0 145.8 L 141.2 143.3 L 141.4 140.8 L 141.7 138.3 L 141.9 135.7 L 142.1 133.2 L 142.3 130.7 L 142.5 128.2 L 142.7 125.6 L 143.0 123.1 L 143.2 120.6 L 143.4 118.0 L 143.6 115.5 L 143.8 113.0 L 144.0 110.5 L 144.2 107.9 L 144.5 105.4 L 144.7 102.9 L 144.9 100.4 L 145.1 97.8 L 145.3 95.3 L 146.0 93.1 L 147.6 92.0 L 149.3 90.9 L 149.7 88.9 L 149.1 86.4 L 148.5 83.9 L 147.8 81.5 L 147.4 79.0 L 147.1 76.5 L 147.0 74.0 L 147.1 71.4 L 147.3 68.9 L 147.5 66.4 L 147.6 63.8 L 147.8 61.3 L 148.1 58.8 L 148.6 56.3 L 149.2 53.9 L 150.2 51.5 L 151.2 49.2 L 152.5 47.0 L 153.9 44.9 L 155.6 43.0 L 157.4 41.2 L 159.3 39.6 L 161.3 38.1 L 163.5 36.7 L 165.7 35.5 L 168.0 34.5 L 170.4 33.6 L 172.8 32.9 L 175.3 32.3 L 177.8 31.8 L 180.3 31.4 L 182.8 31.1 L 185.3 30.9 L 187.8 30.7 L 190.4 30.5 L 192.9 30.3 L 195.4 30.1 L 197.9 29.9 L 200.5 29.6 L 203.0 29.4 L 205.5 29.3 L 208.1 29.1 L 210.6 29.0 L 213.1 28.9 L 215.6 28.8 L 218.2 28.6 L 220.2 27.7 L 221.6 25.8 L 223.2 24.2 L 225.5 23.5 L 228.0 23.0 L 230.4 22.3 L 232.8 21.5 L 235.2 20.7 L 237.6 19.8 L 240.0 19.0 L 242.4 18.2 L 244.8 17.4 L 247.3 16.6 L 249.7 15.8 L 252.1 15.2 L 254.6 15.0 L 257.0 15.6 L 259.0 17.0 L 260.5 19.0 L 261.3 21.3 L 261.7 23.8 L 261.9 26.3 L 262.1 28.9 L 262.4 31.4 L 262.6 33.9 L 262.9 36.4 L 263.1 39.0 L 263.3 41.5 L 263.5 44.0 L 263.3 46.5 L 262.1 48.5 L 260.1 49.9 L 257.9 51.2 L 255.7 52.4 L 253.5 53.7 L 251.3 54.9 L 249.1 56.1 L 246.9 57.4 L 244.7 58.6 L 242.4 59.9 L 240.2 61.1 L 238.0 62.3 L 235.8 63.6 L 233.6 64.8 L 231.4 66.1 L 229.3 67.5 L 227.2 68.9 L 225.2 70.5 L 223.2 72.1 L 221.3 73.8 L 219.4 75.4 L 217.5 77.1 L 215.6 78.8 L 213.7 80.5 L 211.8 82.1 L 209.9 83.8 L 208.0 85.5 L 206.1 87.2 L 204.2 88.8 L 202.3 90.5 L 200.4 92.2 L 198.5 93.8 L 196.6 95.5 L 194.7 97.2 L 192.8 98.9 L 190.8 100.5 L 188.9 102.2 L 187.0 103.9 L 185.1 105.6 L 183.2 107.2 L 181.3 108.9 L 179.4 110.6 L 177.9 112.5 L 177.3 114.7 L 177.4 117.3 L 177.4 119.8 L 176.9 122.2 L 175.9 124.5 L 174.4 126.5 L 172.5 128.2 L 171.0 130.1 L 170.2 132.5 L 169.9 135.0 L 169.6 137.5 L 169.3 140.0 L 169.0 142.5 L 168.7 145.0 L 168.4 147.6 L 168.1 150.1 L 167.8 152.6 L 167.5 155.1 L 167.2 157.6 L 167.0 160.2 L 166.7 162.7 L 166.5 165.2 L 166.2 167.7 L 166.0 170.3 L 165.7 172.8 L 165.5 175.3 L 165.2 177.8 L 165.0 180.3 L 164.7 182.9 L 164.5 185.4 L 164.2 187.9 L 163.9 190.4 L 163.7 193.0 L 163.4 195.5 L 163.2 198.0 L 162.9 200.5 L 162.7 203.1 L 162.4 205.6 L 162.2 208.1 L 161.9 210.6 L 161.7 213.2 L 161.4 215.7 L 161.2 218.2 L 160.9 220.7 L 160.7 223.2 L 160.4 225.8 L 160.0 228.3 L 159.2 230.6 L 157.7 232.6 L 155.7 234.0 L 153.3 234.9 L 150.9 234.9 L 148.4 234.3 L 146.2 233.2 L 144.1 231.8 L 142.3 230.0 L 140.8 228.0 L 139.5 225.8 L 138.5 223.5 L 137.7 221.1 L 137.2 218.6 L 136.9 216.1 L 136.7 213.6 L 136.6 211.0 L 136.6 208.5 L 136.5 206.0 L 136.5 203.4 L 136.5 200.9 L 136.4 198.4 L 136.5 195.8 L 136.5 193.3 L 136.6 190.8 L 136.8 188.2 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Monza: elongated oval-ish with chicanes on both ends.
    // Start/finish at top-left going right. Rettifilo chicane top-right.
    // Curva Grande sweeps right down. Roggia chicane. Lesmo 1+2 rightward.
    // Long back straight left. Ascari chicane. Parabolica tight hairpin bottom-left.
    segments: [
      { type: 'straight', length: 1050, label: 'Start/Finish straight'            },
      { type: 'corner',   length: 18,  radius: 55, direction: 'right', label: 'Rettifilo T1'   },  // chicane T1 — racing line R
      { type: 'straight', length: 50                                               },
      { type: 'corner',   length: 16,  radius: 45, direction: 'left',  label: 'Rettifilo T2'   },  // chicane T2 — racing line R
      { type: 'corner',   length: 371, radius: 185, direction: 'left', label: 'Curva Grande'   },  // big left sweep (~115°) — fixed for circuit closure
      { type: 'straight', length: 80                                               },
      { type: 'corner',   length: 28,  radius: 60, direction: 'right', label: 'Roggia T1'      },  // chicane T1 — racing line R
      { type: 'straight', length: 40                                               },
      { type: 'corner',   length: 25,  radius: 55, direction: 'left',  label: 'Roggia T2'      },  // chicane T2 — racing line R
      { type: 'straight', length: 220                                              },
      { type: 'corner',   length: 75,  radius: 48, direction: 'left',  label: 'Lesmo 1'        },  // medium-fast left (~90°)
      { type: 'straight', length: 155                                              },
      { type: 'corner',   length: 52,  radius: 40, direction: 'left',  label: 'Lesmo 2'        },  // (~75°)
      { type: 'straight', length: 1488, label: 'Back straight'                    },  // Serraglio / filler (-69m vs original to close circuit)
      { type: 'corner',   length: 18,  radius: 55, direction: 'right', label: 'Ascari T1'      },  // racing line R
      { type: 'straight', length: 50                                               },
      { type: 'corner',   length: 18,  radius: 50, direction: 'left',  label: 'Ascari T2'      },  // racing line R
      { type: 'straight', length: 75                                               },
      { type: 'corner',   length: 18,  radius: 55, direction: 'right', label: 'Ascari T3'      },  // racing line R
      { type: 'straight', length: 200                                               },  // short run to Parabolica
      { type: 'corner',   length: 208, radius: 48, direction: 'left',  label: 'Parabolica'     },  // long left sweep (~153°) — tightened to real racing line R
      { type: 'straight', length: 1538, label: 'Pit straight'                     },  // reduced 200m to maintain 5793m total
    ],
  },

  spa: {
    name: 'Spa-Francorchamps (7.004 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 174.6 51.7 L 172.6 48.4 L 170.6 45.2 L 168.6 42.0 L 166.6 38.8 L 164.6 35.6 L 162.5 32.4 L 160.5 29.2 L 158.5 26.0 L 156.5 22.8 L 154.5 19.5 L 153.7 16.3 L 155.9 15.0 L 159.4 16.3 L 162.8 17.8 L 166.3 19.4 L 169.7 21.0 L 173.0 22.9 L 176.2 24.9 L 179.3 27.1 L 182.3 29.3 L 185.2 31.8 L 187.8 34.5 L 190.4 37.3 L 193.0 40.1 L 195.5 42.9 L 198.1 45.7 L 200.6 48.5 L 203.2 51.3 L 205.8 54.1 L 208.5 56.7 L 211.6 58.8 L 214.8 60.7 L 217.5 63.3 L 219.5 66.5 L 220.7 70.1 L 221.5 73.8 L 222.7 77.3 L 224.6 80.6 L 226.7 83.7 L 228.9 86.8 L 231.1 89.9 L 233.2 93.0 L 235.4 96.1 L 237.6 99.2 L 239.7 102.4 L 241.5 105.7 L 242.9 109.2 L 244.2 112.7 L 245.4 116.3 L 246.6 119.9 L 247.8 123.5 L 248.9 127.1 L 250.1 130.7 L 251.3 134.3 L 252.5 137.9 L 253.7 141.5 L 254.9 145.1 L 256.1 148.7 L 257.3 152.3 L 258.5 155.9 L 259.6 159.5 L 260.8 163.1 L 262.0 166.7 L 263.2 170.3 L 264.4 173.9 L 265.6 177.5 L 266.8 181.1 L 267.9 184.7 L 268.5 188.3 L 267.2 191.6 L 264.4 194.1 L 262.9 197.3 L 263.2 201.0 L 264.3 204.6 L 265.2 208.2 L 265.2 211.9 L 263.3 215.0 L 260.4 217.3 L 257.4 219.6 L 254.4 221.9 L 251.3 224.2 L 248.3 226.5 L 245.3 228.8 L 242.3 231.1 L 239.3 233.4 L 236.0 234.9 L 232.5 234.4 L 230.0 231.8 L 229.8 228.3 L 231.9 225.4 L 235.0 223.2 L 238.2 221.2 L 241.3 219.1 L 243.9 216.5 L 244.7 213.0 L 243.8 209.4 L 242.5 205.8 L 241.1 202.3 L 239.8 198.7 L 238.6 195.1 L 237.6 191.5 L 236.8 187.8 L 235.9 184.1 L 235.1 180.4 L 234.3 176.7 L 233.5 173.0 L 232.7 169.3 L 231.8 165.6 L 230.3 162.2 L 227.8 159.4 L 224.5 157.7 L 220.8 157.1 L 217.1 157.0 L 213.3 157.3 L 209.7 158.3 L 206.5 160.2 L 203.7 162.8 L 201.7 166.0 L 200.2 169.4 L 198.9 173.0 L 197.7 176.6 L 196.4 180.1 L 195.1 183.7 L 193.8 187.3 L 192.6 190.9 L 191.3 194.4 L 190.0 198.0 L 188.3 201.3 L 185.5 203.7 L 182.0 204.5 L 178.4 203.7 L 175.0 202.1 L 171.4 201.3 L 167.8 202.2 L 165.0 204.6 L 163.0 207.8 L 161.1 211.1 L 159.2 214.3 L 157.3 217.6 L 155.4 220.9 L 153.2 223.9 L 150.0 225.3 L 146.4 224.4 L 143.2 222.5 L 140.1 220.4 L 136.9 218.3 L 134.1 215.9 L 132.2 212.7 L 131.5 209.0 L 132.0 205.3 L 133.1 201.7 L 134.4 198.2 L 136.1 194.7 L 138.0 191.5 L 140.2 188.4 L 142.7 185.5 L 145.2 182.7 L 147.8 180.0 L 150.5 177.3 L 153.4 174.9 L 156.6 172.8 L 159.9 170.9 L 163.1 169.1 L 166.4 167.2 L 169.7 165.3 L 173.0 163.4 L 176.2 161.4 L 179.1 158.9 L 181.6 156.2 L 183.9 153.1 L 185.7 149.8 L 187.2 146.4 L 188.7 142.9 L 190.1 139.3 L 191.5 135.8 L 192.8 132.3 L 193.4 128.6 L 193.0 124.8 L 191.9 121.2 L 190.4 117.7 L 188.9 114.3 L 187.4 110.8 L 185.9 107.3 L 184.5 103.8 L 183.1 100.3 L 182.0 96.7 L 181.1 93.0 L 180.5 89.2 L 180.0 85.5 L 179.6 81.7 L 179.1 78.0 L 178.7 74.2 L 179.4 71.0 L 182.4 70.0 L 184.3 68.1 L 183.0 64.9 L 181.0 61.7 L 179.0 58.5 L 176.9 55.3 L 174.9 52.1 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Spa: distinctive triangular shape.
    // S/F top-right going left. La Source hairpin top-right.
    // Eau Rouge/Raidillon: sharp dip-and-climb going down-left.
    // Kemmel straight going down-right. Les Combes chicane.
    // Pouhon left sweeper (middle-left). Fagnes/Campus chicanes.
    // Blanchimont fast right. Bus Stop chicane. Back to start.
    // Direction tags corrected: La Source is a RIGHT hairpin (not left).
    // Pouhon is a LEFT double-apex (not right). Angular sums verified: net ≈ -2π (CW circuit).
    segments: [
      { type: 'straight', length: 720,  label: 'Start/Finish straight'                                        },
      { type: 'corner',   length: 126,  radius: 40, direction: 'right', label: 'La Source'                    },  // RIGHT hairpin (180°, racing line R=40m → 66 kph)
      { type: 'straight', length: 90,   label: 'Uphill to Eau Rouge'                                          },
      { type: 'corner',   length: 31,   radius: 130, direction: 'left', label: 'Eau Rouge'                    },  // fast left — R=130m, flat-out after La Source fix
      { type: 'corner',   length: 288,  radius: 150, direction: 'right', label: 'Raidillon'                   },  // sweeping right up the hill (~110°)
      { type: 'straight', length: 700,  label: 'Kemmel Straight'                                              },
      { type: 'corner',   length: 42,   radius: 55, direction: 'left',  label: 'Les Combes T1'               },  // chicane left — racing line R
      { type: 'straight', length: 55                                                                           },
      { type: 'corner',   length: 38,   radius: 50, direction: 'right', label: 'Les Combes T2'               },  // chicane right — racing line R
      { type: 'straight', length: 550,  label: 'Malmedy approach'                                             },
      { type: 'corner',   length: 144,  radius: 55, direction: 'right', label: 'Malmedy / Rivage'            },  // right sweeper + Rivage hairpin (~150°)
      { type: 'straight', length: 340,  label: 'Pouhon approach'                                              },
      { type: 'corner',   length: 272,  radius: 130, direction: 'left', label: 'Pouhon'                       },  // LEFT double-apex (~120°) — corrected from 'right'
      { type: 'straight', length: 650,  label: 'Fagnes straight'                                              },
      { type: 'corner',   length: 47,   radius: 55, direction: 'left',  label: 'Campus T1'                   },  // chicane left — racing line R
      { type: 'straight', length: 55                                                                           },
      { type: 'corner',   length: 44,   radius: 50, direction: 'right', label: 'Campus T2'                   },  // chicane right — racing line R
      { type: 'straight', length: 1323, label: 'Stavelot straight'                                            },  // filler (reduced 176m to compensate corner arc increases)
      { type: 'corner',   length: 393,  radius: 230, direction: 'right', label: 'Blanchimont'                },  // fast right (~98°)
      { type: 'corner',   length: 18,   radius: 35, direction: 'left',  label: 'Bus Stop T1'                 },  // chicane left — racing line R
      { type: 'straight', length: 35                                                                           },
      { type: 'corner',   length: 18,   radius: 30, direction: 'right', label: 'Bus Stop T2'                 },  // chicane right — racing line R
      { type: 'straight', length: 1025, label: 'Return to La Source'                                          },  // reduced 82m to compensate La Source arc increase
    ],
  },

  silverstone: {
    name: 'Silverstone GP (5.891 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 142.8 167.3 L 144.7 164.7 L 146.6 162.1 L 148.4 159.5 L 150.3 156.9 L 152.2 154.3 L 154.0 151.7 L 155.9 149.2 L 157.8 146.6 L 159.7 144.0 L 161.5 141.4 L 163.4 138.8 L 165.3 136.2 L 167.1 133.6 L 169.0 131.0 L 170.9 128.5 L 173.2 126.5 L 176.1 125.3 L 179.3 124.9 L 182.4 124.9 L 185.6 125.0 L 188.8 125.1 L 192.0 125.4 L 195.2 125.6 L 198.4 125.5 L 201.5 125.0 L 204.5 124.0 L 207.3 122.5 L 209.9 120.6 L 212.4 118.6 L 214.8 116.5 L 217.2 114.4 L 219.6 112.4 L 222.1 110.3 L 224.5 108.2 L 227.1 106.6 L 229.8 106.6 L 231.8 108.5 L 233.1 111.5 L 234.1 114.5 L 235.1 117.5 L 236.6 120.2 L 238.8 121.0 L 241.1 119.6 L 242.7 116.9 L 243.7 113.8 L 244.6 110.8 L 245.2 107.6 L 245.5 104.5 L 245.5 101.3 L 244.7 98.3 L 242.9 95.8 L 240.6 93.7 L 238.2 91.6 L 235.7 89.5 L 233.3 87.4 L 230.9 85.3 L 228.5 83.2 L 226.1 81.2 L 223.6 79.1 L 221.2 77.0 L 218.8 74.9 L 216.4 72.8 L 213.9 70.7 L 211.5 68.7 L 209.1 66.6 L 206.7 64.5 L 204.3 62.4 L 201.8 60.3 L 199.4 58.2 L 197.0 56.2 L 194.5 54.1 L 192.1 52.0 L 189.7 50.0 L 187.2 47.9 L 184.8 45.8 L 182.3 43.9 L 179.6 42.3 L 176.5 41.6 L 173.4 41.8 L 170.7 43.2 L 169.1 45.7 L 168.5 48.8 L 168.3 51.9 L 167.9 55.1 L 166.8 58.0 L 164.8 60.3 L 162.0 61.4 L 159.0 61.0 L 156.5 59.2 L 155.0 56.6 L 154.7 53.5 L 155.5 50.5 L 156.8 47.6 L 158.1 44.7 L 159.4 41.8 L 160.8 38.9 L 162.2 36.0 L 163.8 33.3 L 165.7 30.8 L 167.9 28.4 L 170.2 26.2 L 172.7 24.2 L 175.4 22.7 L 178.4 21.7 L 181.6 21.0 L 184.7 20.5 L 187.9 20.0 L 191.0 19.6 L 194.2 19.2 L 197.4 18.8 L 200.5 18.4 L 203.7 18.0 L 206.9 17.6 L 210.1 17.2 L 213.2 16.8 L 216.4 16.5 L 219.6 16.2 L 222.8 15.8 L 225.9 15.5 L 229.1 15.2 L 232.3 15.0 L 235.4 15.3 L 238.5 16.2 L 241.4 17.5 L 243.9 19.3 L 245.8 21.8 L 247.1 24.7 L 248.2 27.7 L 249.2 30.7 L 250.1 33.8 L 250.9 36.9 L 251.7 40.0 L 252.3 43.1 L 252.9 46.3 L 253.4 49.4 L 253.8 52.6 L 254.1 55.8 L 254.4 58.9 L 254.6 62.1 L 254.8 65.3 L 255.1 68.5 L 255.3 71.7 L 255.5 74.9 L 256.0 78.0 L 256.8 81.1 L 258.0 84.0 L 259.6 86.8 L 261.1 89.6 L 261.9 92.6 L 261.5 95.7 L 260.7 98.7 L 259.7 101.8 L 258.7 104.8 L 258.1 107.9 L 257.9 111.1 L 258.5 114.2 L 259.9 117.0 L 261.8 119.6 L 263.6 122.2 L 264.7 125.1 L 264.9 128.1 L 263.9 131.1 L 262.1 133.6 L 259.7 135.7 L 257.1 137.5 L 254.3 139.2 L 251.8 141.0 L 249.5 143.3 L 247.8 145.9 L 246.3 148.7 L 244.9 151.6 L 243.4 154.4 L 242.0 157.3 L 240.5 160.1 L 239.1 163.0 L 237.7 165.8 L 236.2 168.7 L 234.8 171.6 L 233.3 174.4 L 231.9 177.3 L 230.5 180.1 L 229.0 183.0 L 227.6 185.8 L 226.1 188.6 L 224.7 191.5 L 223.2 194.3 L 221.8 197.2 L 220.4 200.1 L 218.9 202.9 L 217.5 205.8 L 216.1 208.7 L 214.6 211.5 L 213.0 214.3 L 211.4 217.0 L 209.7 219.7 L 208.0 222.4 L 206.3 225.1 L 204.5 227.8 L 202.7 230.4 L 200.5 232.6 L 197.8 234.1 L 194.7 234.9 L 191.6 234.9 L 188.6 233.9 L 186.0 232.2 L 184.0 229.7 L 182.5 227.0 L 181.0 224.1 L 179.4 221.4 L 177.7 218.7 L 175.9 216.1 L 173.9 213.6 L 171.8 211.2 L 169.6 208.8 L 167.4 206.5 L 165.2 204.2 L 162.9 201.9 L 160.8 199.6 L 158.7 197.2 L 156.5 195.0 L 153.9 194.1 L 151.2 195.1 L 148.6 196.8 L 145.7 197.4 L 143.1 196.2 L 140.8 193.9 L 138.9 191.4 L 137.4 188.6 L 136.1 185.7 L 135.3 182.6 L 135.2 179.5 L 136.2 176.7 L 138.0 174.0 L 139.8 171.4 L 141.7 168.8 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Silverstone: roughly square shape. S/F on the top-left straight.
    // Copse right (top-right). Maggotts-Becketts-Chapel S-curves (right side).
    // Hangar straight (right side going down). Stowe right (bottom-right).
    // Vale/Club infield section. Loop. Aintree chicane. Hamilton straight back.
    // Corner arc angles adjusted so net heading change ≈ −2π (CW circuit). Net = −6.278 rad.
    segments: [
      { type: 'straight', length: 1069, label: 'Wellington / Start straight'                                  },  // filler reduced 3m
      { type: 'corner',   length: 157,  radius: 100, direction: 'right', label: 'Copse'                      },  // (~90°)
      { type: 'corner',   length: 63,   radius: 60,  direction: 'left',  label: 'Maggotts'                   },  // (~60°)
      { type: 'corner',   length: 97,   radius: 65,  direction: 'right', label: 'Becketts'                   },  // (~85°)
      { type: 'corner',   length: 65,   radius: 50,  direction: 'left',  label: 'Chapel'                     },  // (~74°)
      { type: 'straight', length: 1052, label: 'Hangar Straight'                                              },
      { type: 'corner',   length: 150,  radius: 95,  direction: 'right', label: 'Stowe'                      },  // (~90°)
      { type: 'straight', length: 185                                                                          },
      { type: 'corner',   length: 110,  radius: 70,  direction: 'right', label: 'Vale'                       },  // (~90°)
      { type: 'corner',   length: 94,   radius: 72,  direction: 'left',  label: 'Club'                       },  // (~75°)
      { type: 'straight', length: 590,  label: 'Start/Finish straight'                                        },
      { type: 'corner',   length: 133,  radius: 85,  direction: 'right', label: 'Abbey'                      },  // (~90°)
      { type: 'straight', length: 180                                                                          },
      { type: 'corner',   length: 42,   radius: 40,  direction: 'left',  label: 'Farm / Village T1'          },  // chicane left — racing line R
      { type: 'straight', length: 50                                                                           },
      { type: 'corner',   length: 54,   radius: 40,  direction: 'right', label: 'Village T2'                 },  // chicane right — racing line R
      { type: 'straight', length: 300                                                                          },
      { type: 'corner',   length: 126,  radius: 80,  direction: 'right', label: 'Loop'                       },  // (~90°)
      { type: 'straight', length: 280                                                                          },
      { type: 'corner',   length: 67,   radius: 55,  direction: 'left',  label: 'Aintree T1'                 },  // chicane left (~70°)
      { type: 'straight', length: 55                                                                           },
      { type: 'corner',   length: 70,   radius: 50,  direction: 'right', label: 'Aintree T2'                 },  // chicane right (~80°)
      { type: 'straight', length: 902,  label: 'Hamilton Straight'                                            },
    ],
  },

  suzuka: {
    name: 'Suzuka (5.807 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 301.8 96.4 L 304.8 99.9 L 307.9 103.5 L 310.9 107.0 L 314.0 110.6 L 317.0 114.2 L 320.1 117.7 L 323.1 121.3 L 326.1 124.8 L 329.2 128.4 L 332.2 132.0 L 335.3 135.5 L 338.3 139.1 L 341.3 142.7 L 344.4 146.2 L 347.4 149.8 L 350.4 153.4 L 353.5 156.9 L 356.5 160.5 L 359.5 164.1 L 362.5 167.7 L 365.6 171.3 L 368.6 174.9 L 371.6 178.4 L 374.6 182.0 L 377.7 185.6 L 380.6 189.2 L 383.1 193.1 L 384.7 197.4 L 384.9 202.0 L 384.1 206.6 L 382.7 211.0 L 380.7 215.2 L 377.6 218.4 L 373.4 220.0 L 368.9 219.9 L 364.9 217.9 L 361.8 214.5 L 359.2 210.7 L 356.6 206.7 L 354.0 202.9 L 351.4 199.0 L 348.8 195.1 L 346.0 191.3 L 342.7 188.1 L 338.6 186.0 L 334.1 185.0 L 329.5 184.7 L 324.9 183.8 L 321.0 181.6 L 318.1 178.1 L 316.2 173.9 L 314.9 169.4 L 313.5 164.9 L 311.6 160.7 L 308.8 157.0 L 305.2 154.3 L 300.9 152.7 L 296.3 152.1 L 291.6 152.0 L 287.0 151.3 L 282.7 149.7 L 279.1 146.8 L 276.4 143.1 L 275.0 138.8 L 275.1 134.2 L 276.2 129.7 L 277.8 125.3 L 279.2 120.8 L 279.8 116.3 L 279.3 111.7 L 277.3 107.6 L 274.3 104.2 L 270.4 101.6 L 266.2 99.5 L 261.9 97.8 L 257.4 96.5 L 252.8 95.9 L 248.1 95.8 L 243.4 96.1 L 238.9 97.0 L 234.5 98.6 L 230.3 100.6 L 226.2 102.9 L 222.5 105.7 L 219.1 108.9 L 216.0 112.4 L 213.0 116.0 L 210.1 119.7 L 207.2 123.4 L 204.3 127.0 L 201.3 130.6 L 197.7 133.3 L 193.4 134.6 L 188.7 135.1 L 184.1 135.5 L 179.4 136.0 L 174.8 136.4 L 170.5 135.6 L 167.7 132.7 L 166.4 128.3 L 165.4 123.7 L 164.4 119.1 L 163.4 114.6 L 162.4 110.0 L 161.5 105.4 L 160.5 100.8 L 159.5 96.2 L 158.6 91.6 L 157.6 87.0 L 156.8 82.4 L 156.7 77.8 L 157.6 73.2 L 159.1 68.8 L 160.9 64.5 L 162.7 60.2 L 163.3 55.9 L 161.2 53.3 L 157.6 54.0 L 154.6 57.4 L 152.3 61.5 L 149.9 65.5 L 147.4 69.4 L 144.9 73.4 L 142.3 77.3 L 139.3 80.9 L 136.0 84.2 L 132.3 86.9 L 128.1 89.1 L 123.7 90.3 L 119.1 91.0 L 114.4 91.2 L 109.7 91.2 L 105.1 90.7 L 100.4 89.9 L 95.9 88.8 L 91.4 87.5 L 87.0 86.0 L 82.6 84.3 L 78.4 82.2 L 74.4 79.8 L 70.7 77.0 L 67.2 73.9 L 64.1 70.4 L 61.3 66.6 L 58.9 62.6 L 56.9 58.4 L 54.9 54.1 L 53.0 49.9 L 51.0 45.6 L 49.1 41.3 L 47.0 37.2 L 44.2 33.6 L 40.4 31.1 L 36.0 29.9 L 31.4 29.9 L 26.8 30.6 L 22.3 32.0 L 18.5 34.5 L 15.9 38.2 L 15.0 42.6 L 15.7 47.1 L 17.6 51.3 L 20.5 54.9 L 23.9 58.1 L 27.5 61.1 L 31.2 64.0 L 35.0 66.8 L 38.8 69.4 L 42.7 72.0 L 46.7 74.5 L 50.7 76.9 L 54.8 79.2 L 58.9 81.5 L 63.1 83.6 L 67.3 85.6 L 71.6 87.5 L 75.9 89.4 L 80.2 91.2 L 84.6 92.8 L 89.0 94.2 L 93.5 95.7 L 98.0 97.1 L 102.4 98.6 L 106.9 100.1 L 111.3 101.6 L 115.7 103.1 L 120.1 104.6 L 124.6 106.2 L 129.0 107.7 L 133.4 109.2 L 137.9 110.7 L 142.3 112.2 L 146.7 113.8 L 151.2 115.3 L 155.6 116.8 L 160.1 118.2 L 164.5 119.6 L 169.0 120.8 L 173.6 121.3 L 178.2 120.6 L 182.7 119.2 L 187.1 117.6 L 191.3 115.6 L 195.4 113.3 L 199.2 110.7 L 202.9 107.8 L 206.4 104.7 L 209.8 101.5 L 213.2 98.2 L 216.6 95.0 L 220.0 91.8 L 223.4 88.5 L 226.8 85.4 L 230.4 82.3 L 234.2 79.8 L 238.2 79.4 L 242.2 81.3 L 246.1 82.4 L 250.0 80.7 L 253.7 77.9 L 257.7 75.5 L 262.1 74.1 L 266.7 73.9 L 271.3 74.5 L 275.9 75.6 L 280.2 77.3 L 284.2 79.6 L 288.0 82.4 L 291.6 85.4 L 294.9 88.7 L 298.0 92.2 L 301.1 95.7 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Suzuka: figure-8 circuit. The crossing happens between the Degner curves
    // and the 130R section. S/F at middle-right going right.
    // Turn 1-2 (top), S-curves, Degner, back straight (bottom), Hairpin,
    // 130R, Casio chicane, Spoon (left), over-crossing back to start.
    // Suzuka is a figure-8 (self-crossing) circuit — 2D map is schematic only.
    segments: [
      { type: 'straight', length: 1098, label: 'Start / Pit straight'                                         },
      { type: 'corner',   length: 80,  radius: 50,  direction: 'right', label: 'Turn 1'                      },  // (~92°)
      { type: 'corner',   length: 65,  radius: 40,  direction: 'right', label: 'Turn 2'                      },  // (~93°)
      { type: 'straight', length: 200                                                                          },
      { type: 'corner',   length: 75,  radius: 45,  direction: 'right', label: 'S-curve T3'                  },  // (~95°)
      { type: 'corner',   length: 65,  radius: 38,  direction: 'left',  label: 'S-curve T4'                  },  // (~98°)
      { type: 'corner',   length: 60,  radius: 35,  direction: 'right', label: 'S-curve T5'                  },  // (~98°)
      { type: 'straight', length: 240                                                                          },
      { type: 'corner',   length: 38,  radius: 55,  direction: 'right', label: 'Degner 1'                    },  // racing line R
      { type: 'straight', length: 60                                                                           },
      { type: 'corner',   length: 31,  radius: 50,  direction: 'right', label: 'Degner 2'                    },  // racing line R
      { type: 'straight', length: 1148, label: 'Back straight'                                                },  // reduced 66m to compensate Hairpin arc increase
      { type: 'corner',   length: 110, radius: 35,  direction: 'right', label: 'Hairpin'                     },  // 180°, racing line R=35m → 69 kph
      { type: 'straight', length: 300                                                                          },
      { type: 'corner',   length: 204, radius: 130, direction: 'right', label: '130R'                        },  // fast right (~90°)
      { type: 'corner',   length: 21,  radius: 40,  direction: 'left',  label: 'Casio Chicane T1'            },  // racing line R
      { type: 'straight', length: 40                                                                           },
      { type: 'corner',   length: 26,  radius: 45,  direction: 'right', label: 'Casio Chicane T2'            },  // racing line R
      { type: 'straight', length: 580,  label: 'Back to start'                                                },
      { type: 'corner',   length: 110, radius: 72,  direction: 'right', label: 'Spoon Curve'                 },  // (~88°)
      { type: 'straight', length: 1256, label: 'Main straight approach'                                       },
    ],
  },

  // ── Additional real-world circuits (GPS-derived from TUMFTM Racetrack Database) ──
  // Attribution: TU Munich, Institute of Automotive Technology (FTM)
  // Source: https://github.com/TUMFTM/racetrack-database (LGPL-3.0)
  // Circumradius segmentation algorithm applied to x_m/y_m coordinates.

  nurburgring_gp: {
    name: 'Nürburgring GP (5.148 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 235.2 74.1 L 231.0 78.2 L 226.8 82.2 L 222.6 86.3 L 218.4 90.3 L 214.1 94.4 L 209.7 98.2 L 205.1 101.8 L 200.3 105.1 L 195.3 108.1 L 190.0 109.7 L 189.6 104.4 L 191.6 99.0 L 194.6 94.0 L 197.0 88.7 L 195.7 83.1 L 191.2 79.6 L 185.4 79.3 L 179.6 80.0 L 173.9 81.2 L 168.4 83.3 L 164.7 87.6 L 167.1 92.5 L 172.6 93.3 L 178.2 94.3 L 179.1 99.8 L 178.3 105.6 L 177.4 111.4 L 176.3 117.1 L 175.1 122.8 L 173.9 128.6 L 172.1 134.1 L 170.2 139.6 L 168.3 145.2 L 166.3 150.7 L 164.4 156.2 L 163.6 161.9 L 166.0 167.2 L 170.7 170.5 L 176.0 173.1 L 180.9 176.3 L 181.7 181.7 L 177.8 185.8 L 172.6 188.5 L 167.4 191.2 L 162.3 194.0 L 157.3 197.0 L 152.5 200.4 L 147.9 204.0 L 143.5 207.9 L 139.5 212.1 L 135.7 216.5 L 132.1 221.1 L 128.8 226.0 L 125.8 231.0 L 121.8 235.0 L 116.3 233.6 L 114.3 228.4 L 117.3 223.5 L 121.6 219.6 L 125.8 215.5 L 130.1 211.5 L 134.3 207.5 L 138.6 203.5 L 142.8 199.5 L 146.8 195.2 L 148.8 189.8 L 148.9 184.0 L 147.3 178.3 L 146.8 172.5 L 148.1 166.9 L 150.1 161.4 L 152.1 155.9 L 154.0 150.4 L 156.0 144.9 L 157.9 139.3 L 159.8 133.8 L 161.7 128.3 L 163.6 122.8 L 165.5 117.2 L 164.9 111.6 L 160.0 108.6 L 154.7 106.2 L 149.4 103.7 L 144.2 101.0 L 141.2 96.1 L 141.6 90.4 L 145.0 85.7 L 148.9 81.3 L 152.8 76.9 L 156.6 72.5 L 160.5 68.1 L 164.3 63.7 L 168.1 59.3 L 172.0 54.9 L 175.9 50.5 L 180.3 46.7 L 185.6 44.5 L 191.3 43.0 L 197.0 41.7 L 202.7 40.4 L 208.4 39.0 L 214.1 37.7 L 219.7 36.4 L 225.4 35.0 L 231.1 33.7 L 236.8 32.3 L 242.5 31.0 L 248.0 29.2 L 250.6 24.1 L 254.7 20.2 L 260.3 18.5 L 266.0 17.3 L 271.7 16.2 L 277.5 15.0 L 282.8 16.6 L 285.7 21.4 L 284.0 26.8 L 279.9 31.0 L 275.7 35.1 L 271.6 39.2 L 267.4 43.3 L 263.2 47.3 L 259.0 51.4 L 254.7 55.4 L 250.5 59.5 L 246.3 63.5 L 242.1 67.5 L 237.8 71.6 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    segments: [
      { type: 'straight', length: 375 },
      { type: 'corner',   length: 60,  radius: 57,  direction: 'right' },
      { type: 'straight', length: 110 },
      { type: 'corner',   length: 120, radius: 66,  direction: 'left'  },
      { type: 'straight', length: 110 },
      { type: 'corner',   length: 185, radius: 59,  direction: 'left',  label: 'Ford Kurve hairpin'  },  // 180° — split from original 208.8° impossible sweep
      { type: 'corner',   length: 30,  radius: 59,  direction: 'left',  label: 'Ford Kurve exit'     },  // ~29° — exit arc (total = 215m, unchanged)
      { type: 'straight', length: 425 },
      { type: 'corner',   length: 95,  radius: 84,  direction: 'left'  },
      { type: 'straight', length: 85  },
      { type: 'corner',   length: 80,  radius: 51,  direction: 'right' },
      { type: 'straight', length: 503 },
      { type: 'corner',   length: 125, radius: 47,  direction: 'right' },
      { type: 'straight', length: 300 },
      { type: 'corner',   length: 80,  radius: 122, direction: 'left'  },
      { type: 'straight', length: 50  },
      { type: 'corner',   length: 50,  radius: 137, direction: 'right' },
      { type: 'straight', length: 385 },
      { type: 'corner',   length: 55,  radius: 62,  direction: 'left'  },
      { type: 'straight', length: 140 },
      { type: 'corner',   length: 100, radius: 74,  direction: 'right' },
      { type: 'straight', length: 360 },
      { type: 'corner',   length: 50,  radius: 148, direction: 'right' },
      { type: 'straight', length: 440 },
      { type: 'corner',   length: 20,  radius: 78,  direction: 'left'  },
      { type: 'straight', length: 45  },
      { type: 'corner',   length: 45,  radius: 86,  direction: 'right' },
      { type: 'straight', length: 145 },
      { type: 'corner',   length: 125, radius: 73,  direction: 'right' },
      { type: 'straight', length: 455 },
    ],
  },

  bahrain: {
    name: 'Bahrain International Circuit (5.412 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 127.7 149.9 L 128.1 141.5 L 128.5 133.2 L 128.9 124.8 L 129.3 116.5 L 129.6 108.1 L 130.0 99.8 L 130.4 91.4 L 130.8 83.1 L 131.2 74.7 L 131.5 66.3 L 131.9 58.0 L 132.3 49.6 L 132.6 41.3 L 133.0 32.9 L 133.3 24.6 L 133.6 16.2 L 139.1 15.0 L 145.1 20.9 L 152.1 24.1 L 160.1 21.6 L 168.1 19.0 L 176.4 19.3 L 184.6 20.9 L 192.8 22.5 L 201.0 24.1 L 209.2 25.7 L 217.4 27.3 L 225.6 29.0 L 233.8 30.6 L 242.0 32.2 L 250.2 33.8 L 258.4 35.4 L 266.6 37.0 L 274.5 39.3 L 274.9 47.4 L 269.3 53.3 L 262.8 58.6 L 256.3 63.9 L 250.2 69.6 L 244.6 75.8 L 240.6 83.2 L 236.4 90.2 L 228.5 92.1 L 220.2 91.2 L 212.0 92.1 L 205.8 97.5 L 200.6 104.0 L 195.4 110.6 L 190.2 117.2 L 184.9 123.6 L 177.9 121.2 L 178.6 112.9 L 179.9 104.7 L 181.2 96.4 L 182.5 88.1 L 183.9 79.9 L 185.2 71.6 L 186.1 63.3 L 184.1 55.3 L 178.6 49.1 L 171.8 47.4 L 170.4 55.6 L 169.3 63.9 L 168.1 72.2 L 167.5 80.5 L 167.1 88.8 L 166.7 97.2 L 166.3 105.5 L 165.9 113.9 L 165.6 122.3 L 165.2 130.6 L 164.9 139.0 L 164.5 147.3 L 164.1 155.7 L 163.8 164.0 L 163.4 172.4 L 166.4 179.2 L 174.5 180.8 L 182.7 179.6 L 190.2 175.9 L 195.7 169.6 L 199.3 162.1 L 202.3 154.3 L 206.6 147.2 L 213.0 141.9 L 220.8 139.2 L 229.1 139.7 L 236.9 142.7 L 244.4 146.3 L 251.9 150.0 L 257.2 156.3 L 259.4 164.1 L 254.2 170.3 L 246.9 174.4 L 239.5 178.2 L 232.2 182.3 L 224.9 186.4 L 217.6 190.5 L 210.3 194.6 L 203.0 198.6 L 195.7 202.7 L 188.4 206.8 L 181.1 210.9 L 173.8 214.9 L 166.4 219.0 L 159.2 223.1 L 151.9 227.2 L 144.5 231.2 L 137.1 235.0 L 130.0 234.4 L 126.8 226.7 L 125.1 218.6 L 125.4 210.3 L 125.6 201.9 L 125.9 193.5 L 126.2 185.2 L 126.5 176.8 L 126.9 168.5 L 127.3 160.1 L 127.7 151.8 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    segments: [
      { type: 'straight', length: 730 },
      { type: 'corner',   length: 35,  radius: 58,  direction: 'right' },
      { type: 'straight', length: 65  },
      { type: 'corner',   length: 20,  radius: 132, direction: 'left'  },
      { type: 'straight', length: 100 },
      { type: 'corner',   length: 20,  radius: 137, direction: 'right' },
      { type: 'straight', length: 555 },
      { type: 'corner',   length: 60,  radius: 74,  direction: 'right' },
      { type: 'straight', length: 220 },
      { type: 'corner',   length: 15,  radius: 178, direction: 'left'  },
      { type: 'straight', length: 60  },
      { type: 'corner',   length: 50,  radius: 69,  direction: 'right' },
      { type: 'straight', length: 70  },
      { type: 'corner',   length: 55,  radius: 83,  direction: 'left'  },
      { type: 'straight', length: 195 },
      { type: 'corner',   length: 59,  radius: 43,  direction: 'right' },
      { type: 'straight', length: 300 },
      { type: 'corner',   length: 75,  radius: 111, direction: 'left'  },
      { type: 'straight', length: 45  },
      { type: 'corner',   length: 15,  radius: 68,  direction: 'left'  },
      { type: 'straight', length: 700 },
      { type: 'corner',   length: 214, radius: 118, direction: 'left'  },
      { type: 'straight', length: 95  },
      { type: 'corner',   length: 140, radius: 133, direction: 'right' },
      { type: 'straight', length: 160 },
      { type: 'corner',   length: 15,  radius: 129, direction: 'right' },
      { type: 'straight', length: 45  },
      { type: 'corner',   length: 80,  radius: 71,  direction: 'right' },
      { type: 'straight', length: 1134 },
    ],
  },

  barcelona: {
    name: 'Circuit de Barcelona-Catalunya (4.655 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 264.9 93.3 L 261.3 98.9 L 257.7 104.5 L 254.1 110.1 L 250.5 115.7 L 246.9 121.3 L 243.3 126.9 L 239.7 132.5 L 236.1 138.1 L 232.5 143.7 L 228.8 149.3 L 225.2 154.9 L 221.7 160.5 L 218.1 166.1 L 214.5 171.7 L 210.9 177.3 L 207.3 182.9 L 203.7 188.5 L 200.1 194.1 L 196.5 199.7 L 192.9 205.3 L 189.3 210.9 L 185.9 216.6 L 182.2 222.1 L 177.0 226.0 L 170.7 224.6 L 165.0 221.1 L 158.5 220.3 L 152.6 223.2 L 147.2 227.1 L 141.8 231.0 L 135.9 234.0 L 129.4 235.0 L 122.9 233.8 L 117.1 230.6 L 112.6 225.7 L 109.5 219.9 L 108.0 213.4 L 107.9 206.8 L 108.9 200.2 L 110.9 193.9 L 113.7 187.9 L 117.3 182.2 L 120.9 176.6 L 124.4 171.0 L 128.1 165.4 L 131.6 159.8 L 135.2 154.2 L 138.9 148.7 L 144.5 145.3 L 150.9 146.1 L 156.1 150.2 L 159.0 156.1 L 159.5 162.7 L 157.9 169.1 L 154.8 175.0 L 151.1 180.6 L 147.6 186.2 L 143.9 191.7 L 140.3 197.3 L 137.2 203.1 L 138.7 209.3 L 144.8 211.1 L 151.0 208.7 L 157.1 206.0 L 163.1 203.3 L 169.2 200.7 L 175.2 197.7 L 180.4 193.6 L 185.0 188.8 L 188.9 183.4 L 192.5 177.8 L 196.2 172.2 L 197.7 165.9 L 193.8 160.8 L 188.3 157.1 L 184.1 152.0 L 181.5 145.9 L 179.0 139.7 L 176.4 133.6 L 173.9 127.4 L 171.3 121.3 L 169.5 114.9 L 170.1 108.4 L 173.2 102.5 L 178.4 98.4 L 184.3 95.3 L 190.3 92.4 L 196.3 89.5 L 202.2 86.5 L 208.2 83.5 L 214.1 80.6 L 220.1 77.6 L 226.0 74.7 L 232.0 71.7 L 238.0 68.8 L 244.0 65.9 L 249.9 62.9 L 255.9 60.1 L 261.9 57.1 L 264.5 51.3 L 258.9 48.5 L 252.4 46.9 L 246.0 45.3 L 239.7 46.0 L 234.3 49.9 L 228.1 52.1 L 221.7 51.1 L 217.3 46.3 L 216.1 39.8 L 218.9 33.9 L 224.0 29.7 L 229.2 25.6 L 234.4 21.4 L 239.5 17.1 L 245.4 15.0 L 250.9 18.8 L 256.3 22.7 L 261.6 26.7 L 267.2 27.2 L 272.4 24.1 L 278.0 27.6 L 283.6 31.1 L 288.7 35.4 L 291.7 41.3 L 292.1 47.9 L 290.1 54.2 L 286.6 59.8 L 283.0 65.4 L 279.4 71.0 L 275.7 76.6 L 272.1 82.2 L 268.5 87.7 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    segments: [
      { type: 'straight', length: 822 },
      { type: 'corner',   length: 150, radius: 81,  direction: 'right' },
      { type: 'straight', length: 105 },
      { type: 'corner',   length: 250, radius: 125, direction: 'right' },
      { type: 'straight', length: 365 },
      { type: 'corner',   length: 219, radius: 80,  direction: 'right' },
      { type: 'straight', length: 190 },
      { type: 'corner',   length: 85,  radius: 43,  direction: 'left'  },
      { type: 'straight', length: 165 },
      { type: 'corner',   length: 10,  radius: 191, direction: 'right' },
      { type: 'straight', length: 170 },
      { type: 'corner',   length: 60,  radius: 59,  direction: 'left'  },
      { type: 'straight', length: 40  },
      { type: 'corner',   length: 35,  radius: 116, direction: 'right' },
      { type: 'straight', length: 195 },
      { type: 'corner',   length: 120, radius: 98,  direction: 'right' },
      { type: 'straight', length: 490 },
      { type: 'corner',   length: 50,  radius: 41,  direction: 'left'  },
      { type: 'straight', length: 165 },
      { type: 'corner',   length: 170, radius: 64,  direction: 'right' },
      { type: 'straight', length: 155 },
      { type: 'corner',   length: 30,  radius: 73,  direction: 'right' },
      { type: 'straight', length: 110 },
      { type: 'corner',   length: 59,  radius: 142, direction: 'right' },
      { type: 'straight', length: 75  },
      { type: 'corner',   length: 120, radius: 98,  direction: 'right' },
      { type: 'straight', length: 250 },
    ],
  },

  hungaroring: {
    name: 'Hungaroring (4.381 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 189.1 211.4 L 184.2 207.3 L 179.3 203.3 L 174.4 199.2 L 169.5 195.1 L 164.5 191.1 L 159.6 187.0 L 154.7 183.0 L 149.8 178.9 L 144.8 174.9 L 139.9 170.8 L 135.0 166.8 L 130.1 162.7 L 125.1 158.7 L 120.2 154.6 L 115.3 150.5 L 110.4 146.5 L 105.5 142.4 L 102.1 137.2 L 106.2 133.2 L 112.6 132.9 L 118.9 133.4 L 125.2 134.5 L 131.3 136.2 L 137.1 139.0 L 142.3 142.6 L 147.2 146.6 L 152.1 150.7 L 157.1 154.8 L 162.0 158.8 L 166.9 162.9 L 171.8 166.9 L 177.7 169.0 L 183.4 166.4 L 185.8 160.6 L 184.5 154.5 L 181.5 148.8 L 178.5 143.2 L 175.8 137.5 L 176.5 131.3 L 179.4 125.6 L 182.4 120.0 L 185.3 114.3 L 188.2 108.7 L 191.2 103.0 L 194.2 97.4 L 197.1 91.7 L 200.1 86.1 L 203.0 80.4 L 206.2 74.9 L 209.9 69.7 L 214.0 64.8 L 217.8 59.8 L 217.2 53.5 L 215.6 47.4 L 214.1 41.2 L 212.6 35.0 L 211.0 28.8 L 210.9 22.5 L 214.8 17.5 L 220.6 15.0 L 226.7 16.0 L 232.1 19.3 L 237.1 23.3 L 241.7 27.7 L 245.9 32.5 L 250.1 37.3 L 254.4 42.0 L 258.5 46.9 L 256.9 52.6 L 255.5 58.2 L 257.1 64.4 L 258.6 70.6 L 260.1 76.8 L 262.0 82.9 L 266.7 87.0 L 273.0 87.9 L 279.3 88.7 L 285.1 91.0 L 287.8 96.7 L 287.1 103.0 L 286.1 109.3 L 285.0 115.6 L 284.0 121.9 L 283.8 128.2 L 286.0 134.2 L 289.4 139.6 L 292.7 145.0 L 296.1 150.4 L 297.9 156.4 L 296.6 162.6 L 292.9 167.8 L 288.5 172.5 L 284.2 177.1 L 279.8 181.7 L 275.4 186.4 L 271.0 191.0 L 266.7 195.7 L 262.3 200.3 L 258.0 205.0 L 253.6 209.7 L 248.9 213.8 L 243.3 211.5 L 239.1 206.7 L 235.0 201.8 L 230.7 197.1 L 225.9 192.9 L 221.0 188.9 L 214.8 188.1 L 209.7 191.6 L 209.7 197.7 L 214.0 202.3 L 218.9 206.3 L 223.9 210.4 L 228.8 214.4 L 233.0 219.1 L 233.9 225.3 L 231.5 231.2 L 226.4 234.8 L 220.1 235.0 L 214.5 232.2 L 209.5 228.2 L 204.6 224.1 L 199.7 220.1 L 194.8 216.0 L 189.8 212.0 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    segments: [
      { type: 'straight', length: 601 },
      { type: 'corner',   length: 85,  radius: 52,  direction: 'right' },
      { type: 'straight', length: 405 },
      { type: 'corner',   length: 130, radius: 62,  direction: 'left'  },
      { type: 'straight', length: 110 },
      { type: 'corner',   length: 30,  radius: 90,  direction: 'right' },
      { type: 'straight', length: 430 },
      { type: 'corner',   length: 45,  radius: 89,  direction: 'left'  },
      { type: 'straight', length: 170 },
      { type: 'corner',   length: 140, radius: 71,  direction: 'right' },
      { type: 'straight', length: 235 },
      { type: 'corner',   length: 55,  radius: 65,  direction: 'right' },
      { type: 'straight', length: 150 },
      { type: 'corner',   length: 50,  radius: 72,  direction: 'left'  },
      { type: 'straight', length: 70  },
      { type: 'corner',   length: 70,  radius: 61,  direction: 'right' },
      { type: 'straight', length: 150 },
      { type: 'corner',   length: 50,  radius: 115, direction: 'left'  },
      { type: 'straight', length: 115 },
      { type: 'corner',   length: 80,  radius: 88,  direction: 'right' },
      { type: 'straight', length: 365 },
      { type: 'corner',   length: 30,  radius: 51,  direction: 'right' },
      { type: 'straight', length: 175 },
      { type: 'corner',   length: 130, radius: 51,  direction: 'left'  },
      { type: 'straight', length: 145 },
      { type: 'corner',   length: 185, radius: 69,  direction: 'right' },
      { type: 'straight', length: 180 },
    ],
  },

  montreal: {
    name: 'Circuit Gilles Villeneuve (4.361 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 229.6 196.1 L 230.4 200.0 L 230.9 204.1 L 231.1 208.1 L 230.9 212.2 L 230.5 216.2 L 230.1 220.3 L 229.7 224.3 L 232.0 227.2 L 235.7 228.9 L 237.0 232.5 L 234.1 235.0 L 230.1 234.9 L 226.2 233.8 L 222.3 232.7 L 218.5 231.3 L 215.0 229.3 L 211.8 226.8 L 208.6 224.3 L 205.4 221.7 L 202.3 219.1 L 199.8 216.0 L 200.5 212.1 L 200.1 208.2 L 197.4 205.1 L 194.8 202.0 L 192.3 198.8 L 189.5 196.0 L 186.0 193.8 L 183.3 190.8 L 181.6 187.2 L 180.7 183.2 L 180.6 179.2 L 180.6 175.1 L 180.6 171.0 L 180.5 167.0 L 179.5 163.2 L 175.7 162.5 L 171.8 163.0 L 168.4 160.8 L 166.3 157.4 L 165.3 153.4 L 164.6 149.4 L 164.1 145.4 L 163.8 141.4 L 163.5 137.3 L 163.2 133.3 L 163.0 129.2 L 163.0 125.2 L 163.2 121.1 L 163.4 117.0 L 163.8 113.0 L 164.3 109.0 L 165.0 105.0 L 165.9 101.0 L 166.9 97.1 L 167.9 93.2 L 168.9 89.2 L 170.9 86.2 L 174.9 85.5 L 177.6 82.6 L 179.1 78.8 L 180.1 74.9 L 181.2 70.9 L 182.0 67.0 L 182.8 63.0 L 183.5 59.0 L 184.2 55.0 L 184.8 51.0 L 185.2 47.0 L 185.4 42.9 L 185.4 38.8 L 185.1 34.8 L 184.5 30.8 L 183.6 26.8 L 182.7 22.9 L 181.7 18.9 L 181.5 15.0 L 185.0 15.3 L 186.1 19.1 L 186.5 23.2 L 187.2 27.2 L 188.8 30.9 L 190.6 34.5 L 192.4 38.2 L 194.0 41.9 L 195.5 45.6 L 197.0 49.4 L 198.6 53.2 L 200.1 56.9 L 201.6 60.7 L 203.1 64.5 L 204.4 68.3 L 205.3 72.3 L 206.2 76.2 L 207.1 80.2 L 208.0 84.2 L 208.9 88.1 L 209.8 92.1 L 210.7 96.0 L 211.7 100.0 L 212.6 103.9 L 213.5 107.9 L 214.4 111.9 L 215.3 115.8 L 216.2 119.8 L 217.1 123.7 L 218.0 127.7 L 218.9 131.7 L 219.7 135.6 L 220.6 139.6 L 221.5 143.6 L 221.1 147.2 L 219.1 150.3 L 220.0 154.2 L 220.9 158.2 L 221.8 162.2 L 222.7 166.1 L 223.6 170.1 L 224.5 174.0 L 225.4 178.0 L 226.4 181.9 L 227.3 185.9 L 228.2 189.9 L 229.1 193.8 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    segments: [
      { type: 'straight', length: 245 },
      { type: 'corner',   length: 175, radius: 57,  direction: 'right' },
      { type: 'straight', length: 115 },
      { type: 'corner',   length: 10,  radius: 192, direction: 'right' },
      { type: 'straight', length: 170 },
      { type: 'corner',   length: 25,  radius: 74,  direction: 'right' },
      { type: 'straight', length: 45  },
      { type: 'corner',   length: 15,  radius: 91,  direction: 'left'  },
      { type: 'straight', length: 125 },
      { type: 'corner',   length: 20,  radius: 153, direction: 'left'  },
      { type: 'straight', length: 45  },
      { type: 'corner',   length: 25,  radius: 116, direction: 'right' },
      { type: 'straight', length: 40  },
      { type: 'corner',   length: 25,  radius: 161, direction: 'right' },
      { type: 'straight', length: 165 },
      { type: 'corner',   length: 35,  radius: 42,  direction: 'left'  },
      { type: 'straight', length: 45  },
      { type: 'corner',   length: 90,  radius: 81,  direction: 'right' },
      { type: 'straight', length: 609 },
      { type: 'corner',   length: 95,  radius: 74,  direction: 'left'  },
      { type: 'straight', length: 565 },
      { type: 'corner',   length: 49,  radius: 40,  direction: 'right' },  // racing line R
      { type: 'straight', length: 85  },
      { type: 'corner',   length: 25,  radius: 157, direction: 'left'  },
      { type: 'straight', length: 1068 },
      { type: 'corner',   length: 35,  radius: 59,  direction: 'right' },
      { type: 'straight', length: 415 },
    ],
  },

  // ── GT / Endurance circuits (schematic — correct radii, verified arc lengths) ──

  laguna_seca: {
    name: 'Laguna Seca (3.602 km)',
    // GPS-derived from OpenStreetMap (ODbL) https://www.openstreetmap.org/copyright
    svgPath: "M 274 68.9 L 272.9 66.6 L 271.5 64.6 L 269.8 62.6 L 268.1 61 L 266.2 59.6 L 264.7 58.8 L 263.1 58.3 L 261.1 57.8 L 259.6 57.7 L 257.6 58 L 247.2 60.8 L 243.5 61.9 L 229.9 66.1 L 223.5 68.1 L 217.9 69.8 L 216.7 70.1 L 215.3 70.4 L 214 70.5 L 212.7 70.4 L 211.4 70.1 L 210.1 69.7 L 208.9 69.1 L 207.8 68.4 L 206.8 67.5 L 206 66.5 L 205.3 65.5 L 204.6 64.3 L 198.9 53.4 L 190.8 37.8 L 187.6 31.8 L 184.2 25.2 L 181.1 19.4 L 180.6 18.5 L 180 17.3 L 179.3 16.2 L 178.8 15.7 L 178.2 15.4 L 177.6 15.1 L 176.9 15 L 176.2 15 L 175.5 15.2 L 175 15.4 L 174.3 15.9 L 173.6 16.8 L 172.6 18.2 L 167.8 25.4 L 134.7 70.6 L 132.7 73.4 L 129.1 78.9 L 115.3 109.3 L 114 112.8 L 113 116.3 L 112.4 118.6 L 112 122.3 L 111.9 125.5 L 111.8 134.1 L 111.8 141.9 L 111.9 143.7 L 112.4 155 L 112.7 161.9 L 113 164.3 L 113.6 165.9 L 114.3 167.1 L 115.1 168.1 L 116.2 168.9 L 117.6 169.6 L 119.2 170 L 121.1 170.1 L 123.1 169.8 L 124.9 169.3 L 126.5 168.6 L 127.7 167.6 L 128.6 166.5 L 129.4 165.3 L 129.8 164 L 130.1 162.7 L 130.2 161.4 L 129.8 160.1 L 127.5 153 L 126.9 150.8 L 126 146.5 L 125.5 143.1 L 125.2 138.8 L 125.1 134.6 L 125.2 132.6 L 125.3 131 L 125.9 126.4 L 127 119.8 L 127.7 116.1 L 128 114.9 L 128.4 113.6 L 129 112.4 L 129.8 111.4 L 130.7 110.5 L 131.7 109.6 L 132.9 108.9 L 134.1 108.4 L 135.4 108 L 136.7 107.8 L 138 107.8 L 139.3 108 L 168.4 114.9 L 175.1 116.5 L 181.1 117.9 L 183.8 118.8 L 186.3 120.2 L 188 121.6 L 189.3 123 L 190.2 124.3 L 191.1 126.3 L 191.7 127.9 L 192 129.9 L 194.1 156.3 L 194.2 159.4 L 194.2 162.2 L 193.9 167.1 L 193.4 171 L 192.6 175.2 L 191.1 180.9 L 185.1 202.1 L 183.4 207.9 L 181.8 213.7 L 180.4 218.4 L 180.1 219.7 L 179.8 221.1 L 179.7 222.4 L 179.8 223.7 L 180 225 L 180.3 226.2 L 180.8 227.4 L 181.4 228.6 L 182.1 229.7 L 183 230.7 L 184 231.6 L 185.1 232.3 L 186.1 232.9 L 187.3 233.5 L 188.5 233.9 L 189.7 234.3 L 191 234.6 L 192.3 234.8 L 193.5 234.9 L 194.7 235 L 196.2 235 L 199 234.8 L 206.8 233.8 L 229.5 229.6 L 247.4 226.9 L 250.3 226.5 L 254.6 225.7 L 261 224.6 L 264.2 224 L 267.6 223.5 L 268.6 223.1 L 269.5 222.7 L 270.3 222 L 270.9 221.3 L 271.4 220.4 L 275.4 212.8 L 278.5 206.6 L 279.5 204.5 L 280.1 202.8 L 280.7 201 L 281.4 198.6 L 281.8 196.7 L 282.6 192.6 L 283.2 188 L 283.4 182.8 L 283.5 177.8 L 283.5 171.1 L 283.6 165.8 L 283.8 161.4 L 284.3 153.8 L 284.4 148.7 L 284.2 143.9 L 283.7 135.7 L 283.6 132.6 L 283.8 129.9 L 284.2 127.6 L 284.9 124.4 L 286.6 118.5 L 287.8 115.1 L 288.2 113.6 L 288.2 112.3 L 288 111.1 L 287.4 109.9 L 286.4 109.1 L 285.1 108.7 L 283.1 108.4 L 281.4 108.3 L 280.2 108 L 279.1 107.5 L 278 106.7 L 277.2 105.6 L 276.7 104.4 L 276 101.1 L 275.4 96.6 L 275.1 92.9 L 275.2 88.9 L 275.8 85.4 L 276 82.3 L 276 79.1 L 275.7 76.4 L 275 72.5 L 274 68.9 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    svgSource: 'osm',
    // Angles corrected for path closure: net = +360° (CW). All radii preserved for physics.
    segments: [
      { type: 'straight', length: 400,  label: 'Start/Finish straight'       },
      { type: 'corner',   length: 102,  radius: 130, direction: 'right', label: 'T1'                   },  // fast right — 45°
      { type: 'straight', length: 80                                          },
      { type: 'corner',   length: 38,   radius: 55,  direction: 'right', label: 'T2'                   },  // right — 40°
      { type: 'straight', length: 300                                         },
      { type: 'corner',   length: 37,   radius: 60,  direction: 'right', label: 'T3'                   },  // right — 35°
      { type: 'corner',   length: 37,   radius: 60,  direction: 'right', label: 'T4'                   },  // right — 35°
      { type: 'straight', length: 220                                         },
      { type: 'corner',   length: 118,  radius: 150, direction: 'right', label: 'T5 fast right'        },  // fast right — 45°
      { type: 'straight', length: 80                                          },
      { type: 'corner',   length: 61,   radius: 35,  direction: 'left',  label: 'T6'                   },  // left — 100°
      { type: 'straight', length: 550,  label: 'Uphill to Corkscrew'         },
      { type: 'corner',   length: 24,   radius: 15,  direction: 'left',  label: 'Corkscrew T8a'        },  // Corkscrew entry left — 92°
      { type: 'corner',   length: 15,   radius: 12,  direction: 'right', label: 'Corkscrew T8b'        },  // Corkscrew exit right — 72°
      { type: 'straight', length: 150,  label: 'Downhill exit'               },
      { type: 'corner',   length: 57,   radius: 18,  direction: 'right', label: 'T9 hairpin'           },  // hairpin right — 181°
      { type: 'straight', length: 280                                         },
      { type: 'corner',   length: 24,   radius: 40,  direction: 'right', label: 'T10'                  },  // right — 34°
      { type: 'straight', length: 55                                          },
      { type: 'corner',   length: 102,  radius: 90,  direction: 'right', label: 'T11 Rainey Corner'    },  // sweeping right — 65°
      { type: 'straight', length: 872,  label: 'Return to S/F'               },
    ],
  },

  imola: {
    name: 'Imola (4.909 km)',
    // GPS-derived from OpenStreetMap (ODbL) https://www.openstreetmap.org/copyright
    svgPath: "M 293.4 118.1 L 295.4 117.2 L 297.5 116.1 L 299.9 114.7 L 302.1 113.4 L 304 112.1 L 312.7 105.8 L 315.2 103.8 L 317.9 101.6 L 319.2 100.4 L 321.3 98.5 L 323.6 96.2 L 346.1 73.8 L 347.5 72.5 L 350.1 70.3 L 353.1 68.3 L 354.6 67.3 L 356 66.6 L 359.8 64.8 L 361.1 64.2 L 370.3 60.2 L 379.8 56.2 L 381.6 55.4 L 382.4 54.9 L 383.2 54.4 L 383.8 53.9 L 384.3 53.1 L 384.7 52.4 L 384.8 51.9 L 385 51.3 L 385 50.6 L 384.9 49.8 L 384.9 49.2 L 384.7 48.5 L 384.3 47.4 L 381.2 40.3 L 378.1 33.2 L 377.4 32.2 L 376.9 31.4 L 376 30.6 L 374.9 30 L 374.1 29.6 L 373.2 29.3 L 372.1 29.1 L 371.2 29.1 L 370.2 29.2 L 369.3 29.4 L 368 29.8 L 354.8 34.7 L 322 48 L 318.3 49.3 L 315.1 50.2 L 312.4 50.9 L 311.1 51.2 L 309.5 51.4 L 307.8 51.7 L 306.3 51.9 L 304.7 52.1 L 302.9 52.3 L 295.6 52.1 L 272.3 51.6 L 248.9 51.5 L 243.5 51.4 L 241 50.9 L 239.1 50.5 L 206.3 43.5 L 202.2 42.6 L 199.4 42.2 L 196.7 41.8 L 194.3 41.5 L 191.8 41.3 L 188.5 41 L 185.6 40.9 L 183.3 40.8 L 180.4 40.8 L 177.2 40.9 L 168.8 41.6 L 157 42.6 L 151.2 43.1 L 137.4 44.4 L 136 44.7 L 134.4 45 L 115.9 49.5 L 115 49.8 L 113.9 50.2 L 113.2 50.7 L 112.6 51.3 L 112.1 52 L 111.7 52.7 L 111.5 53.4 L 111.2 54.6 L 110.8 56.7 L 110.4 58.9 L 109.9 60.7 L 109.5 61.9 L 109 62.8 L 108.3 63.7 L 107.6 64.3 L 106.8 64.9 L 105.8 65.7 L 98 69.4 L 90.4 72.8 L 89.3 73.4 L 88.2 74 L 87.5 74.4 L 86.6 75.1 L 85.7 75.9 L 84.9 76.5 L 84.3 77.3 L 84 77.8 L 83.6 78.6 L 83.2 79.4 L 82.6 80.8 L 52.9 154.3 L 52.7 154.7 L 52.5 155.5 L 52.4 156.2 L 52.3 157 L 52.2 157.9 L 52.4 158.8 L 52.5 159.8 L 52.8 160.7 L 54.1 165.6 L 55.4 170.6 L 55.6 171.1 L 55.7 172 L 55.7 172.9 L 55.6 173.6 L 55.5 174.3 L 55.2 175.1 L 54.7 175.9 L 54.2 176.5 L 53.4 177.3 L 52.7 178 L 52.1 178.5 L 51.4 179.2 L 41.4 187.4 L 33.2 194.5 L 20.2 205.6 L 18.4 207.3 L 17 208.8 L 16.1 209.9 L 15.5 211.2 L 15.1 212.3 L 15 213.6 L 15.2 214.7 L 15.4 215.8 L 15.9 216.9 L 16.6 218 L 17.4 219 L 18.3 219.7 L 19.2 220.2 L 20.2 220.6 L 21.4 220.8 L 22.5 220.9 L 24.3 220.9 L 56.4 216.4 L 67.4 214.7 L 83.1 212.8 L 85.3 212.5 L 88.6 212.3 L 92.1 212.2 L 95 212.3 L 97.9 212.4 L 101 212.7 L 104.2 213.1 L 128.2 217.4 L 131.2 217.9 L 132.8 217.9 L 134.2 217.8 L 135.5 217.5 L 136.7 216.9 L 137.9 216.1 L 139.4 215 L 140.6 213.8 L 141.5 212.5 L 142.2 211.4 L 143 210 L 146.4 203 L 147.7 200.4 L 148.6 198.2 L 149.5 195.7 L 150.1 193.4 L 150.7 190.9 L 151.1 188.1 L 151.2 185.5 L 151.2 183.2 L 151.1 181.1 L 150.6 178.2 L 150.1 175.6 L 149.5 172.9 L 143.1 144 L 143 143 L 142.9 141.9 L 143.1 140.7 L 143.4 139.8 L 143.7 139.1 L 144.2 138.2 L 145 137 L 149.3 130.1 L 153.7 123.2 L 154.1 122.7 L 154.7 122.2 L 155.3 121.9 L 155.9 121.7 L 156.5 121.7 L 157.3 121.7 L 158 121.9 L 159.1 122.2 L 162.1 123.5 L 165 124.8 L 166.1 125.2 L 167.3 125.5 L 168.6 125.8 L 170 125.9 L 172.7 125.8 L 253.4 125.2 L 255 125.3 L 255.7 125.4 L 256.2 125.7 L 256.7 126.1 L 257 126.8 L 257.8 129.1 L 258 129.9 L 258.5 130.5 L 258.8 130.9 L 259.3 131.2 L 259.9 131.3 L 260.7 131.4 L 261.3 131.2 L 262.2 130.9 L 293.4 118.1 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    svgSource: 'osm',
    segments: [
      { type: 'straight', length: 650,  label: 'Start/Finish straight'                   },
      { type: 'corner',   length: 71,   radius: 90,  direction: 'right', label: 'Tamburello T1'        },  // chicane right — 45°
      { type: 'straight', length: 50                                                      },
      { type: 'corner',   length: 63,   radius: 80,  direction: 'left',  label: 'Tamburello T2'        },  // chicane left — 45°
      { type: 'straight', length: 280                                                     },
      { type: 'corner',   length: 98,   radius: 70,  direction: 'right', label: 'Villeneuve'           },  // right — 80°
      { type: 'straight', length: 400                                                     },
      { type: 'corner',   length: 63,   radius: 22,  direction: 'left',  label: 'Tosa hairpin'         },  // tight left — 165° (CCW circuit: hairpin turns left)
      { type: 'straight', length: 400                                                     },
      { type: 'corner',   length: 157,  radius: 90,  direction: 'left',  label: 'Piratella'            },  // fast left — 100°
      { type: 'straight', length: 180                                                     },
      { type: 'corner',   length: 42,   radius: 40,  direction: 'right', label: 'Acque Minerali T1'    },  // right — 60°
      { type: 'straight', length: 70                                                      },
      { type: 'corner',   length: 37,   radius: 35,  direction: 'left',  label: 'Acque Minerali T2'    },  // left — 60°
      { type: 'straight', length: 380                                                     },
      { type: 'corner',   length: 43,   radius: 45,  direction: 'right', label: 'Variante Alta T1'     },  // right — 55°
      { type: 'straight', length: 55                                                      },
      { type: 'corner',   length: 38,   radius: 40,  direction: 'left',  label: 'Variante Alta T2'     },  // left — 55°
      { type: 'straight', length: 919,  label: 'Long back straight'                      },
      { type: 'corner',   length: 96,   radius: 55,  direction: 'left',  label: 'Rivazza 1'            },  // left — 100°
      { type: 'straight', length: 100                                                     },
      { type: 'corner',   length: 63,   radius: 45,  direction: 'left',  label: 'Rivazza 2'            },  // left — 80°
      { type: 'straight', length: 202                                                     },
      { type: 'corner',   length: 53,   radius: 55,  direction: 'right', label: 'Variante Bassa T1'    },  // right — 55°
      { type: 'straight', length: 55                                                      },
      { type: 'corner',   length: 44,   radius: 50,  direction: 'left',  label: 'Variante Bassa T2'    },  // left — 50°
      { type: 'straight', length: 300                                                     },
    ],
  },

  le_mans: {
    name: 'Le Mans (13.626 km)',
    // GPS-derived from OpenStreetMap (ODbL) https://www.openstreetmap.org/copyright
    svgPath: "M 151.6 118.2 L 152.6 117.3 L 152.9 117.1 L 153 116.9 L 153.2 116.8 L 153.3 116.6 L 153.4 116.5 L 153.5 116.3 L 153.6 116.1 L 153.7 115.9 L 153.8 115.6 L 153.9 115.4 L 153.9 115.2 L 154 115 L 154 114.8 L 154.1 114.7 L 154.1 114.5 L 154.1 114.4 L 154.1 114.2 L 154.1 114 L 154.1 113.7 L 154.1 113.4 L 154 113.1 L 154 112.8 L 153.8 111.6 L 153.5 109.4 L 151.3 118.4 L 151.2 118.6 L 151.1 118.7 L 151 118.8 L 150.8 118.9 L 150.7 119 L 150.7 119.1 L 150.5 119.3 L 150.4 119.4 L 150.3 119.5 L 150.2 119.7 L 150.1 119.9 L 150 120 L 149.9 120.2 L 149.8 120.4 L 149.8 120.5 L 149.7 120.7 L 149.6 120.9 L 149.5 121.1 L 149.5 121.3 L 149.4 121.4 L 149.4 121.6 L 149.4 121.8 L 149.3 122 L 149.3 122.2 L 149.3 122.4 L 149.3 122.5 L 149.3 122.7 L 149.3 122.9 L 149.3 123.1 L 149.3 123.3 L 149.3 123.5 L 149.3 123.7 L 149.3 123.9 L 149.3 124.1 L 149.4 124.3 L 149.4 124.5 L 149.5 124.7 L 149.5 124.9 L 149.6 125.1 L 149.6 125.2 L 149.7 125.4 L 149.8 125.5 L 149.8 125.7 L 149.9 125.9 L 150 126 L 150.1 126.2 L 150.2 126.3 L 150.3 126.5 L 150.4 126.7 L 150.5 126.8 L 150.7 126.9 L 150.8 127.1 L 150.9 127.2 L 151 127.4 L 151.2 127.5 L 151.4 127.7 L 151.7 127.9 L 152.8 128.8 L 153 129.1 L 153.4 129.4 L 153.6 129.7 L 153.7 129.8 L 153.8 129.9 L 153.9 130 L 154 130.2 L 154.1 130.3 L 154.2 130.5 L 154.3 130.8 L 154.5 131.2 L 154.6 131.6 L 154.6 132.1 L 154.7 132.6 L 154.8 133.9 L 155 135.7 L 155 136.4 L 155.1 137 L 155 137.2 L 155 137.5 L 155 137.7 L 154.9 138 L 154.9 138.3 L 154.8 138.5 L 154.7 138.8 L 154.6 139 L 154.5 139.2 L 154.4 139.5 L 154.3 139.6 L 154.2 139.7 L 154.1 139.9 L 154 140.1 L 153.8 140.3 L 153.6 140.5 L 151.1 143.3 L 150.9 143.5 L 150.7 143.7 L 150.5 143.9 L 150.3 144.2 L 150.2 144.4 L 150 144.8 L 149.8 145 L 149.7 145.3 L 149.6 145.6 L 149.5 145.9 L 149.4 146.3 L 149.3 146.6 L 149.3 147 L 149.3 147.4 L 149.3 147.8 L 149.3 148.2 L 149.3 148.6 L 149.4 149 L 149.5 149.4 L 150 150.4 L 150.3 151 L 150.6 151.5 L 150.8 151.9 L 151.1 152.4 L 151.5 153.1 L 152.1 153.9 L 152.6 154.6 L 153.1 155.4 L 153.6 156 L 154.2 156.8 L 154.5 157.3 L 154.8 157.7 L 155 158.2 L 155.3 158.7 L 155.6 159.2 L 155.9 159.8 L 157 162.1 L 157.7 163.5 L 158.1 164.5 L 158.6 165.4 L 162.4 172.9 L 162.7 173.4 L 162.9 173.9 L 163.1 174.4 L 163.3 174.9 L 163.5 175.4 L 163.7 175.9 L 163.8 176.4 L 164 176.9 L 164.2 177.9 L 168.7 196.9 L 168.9 197.6 L 169 198 L 169.1 198.2 L 169.1 198.2 L 169.1 198.3 L 169.1 198.3 L 169.2 198.4 L 169.2 198.4 L 169.3 198.4 L 169.3 198.5 L 169.3 198.5 L 169.4 198.5 L 169.4 198.5 L 169.5 198.5 L 169.5 198.5 L 169.6 198.6 L 169.6 198.6 L 169.7 198.6 L 169.8 198.6 L 169.8 198.6 L 169.9 198.5 L 170 198.5 L 176.4 196 L 179.8 194.7 L 180.1 194.6 L 180.4 194.5 L 180.6 194.5 L 180.8 194.4 L 181 194.4 L 181.2 194.5 L 181.3 194.5 L 181.4 194.5 L 181.6 194.6 L 181.7 194.7 L 181.9 194.8 L 182 194.9 L 182.1 195 L 182.2 195.1 L 182.2 195.2 L 182.3 195.4 L 182.4 195.5 L 182.5 195.8 L 182.9 197.2 L 183.4 198.8 L 183.9 200.2 L 184 200.7 L 184.2 201 L 184.4 201.4 L 184.6 201.7 L 184.8 202 L 185.1 202.3 L 185.4 202.6 L 185.6 202.8 L 185.8 203 L 188.8 205.4 L 190.7 206.9 L 191.9 207.8 L 193.7 209.2 L 195.7 210.6 L 200.3 214 L 200.8 214.4 L 202.9 216 L 203.4 216.3 L 203.8 216.6 L 204.2 216.8 L 204.7 217.1 L 206.3 217.9 L 207.1 218.4 L 214.4 222.1 L 222.2 226.1 L 223.3 226.6 L 223.8 226.8 L 224.3 227 L 224.7 227.2 L 225.3 227.4 L 226.3 227.7 L 248.6 233.8 L 251.4 234.5 L 252.9 234.9 L 253 235 L 253.1 235 L 253.3 235 L 253.4 235 L 253.5 235 L 253.6 234.9 L 253.7 234.8 L 253.8 234.8 L 253.9 234.7 L 253.9 234.6 L 254 234.4 L 255 230.7 L 255.1 230.4 L 255.2 230.1 L 255.2 229.9 L 255.2 229.8 L 255.3 229.6 L 255.3 229.4 L 255.3 229.1 L 255.3 228.9 L 255.4 228.6 L 255.4 228.3 L 255.4 227.9 L 254.5 211 L 253.3 190.4 L 253 186 L 252.9 185.4 L 252.9 184.9 L 252.8 184.3 L 252.7 183.9 L 252.6 183.4 L 252.5 183 L 252.4 182.5 L 252.3 182.1 L 252.1 181.4 L 250 174.8 L 249.8 174.3 L 249.8 174.2 L 249.8 174.1 L 249.8 174.1 L 249.8 174 L 249.8 173.9 L 249.8 173.7 L 249.8 173.6 L 249.8 173.5 L 249.8 173.3 L 249.8 173.2 L 249.8 173.1 L 249.8 173 L 249.8 172.9 L 249.8 172.8 L 249.8 172.7 L 249.8 172.6 L 249.8 172.5 L 249.8 172.4 L 249.8 172.4 L 249.9 172.3 L 249.9 172.2 L 249.9 171.9 L 250 171.7 L 250.4 170.2 L 250.5 170.1 L 250.5 170 L 250.5 169.9 L 250.5 169.8 L 250.5 169.7 L 250.5 169.6 L 250.5 169.6 L 250.5 169.5 L 250.5 169.4 L 250.5 169.3 L 250.5 169.2 L 250.5 169.1 L 250.4 169 L 250.4 168.9 L 250.4 168.8 L 250.3 168.8 L 250.3 168.7 L 250.3 168.6 L 250.2 168.5 L 250.1 168.5 L 250.1 168.4 L 250 168.3 L 250 168.3 L 249.9 168.2 L 249.8 168.1 L 249.7 168.1 L 249.7 168.1 L 249.6 168 L 249.5 168 L 249.5 167.9 L 249.4 167.9 L 249.3 167.9 L 249.2 167.8 L 248.8 167.7 L 248.6 167.6 L 248.5 167.6 L 248.4 167.6 L 248.3 167.5 L 248.2 167.5 L 248.1 167.4 L 248 167.4 L 248 167.3 L 247.9 167.2 L 247.8 167.2 L 247.7 167.1 L 247.7 167.1 L 247.6 167 L 247.6 167 L 247.6 167 L 247.6 167 L 247.5 166.9 L 247.5 166.9 L 247.5 166.9 L 247.4 166.8 L 247.4 166.8 L 247.4 166.7 L 247.3 166.7 L 246.8 165 L 246.5 163.9 L 239.6 142.7 L 235.9 131.1 L 235.4 129.4 L 232.5 120.5 L 229.1 110.1 L 229 109.7 L 226.7 102.4 L 225.7 99.5 L 225.6 99.1 L 225.5 98.8 L 225.4 98.7 L 225.3 98.5 L 225.2 98.3 L 225.1 98.2 L 225.1 98.1 L 225 98 L 224.9 97.9 L 224.8 97.8 L 224.7 97.7 L 224.6 97.6 L 224.5 97.5 L 224.4 97.4 L 224.3 97.3 L 224 97 L 223 96.2 L 222.6 95.8 L 222.6 95.8 L 222.5 95.7 L 222.5 95.6 L 222.4 95.6 L 222.4 95.6 L 222.3 95.5 L 222.3 95.5 L 222.3 95.4 L 222.3 95.4 L 222.3 95.4 L 222.2 95.4 L 222.2 95.3 L 222.2 95.3 L 222.2 95.3 L 222.2 95.2 L 222.1 95.2 L 222.1 95.1 L 222.1 95.1 L 222.1 95.1 L 222.1 95 L 222.1 95 L 222.1 94.9 L 222.1 94.9 L 222 94.8 L 222 94.8 L 222 94.7 L 222 94.7 L 222 94.6 L 222 94.6 L 222 94.6 L 222 94.5 L 222 94.5 L 222 94.4 L 222 94.4 L 222 94.4 L 222 94.3 L 222 94.3 L 222 94.3 L 222 94.2 L 222 94.2 L 222 94.1 L 222 94.1 L 222 94.1 L 222 94 L 222 94 L 222 94 L 222 93.9 L 222 93.9 L 222.1 93.9 L 222.1 93.8 L 222.1 93.8 L 222.1 93.8 L 222.1 93.7 L 222.1 93.7 L 222.1 93.7 L 222.1 93.6 L 222.1 93.6 L 222.2 93.6 L 222.2 93.5 L 222.2 93.5 L 222.2 93.5 L 222.2 93.5 L 222.2 93.4 L 222.2 93.4 L 222.3 93.4 L 222.3 93.4 L 222.3 93.4 L 222.3 93.3 L 222.7 92.9 L 222.7 92.9 L 222.7 92.8 L 222.8 92.8 L 222.8 92.7 L 222.8 92.7 L 222.8 92.6 L 222.9 92.6 L 222.9 92.5 L 223 92.4 L 223 92.3 L 223 92.3 L 223 92.2 L 223 92.1 L 223.1 92.1 L 223.1 92 L 223.1 92 L 223.1 91.9 L 223.1 91.9 L 223.1 91.8 L 223.1 91.8 L 223.1 91.7 L 223.1 91.7 L 223.1 91.6 L 223.1 91.5 L 223 91.3 L 223 91.1 L 221 84.8 L 218.7 77.8 L 218.6 77.4 L 218 75.7 L 215.5 67.9 L 214.8 65.7 L 213.4 61.3 L 211.4 55.1 L 205.6 37.3 L 205.3 36.4 L 205 35.7 L 204.6 35 L 204.4 34.5 L 204.1 34.1 L 203.9 33.6 L 203.5 32.9 L 202.7 31.5 L 201.1 29.1 L 198.3 24.7 L 197 22.6 L 196.7 22.2 L 196.4 21.8 L 196.1 21.5 L 195.8 21.1 L 195.5 20.7 L 195.3 20.5 L 195 20.2 L 194.9 20.1 L 194.8 20 L 194.7 19.9 L 194.5 19.8 L 194.2 19.4 L 193.9 19.2 L 193.6 18.9 L 193.3 18.7 L 193.1 18.5 L 192.5 18.1 L 192.3 17.9 L 192.2 17.9 L 191.9 17.7 L 191.5 17.3 L 191 17.1 L 190.6 16.8 L 190.2 16.5 L 189.8 16.3 L 189.3 16 L 188.8 15.7 L 188.2 15.4 L 187.9 15.2 L 187.7 15.1 L 187.5 15.1 L 187.3 15 L 187.1 15 L 186.9 15 L 186.7 15 L 186.5 15.1 L 186.3 15.1 L 182.1 16.7 L 181.7 16.9 L 181.4 17 L 181 17.2 L 180.7 17.3 L 180.3 17.5 L 180.1 17.6 L 180 17.7 L 179.9 17.8 L 179.7 17.8 L 179.6 18 L 179.3 18.1 L 179 18.3 L 178.7 18.5 L 178 19.1 L 176.9 19.9 L 176.8 20 L 176.7 20.1 L 176.7 20.1 L 176.6 20.2 L 176.6 20.2 L 176.5 20.3 L 176.4 20.4 L 176.3 20.4 L 176.3 20.5 L 176.2 20.6 L 176.2 20.6 L 176.1 20.7 L 176.1 20.8 L 176 20.9 L 176 21 L 175.9 21 L 175.9 21.1 L 175.9 21.2 L 175.8 21.3 L 175.8 21.4 L 175.7 21.5 L 175.7 21.6 L 175.7 21.8 L 175.6 21.9 L 175.6 22 L 175.6 22.1 L 175.6 22.2 L 175.6 22.3 L 175.5 22.4 L 175.5 22.5 L 175.5 22.6 L 175.5 22.7 L 175.5 22.9 L 175.5 23 L 175.5 23.4 L 175.5 23.6 L 175.5 23.7 L 175.5 23.8 L 175.5 23.8 L 175.5 23.9 L 175.5 24 L 175.5 24 L 175.4 24.1 L 175.4 24.2 L 175.4 24.3 L 175.3 24.5 L 175.3 24.6 L 175.2 24.7 L 175.1 24.9 L 175.1 25 L 175 25.1 L 175 25.2 L 174.9 25.3 L 174.8 25.4 L 174.7 25.5 L 174.6 25.6 L 174.6 25.7 L 174.4 25.8 L 174.3 25.9 L 174.2 26 L 174.1 26.1 L 174 26.2 L 173.9 26.3 L 173.8 26.3 L 173.7 26.4 L 173.6 26.4 L 173.5 26.4 L 173.4 26.5 L 173.3 26.5 L 173.1 26.5 L 173 26.5 L 172.8 26.6 L 172.5 26.6 L 172 26.6 L 171.6 26.6 L 170.7 26.7 L 169.5 26.7 L 168.9 26.8 L 168.4 26.8 L 168.2 26.8 L 168.1 26.9 L 167.9 26.9 L 167.7 26.9 L 167.5 27 L 167.4 27 L 167.2 27.1 L 167 27.2 L 166.8 27.3 L 166.6 27.4 L 166.1 27.6 L 165.6 27.8 L 165.6 27.8 L 165.5 27.9 L 165.4 27.9 L 165.4 28 L 165.3 28 L 165.2 28.1 L 165.1 28.2 L 164.9 28.3 L 164.7 28.5 L 164.6 28.6 L 164.4 28.8 L 164.2 29 L 164 29.2 L 163.8 29.5 L 163.2 30.4 L 162.6 31.2 L 162.5 31.4 L 162.3 31.6 L 162.2 31.7 L 162 31.9 L 161.9 32.1 L 161.7 32.3 L 161.5 32.5 L 161.2 32.7 L 161 32.9 L 160.6 33.1 L 160 33.5 L 159.4 33.9 L 155.6 36.3 L 155.6 36.3 L 155.5 36.3 L 155.5 36.3 L 155.5 36.4 L 155.5 36.4 L 155.4 36.4 L 155.4 36.4 L 155.4 36.4 L 155.4 36.5 L 155.4 36.5 L 155.3 36.5 L 155.3 36.6 L 155.3 36.6 L 155.3 36.6 L 155.3 36.7 L 155.2 36.7 L 155.2 36.7 L 155.2 36.8 L 155.2 36.8 L 155.2 36.8 L 155.2 36.8 L 155.2 36.9 L 155.2 36.9 L 155.2 36.9 L 155.2 37 L 155.2 37 L 155.2 37 L 155.2 37.1 L 155.1 37.1 L 155.2 37.1 L 155.2 37.2 L 155.2 37.2 L 155.2 37.3 L 155.2 37.3 L 155.2 37.3 L 155.2 37.4 L 155.5 38.6 L 155.5 38.7 L 155.5 38.8 L 155.5 38.8 L 155.5 38.8 L 155.5 38.9 L 155.5 38.9 L 155.5 38.9 L 155.5 39 L 155.5 39 L 155.5 39 L 155.5 39.1 L 155.5 39.1 L 155.5 39.1 L 155.5 39.2 L 155.5 39.2 L 155.5 39.2 L 155.5 39.3 L 155.5 39.3 L 155.4 39.3 L 155.4 39.3 L 155.4 39.4 L 155.4 39.4 L 155.4 39.4 L 155.3 39.5 L 155.3 39.5 L 155.3 39.5 L 155.3 39.5 L 155.2 39.6 L 155.2 39.6 L 155.2 39.6 L 155.1 39.7 L 150.5 42.5 L 150.1 42.8 L 149.9 42.9 L 149.7 43.1 L 149.6 43.2 L 149.5 43.3 L 149.4 43.4 L 149.2 43.5 L 149 43.7 L 148.9 44 L 148.7 44.2 L 148.6 44.3 L 148.5 44.5 L 148.4 44.7 L 148.3 44.8 L 148.2 45 L 148.1 45.2 L 148 45.4 L 147.8 45.9 L 147.5 46.5 L 147.3 47.2 L 147 47.9 L 146.8 48.7 L 146.6 49.4 L 146.4 50 L 146.2 50.6 L 146.2 51 L 145.9 52.3 L 145.7 53 L 145.6 53.7 L 145.6 54.1 L 145.5 54.7 L 145.4 55.1 L 145.4 55.5 L 145.4 55.8 L 145.3 56.3 L 145.3 56.9 L 145.1 63.6 L 144.9 67.1 L 144.9 69.5 L 144.8 71.9 L 144.7 74.2 L 144.7 75 L 144.6 75.8 L 144.6 76.3 L 144.6 76.6 L 144.6 76.7 L 144.6 76.7 L 144.6 76.7 L 144.6 76.8 L 144.6 76.8 L 144.7 76.9 L 144.7 76.9 L 144.7 76.9 L 144.7 77 L 144.8 77 L 144.8 77.1 L 144.8 77.1 L 144.9 77.1 L 144.9 77.1 L 144.9 77.2 L 145 77.2 L 145 77.2 L 145.1 77.2 L 145.1 77.2 L 145.5 77.3 L 145.5 77.3 L 145.6 77.3 L 145.6 77.4 L 145.6 77.4 L 145.7 77.4 L 145.7 77.4 L 145.7 77.4 L 145.7 77.5 L 145.8 77.5 L 145.8 77.5 L 145.8 77.6 L 145.9 77.6 L 145.9 77.6 L 145.9 77.6 L 145.9 77.7 L 146 77.7 L 146 77.8 L 146 77.8 L 146 77.8 L 146 77.9 L 146 77.9 L 146.1 78 L 146.6 80.8 L 146.6 80.9 L 146.6 81 L 146.7 81.1 L 146.7 81.2 L 146.7 81.2 L 146.7 81.3 L 146.7 81.3 L 146.7 81.4 L 146.8 81.4 L 146.8 81.5 L 146.8 81.6 L 146.9 81.6 L 146.9 81.7 L 147 81.7 L 147 81.8 L 147 81.8 L 147.1 81.9 L 147.1 81.9 L 147.1 81.9 L 147.2 82 L 147.2 82 L 147.2 82 L 147.3 82 L 147.3 82.1 L 147.4 82.1 L 147.4 82.1 L 147.4 82.1 L 147.5 82.2 L 147.5 82.2 L 147.9 82.4 L 148 82.4 L 148 82.4 L 148.1 82.4 L 148.1 82.4 L 148.2 82.5 L 148.2 82.5 L 148.2 82.5 L 148.2 82.5 L 148.3 82.5 L 148.3 82.6 L 148.3 82.6 L 148.4 82.6 L 148.4 82.7 L 148.4 82.7 L 148.5 82.7 L 148.5 82.8 L 148.5 82.8 L 148.6 82.9 L 148.6 82.9 L 148.6 83 L 148.6 83 L 148.7 83.1 L 148.7 83.1 L 148.7 83.2 L 148.8 83.3 L 148.8 83.4 L 148.8 83.5 L 149.3 85.2 L 150.5 89.5 L 151.1 91.7 L 152.8 97.9 L 153.2 99.6 L 153.3 100.1 L 153.4 100.4 L 153.4 100.6 L 153.4 100.8 L 153.5 100.9 L 153.5 101.2 L 153.5 101.4 L 153.5 101.8 L 153.4 102.1 L 153.4 102.4 L 153.4 102.7 L 153.3 102.9 L 153.1 104.3 L 153 104.8 L 153 105 L 153 105.2 L 153 105.5 L 153 105.8 L 153 106 L 153 106.2 L 153 106.4 L 153.1 106.7 L 153.5 109.4 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    svgSource: 'osm',
    segments: [
      { type: 'straight', length: 1500, label: 'Start/Finish straight'                   },
      { type: 'corner',   length: 58,   radius: 55,  direction: 'right', label: 'Dunlop T1'            },  // chicane right — 60°
      { type: 'straight', length: 25                                                      },
      { type: 'corner',   length: 48,   radius: 50,  direction: 'left',  label: 'Dunlop T2'            },  // chicane left — 55°
      { type: 'straight', length: 100                                                     },
      { type: 'corner',   length: 105,  radius: 120, direction: 'right', label: 'Esses'                },  // fast right sweeper — 50°
      { type: 'straight', length: 1000                                                    },
      { type: 'corner',   length: 79,   radius: 75,  direction: 'right', label: 'Tertre Rouge'         },  // sweeping right — 60°
      { type: 'straight', length: 200                                                     },
      { type: 'straight', length: 3000, label: 'Mulsanne straight'                       },
      { type: 'corner',   length: 62,   radius: 65,  direction: 'right', label: 'Mulsanne chicane 1 T1' }, // right — 55°
      { type: 'straight', length: 50                                                      },
      { type: 'corner',   length: 58,   radius: 60,  direction: 'left',  label: 'Mulsanne chicane 1 T2' }, // left — 55°
      { type: 'straight', length: 2000                                                    },
      { type: 'corner',   length: 62,   radius: 65,  direction: 'right', label: 'Mulsanne chicane 2 T1' }, // right — 55°
      { type: 'straight', length: 50                                                      },
      { type: 'corner',   length: 58,   radius: 60,  direction: 'left',  label: 'Mulsanne chicane 2 T2' }, // left — 55°
      { type: 'straight', length: 1000                                                    },
      { type: 'corner',   length: 63,   radius: 40,  direction: 'right', label: 'Mulsanne corner'      },  // right — 90°
      { type: 'straight', length: 500                                                     },
      { type: 'corner',   length: 56,   radius: 80,  direction: 'right', label: 'Indianapolis'         },  // right — 40°
      { type: 'straight', length: 1200                                                    },
      { type: 'corner',   length: 47,   radius: 30,  direction: 'right', label: 'Arnage'               },  // tight right — 90°
      { type: 'straight', length: 500                                                     },
      { type: 'corner',   length: 71,   radius: 90,  direction: 'right', label: 'Porsche S1'           },  // right — 45°
      { type: 'straight', length: 100                                                     },
      { type: 'corner',   length: 104,  radius: 85,  direction: 'left',  label: 'Porsche S2'           },  // left — 70°
      { type: 'straight', length: 80                                                      },
      { type: 'corner',   length: 94,   radius: 90,  direction: 'right', label: 'Porsche S3'           },  // right — 60°
      { type: 'straight', length: 200                                                     },
      { type: 'corner',   length: 35,   radius: 45,  direction: 'right', label: 'Ford chicane T1'      },  // right — 45°
      { type: 'straight', length: 30                                                      },
      { type: 'corner',   length: 38,   radius: 40,  direction: 'left',  label: 'Ford chicane T2'      },  // left — 55°
      { type: 'straight', length: 1053, label: 'Return to S/F'                           },
    ],
  },

  sebring: {
    name: 'Sebring (4.702 km)',
    // GPS-derived from OpenStreetMap (ODbL) https://www.openstreetmap.org/copyright
    svgPath: "M 130.2 190 L 112.4 190 L 110.9 235 L 108 234.2 L 105.3 233 L 91.2 224.2 L 87.7 221.5 L 85.2 219.1 L 84 217.1 L 82.9 214.2 L 82.4 211.6 L 82.3 209.2 L 82.7 207.1 L 83.2 205.2 L 86 199.6 L 88 196.4 L 89.3 194.5 L 90.1 193.5 L 91.1 192.6 L 92.9 191.3 L 95.2 190.3 L 97.6 189.4 L 101.8 188.4 L 108 187.8 L 116.2 187.2 L 134.7 187.1 L 158.5 187.1 L 200.8 186.8 L 244.1 186.7 L 259 186.7 L 262 186.4 L 264.9 186.1 L 268.4 185.3 L 271.3 183.9 L 274.3 181.4 L 276.7 178.6 L 278.4 175.5 L 279.7 171.4 L 280.3 166.7 L 280.4 163.2 L 279.9 155.8 L 279.7 153.9 L 279.4 151.8 L 278.3 146.6 L 275.2 129.8 L 274.3 126 L 273.5 120.5 L 272.7 115.6 L 272.3 112.1 L 272 103.6 L 272 88.2 L 271.2 84.9 L 269.9 83.1 L 265.7 81 L 258.8 80.9 L 256.7 80.7 L 253.3 79.7 L 249.6 77.3 L 246 74.7 L 241.6 71.8 L 239.8 70.9 L 238.1 70.4 L 236.6 70 L 234.9 70 L 232.9 70.1 L 230.3 70.9 L 228.4 71.8 L 226.1 74.5 L 224.7 76.5 L 223.2 80.3 L 220.3 87.2 L 219 89.8 L 217.3 92.4 L 215.8 94.4 L 212.8 98.2 L 207.6 104.4 L 205.4 106.7 L 195.5 115.3 L 191 118.2 L 181.8 122.7 L 173.5 125.5 L 166.2 127 L 155.2 128.1 L 144.5 128.1 L 126 128.1 L 111.8 128.2 L 99.9 128.3 L 78.8 128.4 L 73.7 128.4 L 71.4 128.3 L 69.9 127.6 L 68.8 126.6 L 67.9 125.2 L 67.6 123.7 L 67.5 122.5 L 67.8 121 L 68.2 120 L 69.2 119 L 70.7 117.7 L 72.1 116 L 72.8 114.7 L 73.2 113.5 L 73.3 112.2 L 73.4 110.1 L 73.5 108.2 L 75 103.1 L 76.7 100.5 L 79.7 96.5 L 90.4 85.4 L 92.6 83.3 L 95.4 81.3 L 97.6 80.1 L 100 78.9 L 102.9 77.6 L 104.5 77 L 132.5 67.2 L 135 66.2 L 137.5 64.8 L 139.8 63.5 L 142.3 61.8 L 145.4 59.3 L 154.9 49.7 L 171.3 33.2 L 185.7 18.8 L 188.4 16.2 L 189.9 15.3 L 191.3 15 L 193.2 15.3 L 194.4 15.8 L 195.7 16.5 L 198.7 19.3 L 200.6 21.7 L 205.4 28.3 L 206.8 29.6 L 210.5 31.7 L 218.7 34.7 L 224.4 36 L 226.3 36.1 L 230.9 35.2 L 235.7 33.5 L 239.5 32.1 L 254.2 24.4 L 256.8 23.7 L 259.5 23.4 L 277.2 23.1 L 283 22.9 L 285.2 23.2 L 287 23.7 L 288.2 24.1 L 289.6 24.8 L 290.8 25.8 L 291.7 26.9 L 292.4 28.5 L 292.7 30 L 292.9 31.5 L 293.1 33.3 L 293.4 75.2 L 293.3 102.7 L 293.3 104.6 L 293.2 106.7 L 293 109 L 292.5 112 L 292.2 113.7 L 292 115.6 L 292 117.5 L 292.1 118.9 L 292.5 120.3 L 293 121.7 L 293.9 124.1 L 303.7 147 L 304.5 148.6 L 305.4 149.8 L 306.5 151 L 328.4 172.9 L 329.7 174.5 L 330.7 176 L 331.4 177.4 L 331.9 178.8 L 332.3 180.5 L 332.5 182.4 L 332.4 184.2 L 332.2 186.1 L 331.8 187.5 L 330.9 189.2 L 328.2 193.6 L 327 195.5 L 325.6 197.7 L 324.5 199.5 L 323.8 201 L 323.2 202.6 L 322.7 204.6 L 320 225 L 319.7 226.6 L 318.9 228.4 L 317.9 230 L 316.6 231.4 L 315.1 232.4 L 313.8 233.2 L 311.9 233.8 L 309.4 234.1 L 134.4 234.8 L 110.9 235 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    svgSource: 'osm',
    segments: [
      { type: 'straight', length: 700,  label: 'Start/Finish straight'       },
      { type: 'corner',   length: 72,   radius: 25,  direction: 'right', label: 'T1 hairpin'           },  // tight right — 165°
      { type: 'straight', length: 400                                         },
      { type: 'corner',   length: 38,   radius: 55,  direction: 'right', label: 'T3'                   },  // right — 40°
      { type: 'straight', length: 500                                         },
      { type: 'corner',   length: 49,   radius: 70,  direction: 'left',  label: 'T5'                   },  // left — 40°
      { type: 'straight', length: 350                                         },
      { type: 'corner',   length: 24,   radius: 35,  direction: 'right', label: 'T7'                   },  // right — 40° (CW circuit: right turn)
      { type: 'straight', length: 550                                         },
      { type: 'corner',   length: 56,   radius: 80,  direction: 'left',  label: 'T10'                  },  // left — 40°
      { type: 'straight', length: 80                                          },
      { type: 'corner',   length: 28,   radius: 40,  direction: 'right', label: 'T11'                  },  // right — 40°
      { type: 'straight', length: 350                                         },
      { type: 'corner',   length: 13,   radius: 22,  direction: 'left',  label: 'T13'                  },  // left — 34°
      { type: 'straight', length: 400                                         },
      { type: 'corner',   length: 29,   radius: 55,  direction: 'right', label: 'T15'                  },  // right — 30°
      { type: 'straight', length: 200                                         },
      { type: 'corner',   length: 84,   radius: 30,  direction: 'right', label: 'T17 hairpin'          },  // right — 160°
      { type: 'straight', length: 779,  label: 'Return to S/F'               },
    ],
  },

  mugello: {
    name: 'Mugello (5.245 km)',
    // GPS-derived from OpenStreetMap (ODbL) https://www.openstreetmap.org/copyright
    svgPath: "M 209.7 98.7 L 212.1 94.2 L 216.2 86.8 L 222 77.3 L 227.8 67.1 L 233.3 55.9 L 235.1 51.9 L 237.6 45.7 L 241.4 36.3 L 244.4 28.5 L 245.8 24.7 L 246.5 22.7 L 246.8 22 L 247 21.4 L 247.3 20.7 L 247.7 20.2 L 248 19.6 L 248.3 19.1 L 248.6 18.6 L 249 18.2 L 249.4 17.7 L 249.9 17.3 L 250.4 16.9 L 250.9 16.5 L 251.5 16.1 L 252.1 15.9 L 252.7 15.6 L 253.3 15.4 L 253.8 15.3 L 254.4 15.2 L 254.9 15 L 255.5 15 L 256.2 15 L 256.8 15.1 L 257.3 15.1 L 257.9 15.3 L 258.4 15.4 L 258.6 15.5 L 258.9 15.6 L 259.4 15.9 L 259.9 16.1 L 260.2 16.3 L 260.5 16.5 L 260.9 16.9 L 261.2 17.1 L 261.5 17.4 L 261.8 17.6 L 262 17.9 L 262.2 18.1 L 262.4 18.4 L 262.6 18.6 L 262.9 19 L 263.1 19.3 L 263.3 19.6 L 263.5 20 L 263.7 20.3 L 263.8 20.6 L 264 21 L 264.1 21.4 L 264.2 21.9 L 264.3 22.4 L 264.4 22.7 L 264.5 23 L 264.5 23.3 L 264.6 23.7 L 264.7 24.3 L 264.7 24.7 L 264.7 25.1 L 264.8 25.4 L 264.8 25.6 L 264.8 25.8 L 264.8 26.1 L 264.7 26.5 L 264.7 26.9 L 264.7 27.3 L 264.7 27.7 L 264.6 28.1 L 264.6 28.4 L 264.5 28.9 L 264.5 29.3 L 264.5 29.5 L 264.3 30.5 L 261.4 44.5 L 261.3 45.2 L 261.2 45.8 L 261.1 46.3 L 261 46.8 L 261 47.3 L 261 47.8 L 261 48.2 L 261 48.6 L 261.1 49.1 L 261.2 49.6 L 261.3 50.1 L 261.4 50.5 L 261.6 50.9 L 261.8 51.3 L 262.1 51.8 L 262.4 52.2 L 262.7 52.7 L 263.1 53.1 L 263.5 53.4 L 264.2 54 L 264.7 54.4 L 265.2 54.7 L 272.3 58.9 L 272.9 59.3 L 273.6 59.8 L 274 60.1 L 274.4 60.6 L 275 61.1 L 275.4 61.5 L 275.8 62 L 276.1 62.6 L 276.3 62.9 L 276.4 63.1 L 276.6 63.4 L 276.8 64 L 277 64.5 L 277.2 65.1 L 277.4 65.7 L 277.5 66.3 L 277.6 66.8 L 277.7 67.3 L 277.7 67.9 L 277.7 68.5 L 277.7 69.2 L 277.6 69.7 L 277.5 70.2 L 277.4 70.8 L 277.2 71.5 L 276.9 72.5 L 276.6 73.3 L 276.2 73.9 L 275.9 74.5 L 261.5 96 L 255 105.8 L 250.3 112.8 L 246.6 118.4 L 246.3 118.9 L 246 119.3 L 245.7 119.8 L 245.5 120.2 L 245.2 120.6 L 244.9 121.2 L 244.7 121.6 L 244.5 122 L 244.3 122.5 L 244.2 123 L 244.1 123.4 L 244 123.9 L 243.9 124.3 L 243.9 124.7 L 243.9 125.2 L 244 125.7 L 244.1 126.1 L 244.1 126.5 L 244.2 127.1 L 244.5 127.8 L 244.7 128.5 L 245.1 129.2 L 248.6 136.3 L 248.8 136.9 L 249 137.5 L 249.2 138 L 249.3 138.5 L 249.3 139 L 249.4 139.5 L 249.4 140.1 L 249.4 140.8 L 249.4 141.3 L 249.3 142 L 249.2 142.4 L 249.1 142.9 L 249 143.3 L 248.8 143.8 L 248.6 144.2 L 248.4 144.7 L 248.2 145 L 247.9 145.5 L 247.5 146.1 L 247.1 146.7 L 246.7 147.1 L 246.4 147.4 L 246.2 147.7 L 232.6 164.4 L 219 180.8 L 217.4 182.9 L 217.1 183.3 L 216.8 183.6 L 216.5 184 L 216.3 184.3 L 216 184.5 L 215.6 184.9 L 215.2 185.2 L 214.9 185.5 L 214.6 185.8 L 214.2 186 L 213.7 186.2 L 213.3 186.5 L 212.8 186.7 L 212.5 186.8 L 212.1 186.9 L 211.7 187 L 211.4 187.1 L 211 187.2 L 210.6 187.3 L 210.3 187.3 L 210 187.4 L 209.6 187.4 L 209.1 187.5 L 208.8 187.5 L 208.4 187.5 L 207.9 187.5 L 207.5 187.4 L 207.2 187.4 L 206.8 187.4 L 197.7 187.1 L 197 187.1 L 196.2 187.2 L 195.4 187.2 L 194.5 187.3 L 193.9 187.3 L 193.4 187.4 L 193 187.4 L 192.5 187.5 L 192.1 187.6 L 191.6 187.7 L 191.2 187.8 L 190.8 187.9 L 190.4 188 L 190 188.2 L 189.6 188.3 L 189.2 188.5 L 188.8 188.7 L 188.4 188.9 L 187.9 189.2 L 187.4 189.4 L 186.9 189.7 L 186.5 190 L 186 190.3 L 185.6 190.6 L 185.2 190.9 L 184.8 191.3 L 184.4 191.6 L 184 192 L 183.6 192.4 L 183.3 192.8 L 183 193.3 L 182.6 193.7 L 182.4 194.2 L 182.1 194.7 L 181.8 195.1 L 181.5 195.6 L 181.3 196.1 L 181.1 196.5 L 180.8 197 L 180.5 197.7 L 179.3 200.6 L 178.3 203.5 L 177.7 205.4 L 177.1 207 L 176.2 209.8 L 173.6 217.3 L 172.9 219.6 L 172.2 221.4 L 171.4 223.1 L 171.2 224 L 170.8 224.7 L 170.4 225.4 L 170.1 226 L 169.7 226.6 L 169.4 227.1 L 169 227.7 L 168.5 228.3 L 168.1 228.8 L 167.6 229.3 L 167.2 229.8 L 166.6 230.3 L 166 230.9 L 165.5 231.3 L 164.7 231.8 L 164.2 232.1 L 163.6 232.5 L 162.9 232.8 L 162.3 233.1 L 161.7 233.5 L 161 233.8 L 160.3 234 L 159.6 234.3 L 158.9 234.5 L 158.2 234.7 L 157.6 234.8 L 156.8 234.9 L 156 235 L 155.3 235 L 154.5 235 L 153.7 235 L 153.1 234.9 L 152.3 234.9 L 151.6 234.8 L 150.9 234.7 L 150.2 234.5 L 149.5 234.3 L 148.6 234.1 L 147.9 233.9 L 146.5 233.4 L 145.1 232.9 L 144.2 232.6 L 143.4 232.2 L 142.4 231.7 L 141.8 231.5 L 140.9 231 L 140.3 230.7 L 139.5 230.3 L 138.6 229.8 L 138.1 229.6 L 137.5 229.3 L 136.7 228.9 L 135.7 228.3 L 134.9 227.9 L 134.2 227.5 L 133.4 227.1 L 132.7 226.7 L 131.9 226.3 L 131 225.8 L 130.4 225.4 L 129.6 224.9 L 128.8 224.4 L 128.2 224 L 127.6 223.5 L 126.9 222.9 L 126.3 222.3 L 125.8 221.7 L 125.4 221.2 L 124.9 220.6 L 124.4 219.8 L 124 219 L 123.6 218.2 L 123.3 217.4 L 123.1 216.8 L 122.8 215.9 L 122.7 215.3 L 122.6 214.6 L 122.4 213.9 L 122.3 213 L 122.3 212.2 L 122.3 211.5 L 122.3 210.5 L 122.4 209.3 L 122.4 208.5 L 122.5 208.1 L 122.5 207.7 L 122.6 207.2 L 122.7 206.6 L 122.8 205.7 L 123 204.6 L 123.2 203.5 L 127.9 178.8 L 128.9 173.8 L 130.8 164.2 L 130.9 163.7 L 131 163.2 L 131.1 162.6 L 131.3 162.2 L 131.4 161.9 L 131.5 161.4 L 131.9 160.8 L 132.2 160.3 L 132.7 159.7 L 133.1 159.2 L 133.7 158.7 L 134.3 158.3 L 134.9 157.9 L 135.3 157.6 L 135.8 157.4 L 136.3 157.2 L 136.9 157 L 137.4 156.9 L 138 156.8 L 138.5 156.7 L 139.1 156.7 L 139.7 156.6 L 147.7 156.6 L 148.4 156.5 L 149.1 156.5 L 149.9 156.4 L 150.6 156.2 L 151.3 156 L 152 155.8 L 152.6 155.5 L 153.3 155.1 L 154 154.6 L 154.6 154.1 L 155.1 153.6 L 155.6 153.1 L 156 152.6 L 156.5 151.9 L 156.9 151.2 L 157.2 150.5 L 157.5 149.9 L 157.7 149.4 L 157.8 149 L 158.1 148.1 L 164.4 126.2 L 165.6 121.9 L 166.4 119 L 168.7 111 L 171 103 L 172.1 99.2 L 172.5 98.1 L 172.8 97.4 L 173 96.8 L 173.3 96.1 L 173.5 95.6 L 173.8 95.2 L 174 94.7 L 174.3 94.3 L 174.6 93.8 L 175 93.3 L 175.3 93 L 175.6 92.7 L 175.9 92.4 L 176.4 92 L 176.7 91.7 L 177 91.5 L 177.3 91.3 L 177.7 91 L 178.1 90.8 L 178.5 90.5 L 179 90.3 L 179.5 90.1 L 180 90 L 180.5 89.8 L 181.1 89.7 L 181.4 89.7 L 181.7 89.6 L 182.2 89.5 L 182.7 89.5 L 183.1 89.5 L 183.6 89.5 L 184 89.5 L 184.3 89.5 L 184.8 89.6 L 185.2 89.6 L 185.7 89.7 L 186.1 89.9 L 186.6 90.1 L 187 90.3 L 187.4 90.5 L 187.8 90.7 L 188.2 91 L 188.6 91.2 L 189 91.5 L 189.3 91.8 L 189.7 92.2 L 190 92.5 L 190.4 92.8 L 190.9 93.4 L 191.2 93.9 L 191.6 94.4 L 192 95.2 L 192.2 95.8 L 192.4 96.4 L 192.6 97 L 192.8 97.8 L 192.9 98.3 L 193 98.8 L 193 99.2 L 193 99.9 L 193 100.5 L 192.9 101.2 L 192.9 101.6 L 192.8 102 L 192.7 102.7 L 192.6 103.2 L 192.5 103.6 L 192.3 104.1 L 192.2 104.5 L 191.9 105 L 191.7 105.7 L 191.4 106.2 L 191.2 106.6 L 190.9 107.2 L 190.6 107.7 L 190.3 108.3 L 190.1 108.7 L 189.7 109.3 L 189.4 109.7 L 189.1 110.2 L 188.8 110.7 L 181.5 120 L 179 123.2 L 178.6 123.8 L 178.2 124.3 L 178 124.7 L 177.7 125.3 L 177.5 125.8 L 177.4 126.2 L 177.2 126.7 L 177.2 127 L 177.1 127.5 L 177 127.8 L 176.9 128.2 L 176.9 128.5 L 176.9 128.8 L 176.9 129.1 L 176.9 129.4 L 176.9 129.8 L 176.9 136.4 L 176.9 136.9 L 176.9 137.6 L 176.9 138.3 L 176.9 138.8 L 176.9 139.3 L 176.8 139.8 L 176.8 140.3 L 176.7 140.8 L 176.6 141.3 L 176.4 142.1 L 176.1 142.7 L 175.9 143.1 L 175.7 143.5 L 175 144.7 L 172.6 147.8 L 168 154.1 L 154 173 L 152.1 175.5 L 149.1 179.5 L 144 186.5 L 138.8 193.4 L 137.8 194.9 L 136.5 196.8 L 135.7 198.1 L 135.3 198.8 L 134.9 199.4 L 134.6 200 L 134.4 200.6 L 134.2 201.2 L 133.9 201.8 L 133.8 202.3 L 133.6 202.9 L 133.5 203.6 L 133.3 204.3 L 133.2 205 L 133.2 205.7 L 133.1 206.3 L 133.2 206.9 L 133.2 207 L 133.2 207.5 L 133.2 207.9 L 133.3 208.3 L 133.4 209 L 133.6 209.6 L 133.7 210 L 133.9 210.5 L 134.1 211 L 134.3 211.4 L 134.5 211.8 L 134.7 212.2 L 135 212.7 L 135.4 213.3 L 135.7 213.7 L 136 214.1 L 136.4 214.6 L 137 215.1 L 137.4 215.5 L 137.9 215.9 L 138.5 216.3 L 139.1 216.6 L 139.7 216.9 L 140.1 217.1 L 140.7 217.4 L 141.3 217.6 L 141.8 217.8 L 142.4 217.9 L 143.1 218 L 143.6 218.1 L 144.2 218.2 L 144.8 218.2 L 145.4 218.2 L 145.9 218.1 L 146.6 218.1 L 147.5 217.9 L 148.3 217.7 L 149.1 217.5 L 149.7 217.3 L 150.2 217.1 L 151 216.7 L 151.7 216.4 L 152.3 216 L 152.9 215.6 L 153.3 215.3 L 153.9 214.9 L 154.4 214.5 L 154.8 214.2 L 155.3 213.7 L 155.8 213.3 L 156.2 212.9 L 156.8 212.3 L 157.1 211.9 L 157.1 211.8 L 157.3 211.6 L 157.7 211.2 L 158 210.8 L 158.4 210.3 L 158.9 209.6 L 159.3 209.2 L 159.6 208.6 L 160 208 L 160.3 207.5 L 160.6 206.9 L 160.9 206.4 L 161.4 205.5 L 163.3 201.6 L 165.3 197 L 167.2 192.5 L 168.5 189.8 L 171 184.6 L 199.2 121.5 L 209.7 98.7 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    svgSource: 'osm',
    segments: [
      { type: 'straight', length: 1100, label: 'Start/Finish straight'       },
      { type: 'corner',   length: 66,   radius: 40,  direction: 'right', label: 'San Donato'           },  // tight right — 95°
      { type: 'straight', length: 150                                         },
      { type: 'corner',   length: 57,   radius: 65,  direction: 'right', label: 'Luco / Poggio Secco'  },  // right sweeper — 50°
      { type: 'straight', length: 100                                         },
      { type: 'corner',   length: 28,   radius: 35,  direction: 'right', label: 'Materassi'            },  // right — 46°
      { type: 'straight', length: 300                                         },
      { type: 'corner',   length: 98,   radius: 80,  direction: 'left',  label: 'Borgo San Lorenzo'    },  // left — 70°
      { type: 'straight', length: 500                                         },
      { type: 'corner',   length: 173,  radius: 110, direction: 'right', label: 'Casanova-Savelli'     },  // fast right — 90°
      { type: 'straight', length: 600                                         },
      { type: 'corner',   length: 84,   radius: 80,  direction: 'right', label: 'Arrabbiata 1+2'       },  // right sweeper — 60°
      { type: 'straight', length: 150                                         },
      { type: 'corner',   length: 42,   radius: 40,  direction: 'left',  label: 'Scarperia T1'         },  // chicane left — 60°
      { type: 'straight', length: 30                                          },
      { type: 'corner',   length: 42,   radius: 40,  direction: 'right', label: 'Scarperia T2'         },  // chicane right — 60°
      { type: 'straight', length: 300                                         },
      { type: 'corner',   length: 110,  radius: 70,  direction: 'right', label: 'Correntaio / Bucine'  },  // right — 90°
      { type: 'straight', length: 1315, label: 'Return to S/F'               },
    ],
  },

  // ── TUMFTM GPS circuits (LGPL-3.0) ───────────────────────────────────────────

  brands_hatch: {
    name: 'Brands Hatch GP (3.916 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 170.3 28.7 L 173.5 27.3 L 176.7 25.9 L 179.9 24.6 L 183.2 23.2 L 187.5 21.4 L 190.7 20 L 194 18.7 L 197.3 17.6 L 200.7 16.6 L 204.1 15.8 L 207.5 15.2 L 211 15.1 L 215.7 15 L 219.2 15.1 L 222.7 15.8 L 226 17 L 229 18.7 L 231.6 21 L 233.8 23.8 L 235.5 26.8 L 236.9 31.3 L 237.8 34.7 L 238.3 38.2 L 238.5 41.7 L 238.6 45.2 L 238.8 48.7 L 238.9 52.2 L 239 55.7 L 238.8 60.4 L 238.5 63.9 L 238.2 67.4 L 237.8 70.9 L 237.5 74.4 L 237.2 77.8 L 236.9 81.3 L 236.4 84.9 L 234.6 89 L 231.8 91.2 L 228.6 92.5 L 225.3 92 L 222.6 89.6 L 221.2 86.5 L 220.9 83 L 220.9 79.5 L 220.9 74.8 L 220.9 71.3 L 220.9 67.8 L 220.9 64.3 L 220.8 60.8 L 220.3 57.3 L 219.5 53.9 L 218.3 50.6 L 216.5 46.3 L 215.2 43 L 213.2 40.2 L 210.2 38.3 L 206.8 37.9 L 203.3 38.6 L 199.9 39.3 L 196.5 40.1 L 192 41.2 L 188.5 42 L 185.1 42.7 L 181.7 43.5 L 178.3 44.5 L 175 45.8 L 171.8 47.2 L 168.6 48.6 L 164.4 50.7 L 161.3 52.2 L 158.1 53.8 L 155 55.3 L 151.8 56.9 L 148.8 58.6 L 145.8 60.4 L 142.9 62.5 L 139.9 66 L 138.1 69 L 136.7 72.3 L 136.6 75.7 L 137.2 79.2 L 138.5 82.4 L 140.8 85 L 143.7 87 L 148 88.8 L 151.4 89.7 L 154.8 90.6 L 158.1 91.6 L 161.5 92.6 L 164.9 93.5 L 168.3 94.4 L 171.7 95.3 L 176.2 96.5 L 179.6 97.4 L 183 98.4 L 186.3 99.3 L 189.7 100.4 L 192.9 101.8 L 196.1 103.4 L 199.2 105 L 203.3 107.2 L 206.4 108.9 L 209.5 110.5 L 212.6 112.2 L 215.7 113.8 L 218.8 115.5 L 221.9 117.2 L 225 118.8 L 229.1 121 L 232.2 122.6 L 235.3 124.3 L 238.4 125.9 L 241.5 127.5 L 244.6 129.2 L 247.7 130.8 L 250.8 132.4 L 255 134.6 L 258.1 136.2 L 261.2 137.9 L 264.3 139.5 L 267.4 141.2 L 270.5 142.9 L 273.6 144.5 L 276.6 146.2 L 280.7 148.5 L 283.7 150.3 L 286.6 152.4 L 289.1 154.8 L 291.4 157.4 L 293.3 160.4 L 294.7 163.6 L 295.5 167 L 295.8 170.5 L 295.4 175.1 L 294.6 178.5 L 293.4 181.9 L 292.1 185.1 L 290.8 188.4 L 289.5 191.6 L 288.1 194.9 L 286.8 198.1 L 285 202.5 L 283.7 205.7 L 282.3 209 L 281 212.2 L 279.6 215.4 L 278.2 218.6 L 276.8 221.8 L 275.4 225.1 L 273.3 229.3 L 270.9 231.7 L 267.6 232.9 L 264.1 233.2 L 260.6 233.6 L 257.1 233.9 L 253.6 234.3 L 250.1 234.7 L 245.5 235 L 242 234.6 L 238.6 233.6 L 235.4 232.3 L 232.1 231 L 228.9 229.6 L 225.6 228.3 L 222.4 227.1 L 218 225.3 L 214.9 223.8 L 211.9 222 L 209.1 219.8 L 206.5 217.4 L 204.2 214.8 L 201.9 212.1 L 199.7 209.4 L 196.8 205.8 L 194.5 203 L 192.9 200 L 192.4 196.6 L 192.7 193.1 L 193 189.6 L 193.3 186.1 L 193.9 182.6 L 195.1 178.1 L 196.1 174.7 L 197.1 171.4 L 198 168 L 199 164.6 L 199.9 161.2 L 200.8 157.8 L 201.7 154.4 L 202.7 149.8 L 202.9 146.4 L 201.7 143.1 L 199.1 140.7 L 196 139.2 L 192.8 137.8 L 189.5 136.5 L 186.2 135.2 L 181.9 133.4 L 178.6 132.1 L 175.4 130.8 L 172.1 129.5 L 168.8 128.2 L 165.6 126.9 L 162.3 125.6 L 159.1 124.3 L 154.7 122.6 L 151.5 121.3 L 148.2 119.9 L 145 118.6 L 141.7 117.3 L 138.5 116 L 135.2 114.7 L 131.9 113.4 L 127.6 111.6 L 124.3 110.3 L 121.1 109 L 117.8 107.7 L 114.5 106.4 L 111.5 104.8 L 108.8 102.5 L 106.9 99.6 L 105.1 95.3 L 104.3 91.9 L 104.2 88.4 L 104.5 84.9 L 105.1 81.5 L 106 78.1 L 107 74.7 L 108.4 71.5 L 110.6 67.4 L 112.4 64.3 L 114.3 61.4 L 116.5 58.7 L 118.9 56.2 L 121.5 53.8 L 124.3 51.6 L 127.1 49.6 L 131.1 47.1 L 134.1 45.3 L 137.2 43.7 L 140.4 42.1 L 143.5 40.6 L 146.7 39.1 L 149.9 37.7 L 153.1 36.2 L 157.4 34.4 L 160.7 33 L 163.9 31.6 L 167.1 30.2 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Brands Hatch GP: compact, hilly circuit in Kent, UK. CW direction.
    // Paddock Hill Bend (tight right) → Druids hairpin → Graham Hill Bend → Surtees
    // → Hawthorn Hill → Westfield → Dingle Dell → Stirlings → Clearways → S/F
    segments: [
      { type: 'straight', length: 550,  label: 'Start/Finish straight'                },
      { type: 'corner',   length: 47,   radius: 30,  direction: 'right', label: 'Paddock Hill Bend'    },  // tight right — 90°
      { type: 'straight', length: 80                                                   },
      { type: 'corner',   length: 44,   radius: 14,  direction: 'right', label: 'Druids hairpin'       },  // hairpin right — 180°
      { type: 'straight', length: 150                                                  },
      { type: 'corner',   length: 52,   radius: 50,  direction: 'right', label: 'Graham Hill Bend'     },  // right — 60°
      { type: 'straight', length: 600                                                  },
      { type: 'corner',   length: 98,   radius: 80,  direction: 'right', label: 'Surtees'              },  // right — 70°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 52,   radius: 100, direction: 'right', label: 'Hawthorn Hill'        },  // right — 30°
      { type: 'straight', length: 100                                                  },
      { type: 'corner',   length: 251,  radius: 160, direction: 'right', label: 'Westfield Bend'       },  // fast right — 90°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 87,   radius: 250, direction: 'right', label: 'Dingle Dell'          },  // fast right — 20°
      { type: 'straight', length: 100                                                  },
      { type: 'corner',   length: 84,   radius: 80,  direction: 'right', label: 'Stirlings'            },  // right — 60°
      { type: 'straight', length: 300                                                  },
      { type: 'corner',   length: 140,  radius: 200, direction: 'right', label: 'Clearways'            },  // fast right — 40°
      { type: 'straight', length: 881,  label: 'Return to S/F'                        },  // filler
    ],
  },

  hockenheim: {
    name: 'Hockenheim GP (4.574 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 52 176.9 L 49.9 172.6 L 48.4 169.3 L 46.3 164.9 L 44.2 160.6 L 42.7 157.3 L 40.6 153 L 38.4 148.7 L 36.7 145.4 L 34.5 141.2 L 32.2 136.9 L 30.5 133.7 L 28.3 129.4 L 26.1 125.1 L 24.4 121.9 L 24 117.4 L 25.5 114 L 27.5 109.6 L 29.6 105.3 L 31.3 102.1 L 33.5 97.8 L 35.7 93.5 L 37.5 90.4 L 40.2 86.3 L 43.1 82.5 L 45.4 79.7 L 48.7 76.2 L 51.9 72.6 L 54.4 69.9 L 57.6 66.4 L 60.9 62.8 L 63.4 60.2 L 66.7 56.7 L 70.2 53.4 L 72.8 50.8 L 76.2 47.5 L 79.7 44.1 L 82.3 41.6 L 85.7 38.2 L 89.2 34.8 L 91.7 32.3 L 95.1 28.8 L 98.5 25.4 L 100.9 22.7 L 104.2 19.1 L 107.7 15.8 L 111.1 15 L 115.2 17.3 L 117.1 20.3 L 118.8 24.8 L 119.3 29.6 L 119.3 33.2 L 119.7 38.1 L 121.4 42.5 L 123.6 45.3 L 127.2 48.6 L 131.1 51.4 L 134.2 53.3 L 138.4 55.7 L 142.6 58.1 L 145.7 59.9 L 150 62.2 L 154.2 64.4 L 157.5 66 L 161.8 68.1 L 166.1 70.3 L 169.4 71.9 L 173.7 74 L 178.2 75.9 L 181.5 77.1 L 186.1 78.6 L 190.7 80 L 194.2 81 L 198.9 82.2 L 203.6 83.3 L 207.1 84 L 211.9 84.8 L 216.7 85.6 L 220.2 86.1 L 225 86.8 L 228.6 87.3 L 233.4 87.8 L 238.2 88.1 L 241.8 88.1 L 246.7 87.9 L 251.5 87.5 L 255.1 87.1 L 259.8 86.4 L 264.6 85.5 L 268.1 84.9 L 272.9 83.9 L 277.5 82.7 L 281 81.8 L 285.7 80.6 L 290.2 78.9 L 293.6 77.6 L 298.1 75.8 L 302.6 74 L 305.9 72.7 L 310.4 71 L 315 69.4 L 318.4 68.1 L 322.9 66.5 L 327.4 64.8 L 330.8 63.6 L 335.4 61.9 L 339.9 60.3 L 343.3 59.1 L 347.9 57.5 L 352.4 55.9 L 355.9 54.7 L 360.4 53.1 L 363.8 51.8 L 368.3 50 L 372.8 48.9 L 376 50.7 L 375.6 54.9 L 371.7 57.6 L 368.6 59.5 L 364.4 61.9 L 360.3 64.4 L 357.2 66.3 L 353.1 68.8 L 349 71.4 L 346 73.4 L 341.9 76 L 337.9 78.6 L 334.9 80.6 L 330.8 83.3 L 326.8 86 L 323.8 88 L 319.8 90.7 L 315.8 93.4 L 312.8 95.4 L 308.8 98.1 L 304.8 100.8 L 301.8 102.8 L 297.8 105.6 L 293.8 108.1 L 290.5 109.6 L 285.7 110.1 L 282.1 109.9 L 277.3 109.3 L 272.6 108.6 L 269 108 L 264.2 107.3 L 259.4 106.6 L 255.9 106 L 251.1 105.3 L 246.3 104.5 L 242.7 104 L 238 103.3 L 233.2 102.5 L 229.6 101.9 L 224.8 101.7 L 221.1 104 L 220.6 107.6 L 220.4 112.4 L 220.8 117.2 L 221.4 120.8 L 222.8 125.4 L 225.1 129.6 L 227.2 132.5 L 229.6 136.6 L 230.2 141.4 L 229.2 144.9 L 226.9 149.1 L 223.7 152.7 L 220.7 154.7 L 216.7 157.4 L 212.6 160 L 209.6 161.9 L 205.5 164.5 L 202.4 166.4 L 198.3 169 L 194.3 171.6 L 191.2 173.5 L 187.2 176.1 L 183.1 178.8 L 180.1 180.7 L 176 183.4 L 172 186 L 169 188 L 165 190.7 L 161 193.4 L 158 195.4 L 153.9 197.9 L 149.8 200.6 L 146.5 201.8 L 141.7 201.8 L 136.9 201 L 133.7 199.5 L 130 196.4 L 126.7 192.8 L 124.4 190.1 L 121.3 186.4 L 118.3 182.6 L 116 179.8 L 112.9 176.1 L 109.8 172.4 L 107.5 169.6 L 104.5 165.8 L 101.4 162.1 L 99.1 159.3 L 96.1 155.6 L 93.7 152.8 L 89.6 150.4 L 84.8 150 L 81.5 151.3 L 78.2 154.7 L 76.9 159.3 L 77.3 162.9 L 78.5 167.6 L 79.9 172.2 L 80.9 175.7 L 82.5 180.2 L 84.7 184.5 L 87.2 187.1 L 91.5 189.3 L 95.9 191.1 L 99.1 192.8 L 102.9 195.8 L 105.9 199.6 L 108 202.6 L 110.7 206.5 L 113.2 210.7 L 114.3 214 L 113.5 218.8 L 110.4 222.3 L 107.5 224.4 L 103.6 227.3 L 99.8 230.3 L 96.9 232.4 L 92.6 234.6 L 87.9 235 L 84.6 233.7 L 80.5 231.1 L 77.9 228.6 L 75.1 224.7 L 72.7 220.5 L 71.2 217.2 L 69.2 212.8 L 67.1 208.5 L 65.5 205.2 L 63.5 200.8 L 61.4 196.5 L 59.9 193.2 L 57.8 188.8 L 55.7 184.5 L 54.1 181.3 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Hockenheim GP (modern 2002+): CW direction.
    // S/F → Mercedes Arena complex (T1-T6) → Spitzkehre hairpin → Hall curves
    // → Motodrom chicane (T9-T10) → S/F
    segments: [
      { type: 'straight', length: 750,  label: 'Start/Finish straight (Zielgerade)'  },
      { type: 'corner',   length: 70,   radius: 50,  direction: 'right', label: 'Mercedes Arena T1'    },  // right — 80°
      { type: 'straight', length: 25                                                   },
      { type: 'corner',   length: 70,   radius: 50,  direction: 'left',  label: 'Mercedes Arena T2'    },  // left — 80°
      { type: 'straight', length: 25                                                   },
      { type: 'corner',   length: 79,   radius: 60,  direction: 'right', label: 'Mercedes Arena T3'    },  // right — 75°
      { type: 'straight', length: 400                                                  },
      { type: 'corner',   length: 50,   radius: 16,  direction: 'right', label: 'Spitzkehre hairpin'   },  // hairpin right — 180°
      { type: 'straight', length: 500                                                  },
      { type: 'corner',   length: 188,  radius: 180, direction: 'right', label: 'Hall curves'          },  // fast right sweeper — 60°
      { type: 'straight', length: 300                                                  },
      { type: 'corner',   length: 57,   radius: 45,  direction: 'right', label: 'Einfahrt T9'          },  // right — 72°
      { type: 'straight', length: 25                                                   },
      { type: 'corner',   length: 52,   radius: 45,  direction: 'left',  label: 'Einfahrt T10'         },  // left — 66°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 63,   radius: 50,  direction: 'right', label: 'Motodrom T11'         },  // right — 72°
      { type: 'straight', length: 25                                                   },
      { type: 'corner',   length: 58,   radius: 50,  direction: 'left',  label: 'Motodrom T12'         },  // left — 66°
      { type: 'straight', length: 25                                                   },
      { type: 'corner',   length: 126,  radius: 80,  direction: 'right', label: 'Motodrom T13'         },  // sweeping right — 90°
      { type: 'straight', length: 1006, label: 'Return to S/F'                        },  // filler
    ],
  },

  spielberg: {
    name: 'Red Bull Ring (4.318 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 291.1 203.4 L 287 204.5 L 281.6 205.9 L 277.6 207 L 272.2 208.5 L 268.2 209.6 L 262.8 211 L 258.8 212.1 L 253.4 213.5 L 249.4 214.6 L 244 216.1 L 240 217.2 L 235.9 218.2 L 230.6 219.7 L 226.5 220.8 L 221.2 222.2 L 217.1 223.3 L 211.7 224.8 L 207.7 225.8 L 202.3 227.3 L 198.3 228.4 L 192.9 229.8 L 188.9 230.9 L 184.9 232 L 179.5 233.4 L 175.5 234.5 L 170.1 235 L 167.2 232.1 L 164.7 227.1 L 162.6 223.5 L 159.5 218.9 L 157 215.5 L 153.7 211 L 151.3 207.6 L 148.1 203.1 L 145.7 199.7 L 143.3 196.3 L 140 191.7 L 137.6 188.3 L 134.4 183.8 L 131.9 180.4 L 128.7 175.9 L 126.3 172.5 L 123.1 167.9 L 121 164.3 L 118.2 159.5 L 116.2 155.8 L 114.3 152.1 L 111.7 147.2 L 109.7 143.5 L 107.3 138.5 L 105.4 134.7 L 103 129.7 L 101.3 125.9 L 98.9 120.9 L 97.2 117.1 L 94.9 112 L 93.1 108.2 L 91.4 104.4 L 89.1 99.4 L 87.3 95.6 L 84.9 90.5 L 82.8 86.9 L 79.7 82.3 L 77.4 78.9 L 74.2 74.2 L 71.7 71 L 68 66.8 L 65.1 63.8 L 62.2 60.8 L 58.3 56.8 L 55.4 53.8 L 51.6 49.8 L 48.6 46.8 L 44.7 42.8 L 41.8 39.8 L 37.9 35.9 L 34.9 32.9 L 31 29 L 28 26.1 L 25.4 22.8 L 25.7 17.7 L 29.8 17.1 L 35.3 16.4 L 39.4 15.8 L 45 15.3 L 49.2 15.1 L 54.7 15 L 58.9 15 L 64.5 15 L 68.6 15 L 72.8 15 L 78.4 15.2 L 82.5 15.6 L 88.1 16.1 L 92.2 16.5 L 97.7 17.5 L 101.8 18.3 L 107.3 19.3 L 111.4 20.2 L 116.8 21.3 L 120.9 22.1 L 126.4 23.2 L 130.5 24 L 134.6 24.8 L 140.1 25.8 L 144.2 26.6 L 149.6 27.7 L 153.7 28.5 L 159.2 29.5 L 163.3 30.3 L 168.8 31.3 L 172.9 31.9 L 178.4 32.6 L 182.6 33.1 L 186.7 33.4 L 192.3 33.8 L 196.5 34 L 202 34.2 L 206.2 34.4 L 211.8 34.6 L 215.9 34.8 L 221.5 35 L 225.7 35.2 L 231.2 35.5 L 235.4 35.7 L 239.6 35.8 L 245 36.9 L 247.9 39.8 L 247.9 45.2 L 246.1 49 L 243.1 53.7 L 240.6 57 L 237 61.3 L 234.1 64.3 L 229.9 67.8 L 226.4 70.2 L 222.7 72.2 L 217.7 74.5 L 213.8 75.9 L 208.4 77.2 L 204.2 77.8 L 198.7 78.5 L 194.5 78.6 L 189 78 L 184.9 77.4 L 179.3 76.8 L 175.2 76.4 L 171.1 75.7 L 165.6 74.5 L 161.5 73.7 L 156 72.6 L 152 71.8 L 146.5 70.8 L 142.3 70.5 L 136.8 71.1 L 132.9 72.5 L 128.2 75.4 L 125.2 78.4 L 122.3 83.1 L 121.2 87.1 L 120.7 91.2 L 121.4 96.8 L 122.7 100.7 L 125.3 105.6 L 127.3 109.3 L 130 114.2 L 132 117.8 L 134.8 122.7 L 136.9 126.2 L 139.7 131.1 L 141.7 134.7 L 143.9 138.3 L 147.4 142.6 L 150.6 145.2 L 155.6 147.7 L 159.7 148.6 L 165.1 148.3 L 169.2 147.2 L 174.2 144.9 L 177.4 142.3 L 180.9 137.9 L 183.3 134.5 L 186 131.3 L 190.2 127.8 L 193.6 125.2 L 198.2 122.2 L 202 120.4 L 207.3 118.6 L 211.3 117.7 L 216.8 116.9 L 221 116.6 L 226.6 116.3 L 230.7 116.1 L 234.9 115.9 L 240.5 115.7 L 244.6 115.6 L 250.2 115.7 L 254.4 115.7 L 260 115.8 L 264.1 115.8 L 269.7 115.7 L 273.9 115.6 L 279.4 115.5 L 283.6 115.4 L 287.8 115.3 L 293.4 115.2 L 297.5 115.1 L 303.1 114.9 L 307.3 114.8 L 312.8 114.7 L 317 114.6 L 322.6 114.5 L 326.8 114.4 L 332.3 114.3 L 336.5 114.2 L 340.7 114 L 346.2 114.1 L 350.3 114.9 L 355.4 117.1 L 358.6 119.8 L 361.7 124.3 L 363.2 128.2 L 364.7 133.6 L 365.9 137.6 L 367.5 142.9 L 368.7 146.9 L 370.2 152.3 L 371.4 156.3 L 372.6 160.3 L 374.2 165.7 L 374.6 169.7 L 371.5 174.3 L 368.2 176.8 L 363.5 179.8 L 359.9 182 L 355 184.6 L 351.3 186.4 L 346.1 188.6 L 342.1 189.7 L 338.1 190.8 L 332.7 192.2 L 328.7 193.3 L 323.3 194.7 L 319.3 195.8 L 313.9 197.3 L 309.9 198.3 L 304.5 199.8 L 300.5 200.9 L 295.1 202.3 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Red Bull Ring (Spielberg): compact, hilly CW circuit in Austria.
    // S/F straight (Zielderade) → T1 Castrol (fast right) → T2 Remus (hairpin right)
    // → T3 Schlossgold (fast right) → T4-T5 (right) → T6-T7 (chicane) → T8 Rindt (right)
    // → T9 Rindtkurve (right) → back to S/F
    segments: [
      { type: 'straight', length: 700,  label: 'Start/Finish straight'                },
      { type: 'corner',   length: 251,  radius: 180, direction: 'right', label: 'T1 Castrol curve'     },  // fast right — 80°
      { type: 'straight', length: 100                                                  },
      { type: 'corner',   length: 79,   radius: 25,  direction: 'right', label: 'T2 Remus hairpin'     },  // right hairpin — 181°
      { type: 'straight', length: 250                                                  },
      { type: 'corner',   length: 201,  radius: 230, direction: 'right', label: 'T3 Schlossgold'       },  // fast right — 50°
      { type: 'straight', length: 130                                                  },
      { type: 'corner',   length: 122,  radius: 140, direction: 'right', label: 'T4'                   },  // right — 50°
      { type: 'straight', length: 80                                                   },
      { type: 'corner',   length: 84,   radius: 60,  direction: 'right', label: 'T5 chicane exit'      },  // right — 80°
      { type: 'straight', length: 50                                                   },
      { type: 'corner',   length: 73,   radius: 60,  direction: 'left',  label: 'T6 chicane entry'     },  // left — 70°
      { type: 'straight', length: 50                                                   },
      { type: 'corner',   length: 126,  radius: 40,  direction: 'right', label: 'T7 hairpin'           },  // right hairpin — 181°
      { type: 'straight', length: 350                                                  },
      { type: 'corner',   length: 122,  radius: 100, direction: 'right', label: 'T8 Rindt curve'       },  // right — 70°
      { type: 'straight', length: 550,  label: 'Return to S/F'                        },  // filler
    ],
  },

  zandvoort: {
    name: 'Zandvoort (4.259 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 105.1 106.5 L 106.5 102.8 L 108.5 97.9 L 109.9 94.2 L 111.9 89.3 L 113.3 85.7 L 115.2 80.8 L 116.7 77.1 L 118.6 72.2 L 120.1 68.5 L 122 63.6 L 123.4 59.9 L 124.9 56.3 L 126.8 51.3 L 128.2 47.7 L 130.2 42.8 L 131.6 39.1 L 133.6 34.2 L 135 30.5 L 137 25.6 L 138.4 21.9 L 140.9 17.4 L 144.3 15.4 L 148.2 15 L 153.3 16 L 156.5 18.3 L 159 22.8 L 159.1 26.8 L 157.5 31.8 L 156.1 35.5 L 154.2 40.4 L 152.9 44.1 L 151 49 L 149.5 52.7 L 147.7 57.7 L 146.5 61.4 L 145.6 65.3 L 144.8 70.5 L 144.5 74.4 L 144.4 79.7 L 144.6 83.6 L 144.4 88.9 L 143.4 92.7 L 140.5 97.1 L 137.4 99.5 L 132.6 101.6 L 128.9 103.1 L 125.2 104.5 L 120.2 106.2 L 116.5 107.5 L 112.1 110.2 L 110.2 113.6 L 110.3 118.9 L 112 122.3 L 116.2 125.5 L 120 126.2 L 125.1 124.9 L 128.8 123.5 L 132.5 122.1 L 137.5 120.3 L 141.2 119 L 146.2 117.4 L 150 116.2 L 155.1 114.9 L 158.9 114.1 L 164.1 113.2 L 168.1 112.7 L 173.3 112.4 L 177.3 112.5 L 181.2 112.8 L 186.4 113.8 L 190.2 114.7 L 195.4 115.8 L 199.3 116.5 L 204.5 117.3 L 208.4 117.9 L 213.6 118.3 L 217.6 117.9 L 222.7 116.8 L 226.5 115.7 L 230.1 114 L 234.7 111.4 L 238.1 109.4 L 242.4 106.5 L 245.7 104.2 L 250.2 101.5 L 253.7 99.8 L 258.7 98 L 262.6 97.1 L 267.7 96.2 L 271.7 96.1 L 275.6 96.2 L 280.9 96.5 L 284.8 96.8 L 290.1 97 L 294.1 97.1 L 299.3 97.3 L 303.3 97.5 L 308.4 98.3 L 312.2 99.6 L 316.8 102.1 L 319.9 104.5 L 323.4 108.4 L 325.5 111.8 L 327 115.5 L 328.1 120.6 L 328.2 124.5 L 327.4 129.8 L 326.2 133.5 L 323.8 138.2 L 321.7 141.6 L 318.8 146 L 316.6 149.2 L 313.6 153.6 L 311.5 156.9 L 309.4 160.3 L 306.9 164.9 L 305.3 168.5 L 303.2 173.3 L 301.5 176.9 L 299.2 181.6 L 297.6 185.3 L 294.5 189.4 L 290.9 191 L 285.7 191.7 L 281.7 191.5 L 277.8 191.2 L 272.6 190.7 L 268.7 189.9 L 263.7 188.2 L 260.1 186.6 L 255.5 184.1 L 252.2 181.9 L 248 178.8 L 245 176.2 L 242.3 171.7 L 242.1 167.8 L 244 164.5 L 248.1 161.2 L 251.5 159.2 L 256.5 157.3 L 260.4 156.7 L 265.6 155.9 L 269.4 155.1 L 274.5 153.7 L 278.3 152.5 L 283.2 150.6 L 286.7 148.8 L 289.8 146.5 L 292.7 142 L 293.7 138.3 L 293.2 133.1 L 291.4 129.5 L 287.3 126.4 L 283.6 125.1 L 278.3 124.6 L 274.4 124.3 L 269.2 123.9 L 265.2 123.6 L 259.9 123.3 L 256 123.3 L 252.1 123.3 L 246.8 123.6 L 242.9 124 L 237.6 124.6 L 233.7 125.1 L 228.5 125.9 L 224.6 126.5 L 219.4 127.4 L 215.5 128.3 L 210.4 129.6 L 206.7 130.8 L 202.9 131.8 L 197.8 133.2 L 194.1 134.6 L 189.2 136.5 L 185.4 137.8 L 180.5 139.7 L 176.9 141.2 L 172.1 143.4 L 168.5 145.1 L 163.8 147.5 L 160.4 149.4 L 157 151.4 L 152.3 153.8 L 149 152.1 L 146.4 147.5 L 143.8 144.5 L 139.1 142.6 L 135.1 143.2 L 130.7 145.9 L 128.9 149.4 L 129.1 154.7 L 129.8 158.5 L 130.6 162.4 L 131.6 167.6 L 132.3 171.5 L 133.3 176.6 L 134.1 180.5 L 135.1 185.7 L 135.8 189.6 L 136.8 194.8 L 137.6 198.6 L 138.6 203.8 L 139.3 207.7 L 140.1 211.6 L 141 216.8 L 141.2 220.7 L 139.9 225.7 L 137.8 229.1 L 133.8 232.5 L 130.1 233.7 L 124.9 234.3 L 121 234.5 L 115.7 234.8 L 111.8 235 L 107.8 235 L 102.5 234.6 L 98.7 233.9 L 93.6 232.3 L 90.1 230.6 L 85.7 227.8 L 82.6 225.2 L 79.1 221.3 L 76.9 218.1 L 74.5 213.4 L 73.2 209.7 L 72.1 204.5 L 71.8 200.6 L 72 196.6 L 72.8 191.4 L 73.8 187.6 L 75.5 182.6 L 76.9 179 L 78.8 174 L 80.2 170.3 L 82.1 165.4 L 83.5 161.7 L 85.4 156.8 L 86.8 153.1 L 88.3 149.4 L 90.2 144.5 L 91.6 140.8 L 93.5 135.9 L 95 132.2 L 96.9 127.3 L 98.3 123.7 L 100.3 118.8 L 101.7 115.1 L 103.6 110.2 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Zandvoort: undulating circuit near the Dutch coast. CW direction.
    // S/F → Tarzan hairpin (tight right) → Gerlachbocht (fast right) → Hugenholtz
    // → Scheivlak → Hunserug → Panoramabocht → Arie Luyendijk chicane → Marlboro hairpin → S/F
    segments: [
      { type: 'straight', length: 550,  label: 'Start/Finish straight'                },
      { type: 'corner',   length: 79,   radius: 25,  direction: 'right', label: 'Tarzan hairpin'        },  // tight right — 181°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 174,  radius: 200, direction: 'right', label: 'Gerlachbocht'          },  // fast right sweeper — 50°
      { type: 'straight', length: 250                                                  },
      { type: 'corner',   length: 84,   radius: 80,  direction: 'right', label: 'Hugenholtz'            },  // right — 60°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 131,  radius: 100, direction: 'right', label: 'Scheivlak'             },  // right — 75°
      { type: 'straight', length: 100                                                  },
      { type: 'corner',   length: 125,  radius: 180, direction: 'right', label: 'Hunserug'              },  // fast right — 40°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 157,  radius: 150, direction: 'right', label: 'Panoramabocht'         },  // fast right — 60°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 24,   radius: 30,  direction: 'right', label: 'Arie Luyendijk T1'     },  // right — 46°
      { type: 'straight', length: 25                                                   },
      { type: 'corner',   length: 22,   radius: 30,  direction: 'left',  label: 'Arie Luyendijk T2'     },  // left — 42°
      { type: 'straight', length: 150                                                  },
      { type: 'corner',   length: 79,   radius: 25,  direction: 'right', label: 'Marlboro hairpin'      },  // tight right — 181°
      { type: 'straight', length: 309,  label: 'Return to S/F'                        },  // filler
    ],
  },

  sao_paulo: {
    name: 'São Paulo / Interlagos (4.309 km)',
    // GPS-derived from TUMFTM Racetrack Database (LGPL-3.0) https://github.com/TUMFTM/racetrack-database
    svgPath: "M 143 166.8 L 143.8 169.9 L 144.8 174 L 145.6 177 L 146.7 181.1 L 147.5 184.1 L 148.7 188.1 L 149.5 191.2 L 150.6 195.2 L 151.4 198.3 L 152.3 201.3 L 153.4 205.4 L 154.2 208.4 L 155.3 212.5 L 156.1 215.5 L 157.2 219.6 L 158.1 222.6 L 159.5 226.5 L 161.1 229.2 L 163.6 232.6 L 166.2 234.3 L 169.3 235 L 173.3 234.3 L 175.6 232.1 L 178.4 229 L 180.6 226.8 L 184.1 224.5 L 187.2 224 L 191 225.5 L 193.7 227.1 L 196.5 228.6 L 200.4 230.1 L 203.4 231 L 207.6 231.7 L 210.7 231.8 L 214.9 231.4 L 217.9 230.7 L 221.8 229.2 L 224.6 227.6 L 227.1 225.8 L 230.2 222.9 L 232.1 220.5 L 234.4 216.9 L 235.8 214.1 L 237.2 210.1 L 238 207.1 L 239.2 203.1 L 240.2 200.1 L 241.2 196 L 241.9 192.9 L 242.6 189.9 L 243.6 185.8 L 244.4 182.7 L 245.5 178.7 L 246.2 175.6 L 247.3 171.6 L 248.1 168.5 L 249.1 164.4 L 249.9 161.4 L 250.7 158.3 L 251.8 154.3 L 252.5 151.2 L 253.6 147.1 L 254.4 144.1 L 255.4 140 L 256.2 137 L 257.2 132.9 L 258 129.9 L 258.8 126.8 L 259.8 122.7 L 260.6 119.7 L 261.7 115.6 L 262.5 112.6 L 263.5 108.5 L 264.3 105.5 L 265.4 101.4 L 266.2 98.4 L 267 95.3 L 268 91.2 L 268.8 88.2 L 269.8 84.1 L 269.9 81 L 269.1 76.8 L 267.3 74.3 L 263.7 72.3 L 260.7 71.5 L 256.5 70.7 L 253.5 70.2 L 250.3 69.7 L 246.1 69.3 L 243 69.3 L 238.8 69.7 L 235.9 70.7 L 231.9 72.1 L 229 73.3 L 225.5 75.6 L 223.1 77.6 L 221 80 L 218.5 83.4 L 216.8 86 L 214.4 89.5 L 212.7 92.1 L 210.3 95.6 L 208.6 98.2 L 206.2 101.7 L 204.4 104.2 L 202.6 106.8 L 200.2 110.3 L 198.3 112.8 L 195.9 116.2 L 194 118.8 L 191.6 122.2 L 189.7 124.7 L 187.3 128.1 L 185.4 130.7 L 182.9 134 L 180.9 136.5 L 178.6 138.7 L 175.1 140.9 L 172 141.3 L 167.8 141.3 L 164.7 141 L 160.6 140 L 157.8 138.7 L 154.1 136.6 L 151.5 134.9 L 149.3 132.6 L 147.4 128.9 L 146.3 125.9 L 145.3 121.8 L 144.8 118.7 L 144.1 114.6 L 143.6 111.5 L 143 107.3 L 142.9 104.2 L 143.5 101.1 L 146.5 98.4 L 149.6 97.5 L 153.5 98.5 L 156.2 100.2 L 159.6 102.6 L 162.5 103.9 L 166.6 104 L 169.4 102.6 L 171.8 99.2 L 172.7 96.2 L 172.6 93.1 L 171.3 89.1 L 169.5 86.5 L 166.5 83.6 L 164.2 81.4 L 161.3 78.5 L 159.1 76.2 L 156.4 72.9 L 154.7 70.3 L 153.3 67.5 L 152.2 63.4 L 151.4 60.4 L 150.4 56.3 L 150.3 53.2 L 152.8 50.2 L 155.8 48.9 L 159.5 49.7 L 161.6 52.1 L 163.7 54.5 L 166.4 57.6 L 168.5 60 L 171.3 63.1 L 173.6 65.3 L 176.9 67.8 L 179.8 69.2 L 183.8 70.3 L 186.9 70.7 L 191.1 70.7 L 194.2 70.2 L 197.3 69.4 L 200.9 67.3 L 203.1 65.1 L 205.7 61.8 L 207.4 59.1 L 209.6 55.5 L 211.2 52.8 L 213.4 49.3 L 215.1 46.6 L 216.7 43.9 L 218.9 40.3 L 220.5 37.6 L 222.6 33.9 L 224 31.1 L 224.7 27 L 223.7 24.1 L 220.5 21.6 L 217.6 20.4 L 214.6 19.3 L 210.6 17.9 L 207.7 16.8 L 203.7 15.5 L 200.6 15 L 196.4 15.3 L 193.3 15.9 L 189.2 16.7 L 186.1 17.2 L 183 17.7 L 178.9 18.8 L 176 19.8 L 172.1 21.4 L 169.2 22.7 L 165.4 24.5 L 162.7 26 L 159.1 28.2 L 156.5 30 L 153.1 32.5 L 150.8 34.6 L 148.7 37 L 146.4 40.4 L 144.9 43.2 L 143.2 47.1 L 142.2 50.1 L 141.2 54.1 L 140.5 57.2 L 139.5 61.3 L 138.8 64.4 L 138.1 67.4 L 137.2 71.5 L 136.6 74.6 L 135.7 78.7 L 135 81.8 L 134.1 85.9 L 133.4 89 L 132.4 93.1 L 131.7 96.1 L 131.1 99.2 L 130.5 103.4 L 130.2 106.5 L 130.1 110.7 L 130.2 113.8 L 130.6 118 L 131.1 121.1 L 132 125.2 L 132.7 128.3 L 133.8 132.4 L 134.5 135.4 L 135.3 138.5 L 136.4 142.5 L 137.2 145.6 L 138.3 149.6 L 139.1 152.7 L 140.2 156.7 L 141.1 159.7 L 142.2 163.8 Z",
    svgViewBox: "0 0 400 250",
    svgIsGps: true,
    // Interlagos / São Paulo: CCW circuit. Famous for its undulating layout.
    // S/F → T1 Senna S (left chicane) → Curva do Sol (fast left) → Descida do Lago (left)
    // → Ferradura hairpin (left) → Mergulho (left-right) → Laranjinha (left)
    // → Pinheirinho (left) → Cotovelo (right) → Subida dos Boxes → S/F
    segments: [
      { type: 'straight', length: 600,  label: 'Start/Finish straight'                },
      { type: 'corner',   length: 37,   radius: 25,  direction: 'left',  label: 'Senna S T1'           },  // tight left — 85°
      { type: 'straight', length: 25                                                   },
      { type: 'corner',   length: 35,   radius: 25,  direction: 'right', label: 'Senna S T2'           },  // right — 80°
      { type: 'straight', length: 80                                                   },
      { type: 'corner',   length: 161,  radius: 130, direction: 'left',  label: 'Curva do Sol'         },  // fast left sweeper — 71°
      { type: 'straight', length: 250                                                  },
      { type: 'corner',   length: 140,  radius: 100, direction: 'left',  label: 'Descida do Lago'      },  // left — 80°
      { type: 'straight', length: 300                                                  },
      { type: 'corner',   length: 75,   radius: 16,  direction: 'left',  label: 'Ferradura hairpin'    },  // tight left hairpin — 270°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 70,   radius: 40,  direction: 'left',  label: 'Mergulho'             },  // left — 100°
      { type: 'straight', length: 300                                                  },
      { type: 'corner',   length: 84,   radius: 48,  direction: 'left',  label: 'Laranjinha'           },  // left — 100°
      { type: 'straight', length: 100                                                  },
      { type: 'corner',   length: 50,   radius: 40,  direction: 'left',  label: 'Pinheirinho'          },  // left — 72°
      { type: 'straight', length: 200                                                  },
      { type: 'corner',   length: 40,   radius: 40,  direction: 'right', label: 'Cotovelo'             },  // right — 57°
      { type: 'straight', length: 100                                                  },
      { type: 'corner',   length: 63,   radius: 50,  direction: 'left',  label: 'Subida dos Boxes'     },  // left — 72°
      { type: 'straight', length: 499,  label: 'Return to S/F'                        },  // filler
    ],
  },

};

// ── Vehicle capability inputs ─────────────────────────────────────────────────

export interface LapSimInput {
  mass:              number;   // kg
  peakMu:            number;   // tyre peak friction coeff
  brakingCapG:       number;   // g, max deceleration capability (typically 1.0–1.5)
  aeroCL:            number;
  aeroCD:            number;
  aeroReferenceArea: number;   // m²
  dragForce:  (V: number) => number;  // pre-bound drag fn
  driveForce: (V: number) => number;  // pre-bound gear-model drive force fn (Stage 10)
  // ── Stage 13B — Combined slip friction circle at corner entry ──────────────
  combSlipBrakeFrac?: number;  // 0–1: fraction of brakingCapG applied during corner entry (default 0 = off)
  // ── Stage 13C — Yaw transient time constant penalty ───────────────────────
  frontCaNPerRad?: number;     // N/rad — front axle cornering stiffness (enables transient penalty)
  rearCaNPerRad?:  number;     // N/rad — rear axle cornering stiffness
  /** Power-limited top speed (m/s). Caps maxCornerSpeed so high-CL fast corners
   *  don't produce physically impossible speeds (iteration divergence fix). */
  maxVehicleSpeedMs?: number;
}

// ── Per-segment and lap result ────────────────────────────────────────────────

export interface SegmentResult {
  type:          'corner' | 'straight';
  length:        number;
  timeSec:       number;
  entrySpeedKph: number;
  exitSpeedKph:  number;
  minSpeedKph:   number;
  maxSpeedKph:   number;
  label:         string;
  radius?:       number;  // m — corners only
}

export interface LapResult {
  totalTimeSec:   number;
  totalLengthM:   number;
  avgSpeedKph:    number;
  maxSpeedKph:    number;
  minCornerKph:   number;
  segments:       SegmentResult[];
}

// ── Physics helpers ───────────────────────────────────────────────────────────

/** Max cornering speed at radius R, accounting for aero downforce (iterative).
 *  Stage 13B: friction circle — lateral capacity reduced by corner-entry braking demand. */
function maxCornerSpeed(R: number, inp: LapSimInput): number {
  const { mass, peakMu, aeroCL, aeroReferenceArea: A } = inp;
  const brakeFrac   = inp.combSlipBrakeFrac ?? 0;           // 0 = no combined-slip correction
  const brakeDemand = inp.brakingCapG * brakeFrac;          // g units
  let V = Math.sqrt(peakMu * G * R);  // initial guess (no aero)
  for (let i = 0; i < 10; i++) {
    const downforce = 0.5 * RHO_AIR * V * V * A * aeroCL;
    const muEff = peakMu * (mass * G + downforce) / (mass * G);
    // Stage 13B: ay_max = sqrt(muEff² − brakeDemand²) — friction circle
    const ayMaxG = brakeDemand > 0
      ? Math.sqrt(Math.max(muEff * muEff - brakeDemand * brakeDemand, 0.01))
      : muEff;
    V = Math.sqrt(ayMaxG * G * R);
  }
  // Cap at power-limited top speed: a car cannot corner faster than it can drive.
  // Without this, high-CL fast corners (e.g. Blanchimont R=230, CL=4) diverge — the
  // aero downforce feedback loop produces impossible speeds (>400 km/h for 150kW cars).
  if (inp.maxVehicleSpeedMs !== undefined) V = Math.min(V, inp.maxVehicleSpeedMs);
  return V;
}

/** Brake deceleration at speed V, accounting for aero (aerodynamic braking boost). */
function brakeDecel(V: number, inp: LapSimInput): number {
  const { mass, aeroCL, aeroReferenceArea: A } = inp;
  const downforce = 0.5 * RHO_AIR * V * V * A * aeroCL;
  // More downforce → more brake force available (friction limit rises)
  const aeroBoost = downforce * inp.peakMu;
  return inp.brakingCapG * G + aeroBoost / mass;
}

/** Straight integration: returns time and speed profile from V0 to the segment end,
 *  limiting to V_target_exit at the end (braking zone) and V_max_straight. */
function simulateStraight(
  length: number,
  V_entry: number,
  V_exit_target: number,
  inp: LapSimInput,
): { timeSec: number; vMax: number; vExit: number } {
  const DT = 0.005;   // s, Euler step

  // Backward pass: compute braking requirement from exit end
  // Braking distance from V_entry to V_exit_target:
  // Use simplified: d_brake ≈ V²/(2a) differential, numerical
  // Forward Euler is fine for 5ms steps.

  let V = V_entry;
  let x = 0;
  let t = 0;
  let vMax = V;

  while (x < length) {
    const Fdrive   = inp.driveForce(V);
    const Fdrag    = inp.dragForce(V);
    const a_drive  = (Fdrive - Fdrag) / inp.mass;

    // Check if we need to start braking to hit V_exit_target
    const dist_remaining = length - x;
    const a_brake        = brakeDecel(V, inp);
    // Braking distance from current V to V_exit_target
    const d_brake_needed = (V * V - V_exit_target * V_exit_target) / (2 * a_brake);
    const shouldBrake    = d_brake_needed >= dist_remaining && V > V_exit_target;

    let a: number;
    if (shouldBrake) {
      a = -a_brake;
    } else {
      a = a_drive;
    }

    V += a * DT;
    V  = Math.max(V, 0.5);  // never stop
    x += V * DT;
    t += DT;
    if (V > vMax) vMax = V;
  }

  return { timeSec: t, vMax, vExit: Math.max(V, V_exit_target * 0.95) };
}

// ── Main lap time function ────────────────────────────────────────────────────

export function computeLapTime(layout: TrackLayout, inp: LapSimInput): LapResult {
  const { segments } = layout;
  const n = segments.length;

  // Pre-compute max corner speed for each corner segment
  const vCorner: number[] = segments.map(seg =>
    seg.type === 'corner' && seg.radius ? maxCornerSpeed(seg.radius, inp) : Infinity
  );

  // Build speed profile: corner entry = corner exit = vCorner
  const segResults: SegmentResult[] = [];
  let totalTime = 0;
  let vPrev = vCorner.find(v => isFinite(v)) ?? 20;  // start at first corner speed

  for (let i = 0; i < n; i++) {
    const seg = segments[i];

    if (seg.type === 'corner' && seg.radius) {
      const vC = vCorner[i];

      // Stage 13C — Yaw transient time penalty (Gillespie Ch.6 first-order yaw time constant)
      // τ_yaw = m × V_entry / (2 × (CαF + CαR))
      // t_penalty = τ_yaw × max(0, 1 − V_corner/V_entry) × 0.5
      // (0.5 = empirical driver partial-correction factor; validated ~0.057s at a hairpin)
      let tPenalty = 0;
      const frontCa = inp.frontCaNPerRad;
      const rearCa  = inp.rearCaNPerRad;
      if (frontCa !== undefined && rearCa !== undefined
          && frontCa > 0 && rearCa > 0 && vPrev > vC) {
        const tau   = inp.mass * vPrev / (2 * (frontCa + rearCa));
        tPenalty    = tau * (1 - vC / vPrev) * 0.5;
      }

      const t  = seg.length / vC + tPenalty;
      totalTime += t;
      segResults.push({
        type: 'corner', length: seg.length, timeSec: t,
        entrySpeedKph: vC * 3.6, exitSpeedKph: vC * 3.6,
        minSpeedKph: vC * 3.6, maxSpeedKph: vC * 3.6,
        label: seg.label ?? `R${seg.radius}m`,
        radius: seg.radius,
      });
      vPrev = vC;

    } else if (seg.type === 'straight') {
      // Exit target = speed of next corner (scan forward in case of consecutive straights or lap wrap)
      let nextCornerSpeed = Infinity;
      for (let j = 1; j <= n; j++) {
        const v = vCorner[(i + j) % n];
        if (isFinite(v)) { nextCornerSpeed = v; break; }
      }
      const vExitTarget = isFinite(nextCornerSpeed) ? nextCornerSpeed : vPrev;

      const { timeSec, vMax, vExit } = simulateStraight(seg.length, vPrev, vExitTarget, inp);
      totalTime += timeSec;
      segResults.push({
        type: 'straight', length: seg.length, timeSec,
        entrySpeedKph: vPrev * 3.6, exitSpeedKph: vExit * 3.6,
        minSpeedKph: Math.min(vPrev, vExit) * 3.6, maxSpeedKph: vMax * 3.6,
        label: seg.label ?? `${seg.length}m straight`,
      });
      vPrev = vExit;  // use actual simulated exit speed — keeps heatmap/animation continuous
    }
  }

  const totalLength = segments.reduce((s, seg) => s + seg.length, 0);
  const avgSpeedKph  = (totalLength / totalTime) * 3.6;
  const maxSpeedKph  = Math.max(...segResults.map(s => s.maxSpeedKph));
  const minCornerKph = Math.min(...segResults.filter(s => s.type === 'corner').map(s => s.minSpeedKph));

  return { totalTimeSec: totalTime, totalLengthM: totalLength, avgSpeedKph, maxSpeedKph, minCornerKph, segments: segResults };
}

// ── High-resolution lap trace ────────────────────────────────────────────────

export interface TracePoint {
  distM:    number;   // cumulative distance from start (m)
  timeSec:  number;   // cumulative time from start (s)
  speedKph: number;   // instantaneous speed
  longG:    number;   // longitudinal G: +ve = accelerating, -ve = braking
  latG:     number;   // lateral G magnitude (always ≥ 0)
  zone:     'braking' | 'trail-braking' | 'cornering' | 'full-throttle';
}

const TRACE_STEP_M = 5;  // target distance between trace points (m)

/** Build a high-resolution physics trace of one lap.
 *  Re-runs the same Euler integration as computeLapTime but records state
 *  every ~5 m, enabling smooth animation and zone-accurate colouring. */
export function buildLapTrace(layout: TrackLayout, inp: LapSimInput): TracePoint[] {
  const { segments } = layout;
  const n = segments.length;
  const DT = 0.005;

  const vCorner: number[] = segments.map(seg =>
    seg.type === 'corner' && seg.radius ? maxCornerSpeed(seg.radius, inp) : Infinity
  );

  const trace: TracePoint[] = [];
  let cumDist = 0;
  let cumTime = 0;
  let vPrev = vCorner.find(v => isFinite(v)) ?? 20;

  // Initial point
  trace.push({ distM: 0, timeSec: 0, speedKph: vPrev * 3.6, longG: 0, latG: 0, zone: 'full-throttle' });

  for (let i = 0; i < n; i++) {
    const seg = segments[i];

    if (seg.type === 'corner' && seg.radius) {
      const vC    = vCorner[i];
      const latG  = (vC * vC) / (seg.radius * G);
      const steps = Math.max(1, Math.round(seg.length / TRACE_STEP_M));
      const stepLen  = seg.length / steps;
      const stepTime = stepLen / vC;
      for (let s = 0; s < steps; s++) {
        cumDist += stepLen;
        cumTime += stepTime;
        trace.push({ distM: cumDist, timeSec: cumTime, speedKph: vC * 3.6, longG: 0, latG, zone: 'cornering' });
      }
      vPrev = vC;

    } else if (seg.type === 'straight') {
      let nextCornerSpeed = Infinity;
      for (let j = 1; j <= n; j++) {
        const v = vCorner[(i + j) % n];
        if (isFinite(v)) { nextCornerSpeed = v; break; }
      }
      const vExitTarget = isFinite(nextCornerSpeed) ? nextCornerSpeed : vPrev;

      let V = vPrev;
      let x = 0;
      let lastPushDist = cumDist;
      let lastLongG = 0;
      let lastZone: TracePoint['zone'] = 'full-throttle';

      while (x < seg.length) {
        const Fdrive = inp.driveForce(V);
        const Fdrag  = inp.dragForce(V);
        const a_drive = (Fdrive - Fdrag) / inp.mass;
        const a_brake = brakeDecel(V, inp);
        const dist_remaining = seg.length - x;
        const d_brake_needed = (V * V - vExitTarget * vExitTarget) / (2 * a_brake);
        const shouldBrake    = d_brake_needed >= dist_remaining && V > vExitTarget;
        const a = shouldBrake ? -a_brake : a_drive;

        lastLongG = a / G;
        if      (lastLongG < -0.3)  lastZone = 'braking';
        else if (lastLongG < -0.05) lastZone = 'trail-braking';
        else                         lastZone = 'full-throttle'; // driver is at full throttle (not braking)

        V += a * DT;
        V  = Math.max(V, 0.5);
        const dx = V * DT;
        x       += dx;
        cumDist += dx;
        cumTime += DT;

        if (cumDist - lastPushDist >= TRACE_STEP_M) {
          trace.push({ distM: cumDist, timeSec: cumTime, speedKph: V * 3.6, longG: lastLongG, latG: 0, zone: lastZone });
          lastPushDist = cumDist;
        }
      }
      // Segment-end point ensures no gaps in trace
      trace.push({ distM: cumDist, timeSec: cumTime, speedKph: V * 3.6, longG: lastLongG, latG: 0, zone: lastZone });
      vPrev = Math.max(V, vExitTarget * 0.95);
    }
  }

  return trace;
}

// ── Race simulation ───────────────────────────────────────────────────────────

export interface LapData {
  lap:               number;
  lapTimeSec:        number;
  s1Sec:             number;    // sector 1 time (first 1/3 of track distance)
  s2Sec:             number;    // sector 2 time (middle 1/3)
  s3Sec:             number;    // sector 3 time (final 1/3)
  tyreTempC:         number;    // tyre temperature at end of lap
  muFraction:        number;    // effective μ fraction vs optimal (1.0 = perfect)
  fuelMassKg:        number;    // fuel remaining at start of this lap
  gapToFastestSec:   number;    // delta to fastest lap (0 for the fastest lap itself)
}

export interface RaceResult {
  laps:           LapData[];
  fastestLapSec:  number;
  fastestLapNum:  number;       // 1-based
  totalTimeSec:   number;
}

/**
 * Multi-lap race simulation.
 *
 * Per-lap evolution:
 *   Tyre temperature: exponential warmup toward optTyreTempC (time-constant 2.5 laps),
 *   then linear drift (degradation, ~1.5°C/lap) beyond optimum.
 *   μ fraction: Gaussian bell curve centred at optTyreTempC.
 *   Fuel mass: decreases by fuelBurnRateKgPerLap each lap (lighter car = faster).
 *
 * Sectors: split at 1/3 and 2/3 of cumulative track distance (arbitrary sectors,
 *   not the actual circuit sector boundaries).
 */
export function simulateRace(
  layout:                  TrackLayout,
  baseInp:                 LapSimInput,
  numLaps:                 number,
  fuelLoadKg:              number,   // total fuel at race start (kg)
  fuelBurnRateKgPerLap:    number,   // kg consumed per lap
  startTyreTempC:          number,   // tyre temperature at lap 1 (cold, e.g. 30°C)
  optTyreTempC:            number,   // optimal tyre temperature (peak μ)
  halfWidthC:              number,   // Gaussian half-width (°C) — μ drops 60% at ±halfWidth
  floorMu:                 number,   // minimum μ fraction at extreme temperatures
): RaceResult {
  const WARMUP_TC   = 2.5;    // laps (time constant for exponential warmup)
  const DEG_RATE    = 1.5;    // °C per lap drift above optimal temperature

  const laps: LapData[] = [];
  let tyreTempC = startTyreTempC;

  for (let lap = 1; lap <= numLaps; lap++) {
    // Tyre temperature evolution (before lap starts — affects this lap's μ)
    if (tyreTempC < optTyreTempC) {
      tyreTempC += (optTyreTempC - tyreTempC) * (1 - Math.exp(-1 / WARMUP_TC));
    } else {
      tyreTempC += DEG_RATE;
    }

    // μ fraction: Gaussian bell centred at optTyreTempC
    const dt = tyreTempC - optTyreTempC;
    const muFraction = floorMu + (1 - floorMu) * Math.exp(-(dt * dt) / (2 * halfWidthC * halfWidthC));

    // Fuel remaining at START of this lap (lap 1 = full load)
    const fuelMassKg = Math.max(0, fuelLoadKg - (lap - 1) * fuelBurnRateKgPerLap);

    // Effective vehicle mass: base mass already contains initial fuel;
    // subtract burned fuel to get current mass.
    const lapMass = baseInp.mass - fuelLoadKg + fuelMassKg;

    const lapInp: LapSimInput = {
      ...baseInp,
      mass:    Math.max(lapMass, baseInp.mass * 0.5),  // safety floor
      peakMu:  baseInp.peakMu * muFraction,
    };

    const lapResult = computeLapTime(layout, lapInp);

    // Sector splits at 1/3 and 2/3 of total distance
    const totalLen  = lapResult.totalLengthM;
    const s1End     = totalLen / 3;
    const s2End     = totalLen * 2 / 3;
    let s1Sec = 0, s2Sec = 0, s3Sec = 0;
    let cumLen = 0;
    let sector = 1;

    for (const seg of lapResult.segments) {
      const segStart = cumLen;
      cumLen += seg.length;

      if (sector === 1) {
        if (cumLen <= s1End) {
          s1Sec += seg.timeSec;
        } else {
          const frac = seg.length > 0 ? (s1End - segStart) / seg.length : 0;
          s1Sec += seg.timeSec * frac;
          // The rest might cross s2End in the same segment — handle below
          const rem = seg.timeSec * (1 - frac);
          const remLen = seg.length * (1 - frac);
          if (cumLen <= s2End) {
            s2Sec += rem;
            sector = 2;
          } else {
            const frac2 = remLen > 0 ? (s2End - s1End) / remLen : 0;
            s2Sec += rem * frac2;
            s3Sec += rem * (1 - frac2);
            sector = 3;
          }
        }
      } else if (sector === 2) {
        if (cumLen <= s2End) {
          s2Sec += seg.timeSec;
        } else {
          const frac = seg.length > 0 ? (s2End - segStart) / seg.length : 0;
          s2Sec += seg.timeSec * frac;
          s3Sec += seg.timeSec * (1 - frac);
          sector = 3;
        }
      } else {
        s3Sec += seg.timeSec;
      }
    }

    laps.push({
      lap, lapTimeSec: lapResult.totalTimeSec,
      s1Sec, s2Sec, s3Sec,
      tyreTempC, muFraction, fuelMassKg,
      gapToFastestSec: 0,  // filled below
    });
  }

  // Fill gap-to-fastest
  const fastestLapSec = Math.min(...laps.map(l => l.lapTimeSec));
  const fastestLapNum = laps.findIndex(l => l.lapTimeSec === fastestLapSec) + 1;
  for (const l of laps) l.gapToFastestSec = l.lapTimeSec - fastestLapSec;

  return {
    laps,
    fastestLapSec,
    fastestLapNum,
    totalTimeSec: laps.reduce((s, l) => s + l.lapTimeSec, 0),
  };
}
