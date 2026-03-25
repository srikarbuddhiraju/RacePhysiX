/**
 * Real sector split fractions for all 22 circuits.
 * Values are [S1_end_fraction, S2_end_fraction] of total lap distance.
 * S3 always ends at 1.0.
 * Generic circuits use equal thirds.
 * Real circuit values based on FIA/FOM published sector boundaries.
 */
export const SECTOR_SPLITS: Record<string, [number, number]> = {
  // Generic (equal thirds)
  club:         [0.333, 0.667],
  karting:      [0.333, 0.667],
  gt_circuit:   [0.333, 0.667],
  formula_test: [0.333, 0.667],

  // Schematic real circuits
  monza:       [0.295, 0.585],   // S1: start→Rettifilo chicane; S2: →Variante Ascari; S3: →finish
  spa:         [0.285, 0.645],   // S1: start→Les Combes; S2: →Stavelot; S3: →finish
  silverstone: [0.373, 0.696],   // S1: start→Vale; S2: →Luffield; S3: →finish
  suzuka:      [0.379, 0.672],   // S1: start→Degner 2; S2: →Hairpin exit; S3: →finish

  // GPS circuits — TUMFTM
  nurburgring_gp: [0.330, 0.622],  // S1: start→Ford Kurve; S2: →Mercedes Arena; S3: →finish
  bahrain:        [0.370, 0.665],  // S1: start→T8; S2: →T13; S3: →finish
  barcelona:      [0.451, 0.730],  // S1: start→T9/10; S2: →T14; S3: →finish
  hungaroring:    [0.343, 0.639],  // S1: start→T4; S2: →T11; S3: →finish
  montreal:       [0.344, 0.688],  // S1: start→hairpin; S2: →chicane; S3: →finish
  brands_hatch:   [0.230, 0.613],  // S1: start→Druids; S2: →Hawthorn; S3: →finish
  hockenheim:     [0.394, 0.743],  // S1: start→hairpin; S2: →Einfahrt Motodrom; S3: →finish
  spielberg:      [0.347, 0.672],  // S1: start→T3; S2: →T9; S3: →finish
  zandvoort:      [0.376, 0.704],  // S1: start→Hugenholtz; S2: →Panoramabocht; S3: →finish
  sao_paulo:      [0.348, 0.650],  // S1: start→Senna S; S2: →T8; S3: →finish

  // GPS circuits — OSM
  laguna_seca: [0.389, 0.667],  // S1: start→Corkscrew entry; S2: →Corkscrew exit; S3: →finish
  imola:       [0.367, 0.713],  // S1: start→Variante Bassa; S2: →Rivazza; S3: →finish
  le_mans:     [0.462, 0.719],  // S1: start→Tertre Rouge; S2: →Mulsanne corner; S3: →finish
  sebring:     [0.333, 0.667],  // equal thirds (no standard FIA sectors)
  mugello:     [0.381, 0.725],  // S1: start→San Donato; S2: →Bucine; S3: →finish
};

/** Get sector index (1, 2, or 3) for a given distance fraction. */
export function getSectorIndex(distFrac: number, circuitKey: string): 1 | 2 | 3 {
  const splits = SECTOR_SPLITS[circuitKey] ?? [0.333, 0.667];
  if (distFrac < splits[0]) return 1;
  if (distFrac < splits[1]) return 2;
  return 3;
}
