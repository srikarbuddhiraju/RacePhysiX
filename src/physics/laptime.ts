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
}

export const TRACK_PRESETS: Record<string, TrackLayout> = {
  club: {
    name: 'Club circuit (~1.9 km)',
    segments: [
      { type: 'corner',   length: 63,  radius: 20  },  // hairpin
      { type: 'straight', length: 300              },
      { type: 'corner',   length: 94,  radius: 60  },  // chicane exit
      { type: 'straight', length: 150              },
      { type: 'corner',   length: 126, radius: 80  },  // medium
      { type: 'straight', length: 400              },  // main straight
      { type: 'corner',   length: 157, radius: 100 },  // fast sweeper
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 94,  radius: 60  },
      { type: 'straight', length: 250              },
      { type: 'corner',   length: 47,  radius: 30  },  // tight
      { type: 'straight', length: 200              },
    ],
  },
  karting: {
    name: 'Karting circuit (~1.0 km)',
    segments: [
      { type: 'corner',   length: 47,  radius: 15  },  // hairpin
      { type: 'straight', length: 150              },
      { type: 'corner',   length: 63,  radius: 20  },
      { type: 'straight', length: 80               },
      { type: 'corner',   length: 79,  radius: 25  },
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 50,  radius: 16  },
      { type: 'straight', length: 120              },
      { type: 'corner',   length: 50,  radius: 20  },
      { type: 'straight', length: 100              },
      { type: 'corner',   length: 47,  radius: 15  },
      { type: 'straight', length: 50               },
    ],
  },
  gt_circuit: {
    name: 'GT circuit (~3.2 km)',
    segments: [
      { type: 'straight', length: 600              },  // main straight
      { type: 'corner',   length: 94,  radius: 60  },  // hairpin
      { type: 'straight', length: 300              },
      { type: 'corner',   length: 157, radius: 100 },
      { type: 'straight', length: 250              },
      { type: 'corner',   length: 251, radius: 160 },  // fast
      { type: 'straight', length: 400              },
      { type: 'corner',   length: 314, radius: 200 },  // fast sweeper
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 126, radius: 80  },
      { type: 'straight', length: 350              },
      { type: 'corner',   length: 94,  radius: 30  },
      { type: 'straight', length: 400              },
    ],
  },
  formula_test: {
    name: 'Formula test track (~2.1 km)',
    segments: [
      { type: 'corner',   length: 47,  radius: 15  },  // hairpin
      { type: 'straight', length: 500              },
      { type: 'corner',   length: 94,  radius: 60  },
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 157, radius: 100 },
      { type: 'straight', length: 300              },
      { type: 'corner',   length: 251, radius: 160 },
      { type: 'straight', length: 250              },
      { type: 'corner',   length: 94,  radius: 60  },
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 63,  radius: 20  },
      { type: 'straight', length: 200              },
    ],
  },

  // ── Real-world circuits (simplified schematic — correct corner radii & track length) ──

  monza: {
    name: 'Monza (5.793 km)',
    // Monza: elongated oval-ish with chicanes on both ends.
    // Start/finish at top-left going right. Rettifilo chicane top-right.
    // Curva Grande sweeps right down. Roggia chicane. Lesmo 1+2 rightward.
    // Long back straight left. Ascari chicane. Parabolica tight hairpin bottom-left.
    segments: [
      { type: 'straight', length: 1050, label: 'Start/Finish straight'            },
      { type: 'corner',   length: 18,  radius: 14, direction: 'right', label: 'Rettifilo T1'   },  // chicane T1 (~75°)
      { type: 'straight', length: 50                                               },
      { type: 'corner',   length: 16,  radius: 12, direction: 'left',  label: 'Rettifilo T2'   },  // chicane T2 (~75°)
      { type: 'corner',   length: 371, radius: 185, direction: 'left', label: 'Curva Grande'   },  // big left sweep (~115°) — fixed for circuit closure
      { type: 'straight', length: 80                                               },
      { type: 'corner',   length: 28,  radius: 20, direction: 'right', label: 'Roggia T1'      },  // chicane T1 (~80°)
      { type: 'straight', length: 40                                               },
      { type: 'corner',   length: 25,  radius: 18, direction: 'left',  label: 'Roggia T2'      },  // chicane T2 (~80°)
      { type: 'straight', length: 220                                              },
      { type: 'corner',   length: 75,  radius: 48, direction: 'left',  label: 'Lesmo 1'        },  // medium-fast left (~90°)
      { type: 'straight', length: 155                                              },
      { type: 'corner',   length: 52,  radius: 40, direction: 'left',  label: 'Lesmo 2'        },  // (~75°)
      { type: 'straight', length: 1488, label: 'Back straight'                    },  // Serraglio / filler (-69m vs original to close circuit)
      { type: 'corner',   length: 18,  radius: 14, direction: 'right', label: 'Ascari T1'      },  // (~75°)
      { type: 'straight', length: 50                                               },
      { type: 'corner',   length: 18,  radius: 14, direction: 'left',  label: 'Ascari T2'      },  // (~75°)
      { type: 'straight', length: 75                                               },
      { type: 'corner',   length: 18,  radius: 14, direction: 'right', label: 'Ascari T3'      },  // (~75°)
      { type: 'corner',   length: 208, radius: 78, direction: 'left',  label: 'Parabolica'     },  // long left sweep (~153°)
      { type: 'straight', length: 1738, label: 'Pit straight'                     },
    ],
  },

  monaco: {
    name: 'Monaco (3.337 km)',
    // Monaco: tight street circuit. S/F at bottom-left going right.
    // Sainte Devote right, uphill to Casino, hairpin, Portier, tunnel,
    // chicane at harbour, Tabac, Swimming Pool, Rascasse/Noghes, back to start.
    segments: [
      { type: 'straight', length: 270, label: 'Start/Finish'                                              },
      { type: 'corner',   length: 21,  radius: 15, direction: 'right', label: 'Sainte Dévote'             },  // (~80°)
      { type: 'straight', length: 588, label: 'Beau Rivage hill'                                          },
      { type: 'corner',   length: 38,  radius: 24, direction: 'right', label: 'Casino Square'             },  // reduced 150°→90° for realism
      { type: 'straight', length: 70                                                                       },
      { type: 'corner',   length: 39,  radius: 25, direction: 'right', label: 'Mirabeau'                  },  // reduced 120°→90° for realism
      { type: 'corner',   length: 41,  radius: 13, direction: 'right', label: 'Grand Hotel Hairpin'       },  // (~180°)
      { type: 'straight', length: 150                                                                      },
      { type: 'corner',   length: 28,  radius: 20, direction: 'right', label: 'Portier'                   },  // (~80°)
      { type: 'straight', length: 418, label: 'Tunnel'                                                    },
      { type: 'corner',   length: 24,  radius: 17, direction: 'left',  label: 'Nouvelle Chicane T1'       },  // (~80° left)
      { type: 'straight', length: 35                                                                       },
      { type: 'corner',   length: 20,  radius: 14, direction: 'right', label: 'Nouvelle Chicane T2'       },  // (~80° right)
      { type: 'straight', length: 85                                                                       },
      { type: 'corner',   length: 24,  radius: 18, direction: 'right', label: 'Tabac'                     },  // (~75°)
      { type: 'straight', length: 130, label: 'Swimming Pool approach'                                    },
      { type: 'corner',   length: 24,  radius: 17, direction: 'left',  label: 'Swimming Pool S1'          },  // (~80° left)
      { type: 'straight', length: 45                                                                       },
      { type: 'corner',   length: 20,  radius: 14, direction: 'right', label: 'Swimming Pool S2'          },  // (~80° right)
      { type: 'straight', length: 55                                                                       },
      { type: 'corner',   length: 26,  radius: 15, direction: 'right', label: 'Rascasse'                  },  // (~100°)
      { type: 'corner',   length: 35,  radius: 25, direction: 'right', label: 'Anthony Noghes'            },  // (~80°)
      { type: 'straight', length: 1151, label: 'Return to start'                                          },  // filler (+56m from corner reductions to maintain 3.337km)
    ],
  },

  spa: {
    name: 'Spa-Francorchamps (7.004 km)',
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
      { type: 'corner',   length: 44,   radius: 14, direction: 'right', label: 'La Source'                    },  // RIGHT hairpin (~180°) — corrected from 'left'
      { type: 'straight', length: 90,   label: 'Uphill to Eau Rouge'                                          },
      { type: 'corner',   length: 31,   radius: 22, direction: 'left',  label: 'Eau Rouge'                    },  // left-hander at valley bottom (~80°)
      { type: 'corner',   length: 288,  radius: 150, direction: 'right', label: 'Raidillon'                   },  // sweeping right up the hill (~110°)
      { type: 'straight', length: 700,  label: 'Kemmel Straight'                                              },
      { type: 'corner',   length: 42,   radius: 28, direction: 'left',  label: 'Les Combes T1'               },  // chicane left (~85°)
      { type: 'straight', length: 55                                                                           },
      { type: 'corner',   length: 38,   radius: 22, direction: 'right', label: 'Les Combes T2'               },  // chicane right (~100°)
      { type: 'straight', length: 550,  label: 'Malmedy approach'                                             },
      { type: 'corner',   length: 144,  radius: 55, direction: 'right', label: 'Malmedy / Rivage'            },  // right sweeper + Rivage hairpin (~150°)
      { type: 'straight', length: 340,  label: 'Pouhon approach'                                              },
      { type: 'corner',   length: 272,  radius: 130, direction: 'left', label: 'Pouhon'                       },  // LEFT double-apex (~120°) — corrected from 'right'
      { type: 'straight', length: 650,  label: 'Fagnes straight'                                              },
      { type: 'corner',   length: 47,   radius: 30, direction: 'left',  label: 'Campus T1'                   },  // chicane left (~90°)
      { type: 'straight', length: 55                                                                           },
      { type: 'corner',   length: 44,   radius: 28, direction: 'right', label: 'Campus T2'                   },  // chicane right (~90°)
      { type: 'straight', length: 1323, label: 'Stavelot straight'                                            },  // filler (reduced 176m to compensate corner arc increases)
      { type: 'corner',   length: 393,  radius: 230, direction: 'right', label: 'Blanchimont'                },  // fast right (~98°)
      { type: 'corner',   length: 18,   radius: 16, direction: 'left',  label: 'Bus Stop T1'                 },  // chicane left (~65°)
      { type: 'straight', length: 35                                                                           },
      { type: 'corner',   length: 18,   radius: 14, direction: 'right', label: 'Bus Stop T2'                 },  // chicane right (~74°)
      { type: 'straight', length: 1107, label: 'Return to La Source'                                          },
    ],
  },

  silverstone: {
    name: 'Silverstone GP (5.891 km)',
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
      { type: 'corner',   length: 42,   radius: 30,  direction: 'left',  label: 'Farm / Village T1'          },  // chicane left (~80°)
      { type: 'straight', length: 50                                                                           },
      { type: 'corner',   length: 54,   radius: 30,  direction: 'right', label: 'Village T2'                 },  // chicane right (~103°)
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
      { type: 'corner',   length: 38,  radius: 22,  direction: 'right', label: 'Degner 1'                    },  // (~100°)
      { type: 'straight', length: 60                                                                           },
      { type: 'corner',   length: 31,  radius: 18,  direction: 'right', label: 'Degner 2'                    },  // (~100°)
      { type: 'straight', length: 1214, label: 'Back straight'                                                },  // filler
      { type: 'corner',   length: 44,  radius: 14,  direction: 'right', label: 'Hairpin'                     },  // (~180°)
      { type: 'straight', length: 300                                                                          },
      { type: 'corner',   length: 204, radius: 130, direction: 'right', label: '130R'                        },  // fast right (~90°)
      { type: 'corner',   length: 21,  radius: 16,  direction: 'left',  label: 'Casio Chicane T1'            },  // (~75°)
      { type: 'straight', length: 40                                                                           },
      { type: 'corner',   length: 26,  radius: 20,  direction: 'right', label: 'Casio Chicane T2'            },  // (~75°)
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
    segments: [
      { type: 'straight', length: 375 },
      { type: 'corner',   length: 60,  radius: 57,  direction: 'right' },
      { type: 'straight', length: 110 },
      { type: 'corner',   length: 120, radius: 66,  direction: 'left'  },
      { type: 'straight', length: 110 },
      { type: 'corner',   length: 215, radius: 59,  direction: 'left'  },
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
      { type: 'corner',   length: 49,  radius: 30,  direction: 'right' },
      { type: 'straight', length: 85  },
      { type: 'corner',   length: 25,  radius: 157, direction: 'left'  },
      { type: 'straight', length: 1068 },
      { type: 'corner',   length: 35,  radius: 59,  direction: 'right' },
      { type: 'straight', length: 415 },
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
      vPrev = vExitTarget;  // exit at corner speed
    }
  }

  const totalLength = segments.reduce((s, seg) => s + seg.length, 0);
  const avgSpeedKph  = (totalLength / totalTime) * 3.6;
  const maxSpeedKph  = Math.max(...segResults.map(s => s.maxSpeedKph));
  const minCornerKph = Math.min(...segResults.filter(s => s.type === 'corner').map(s => s.minSpeedKph));

  return { totalTimeSec: totalTime, totalLengthM: totalLength, avgSpeedKph, maxSpeedKph, minCornerKph, segments: segResults };
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
