/**
 * Fetch TUMFTM circuit CSVs and convert to normalized 400×250 SVG paths.
 * Usage: node scripts/gen-circuit-paths.mjs
 */

const TUMFTM_BASE = 'https://raw.githubusercontent.com/TUMFTM/racetrack-database/master/tracks/';

const CIRCUITS = [
  { key: 'brands_hatch', file: 'BrandsHatch.csv',  totalDistKm: 3.916 },
  { key: 'hockenheim',   file: 'Hockenheim.csv',   totalDistKm: 4.574 },
  { key: 'spielberg',    file: 'Spielberg.csv',     totalDistKm: 4.318 },
  { key: 'zandvoort',    file: 'Zandvoort.csv',     totalDistKm: 4.259 },
  { key: 'sao_paulo',    file: 'SaoPaulo.csv',      totalDistKm: 4.309 },
];

async function fetchCSV(filename) {
  const url = TUMFTM_BASE + filename;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  // Find header
  const header = lines[0].replace(/^#\s*/, '').toLowerCase().split(',').map(h => h.trim());
  const xi = header.findIndex(h => h === 'x_m');
  const yi = header.findIndex(h => h === 'y_m');
  if (xi < 0 || yi < 0) throw new Error(`No x_m/y_m columns. Header: ${header}`);

  const pts = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    const x = parseFloat(cols[xi]);
    const y = parseFloat(cols[yi]);
    if (!isNaN(x) && !isNaN(y)) pts.push([x, y]);
  }
  return pts;
}

function toSvgPath(pts, W = 400, H = 250, margin = 15) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Fit within (W - 2*margin) x (H - 2*margin) preserving aspect ratio
  const scaleX = (W - 2 * margin) / rangeX;
  const scaleY = (H - 2 * margin) / rangeY;
  const scale = Math.min(scaleX, scaleY);

  // Center the circuit
  const ox = (W - rangeX * scale) / 2 - minX * scale;
  const oy = (H - rangeY * scale) / 2 - minY * scale;

  // TUMFTM y_m is geographic (up = north). SVG y is down. Flip Y.
  const transform = ([x, y]) => [
    +(x * scale + ox).toFixed(1),
    +(H - (y * scale + oy)).toFixed(1),
  ];

  const svgPts = pts.map(transform);
  const d = svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  return d + ' Z';
}

// Downsample to ~300 points max (keeps path small but shape accurate)
function downsample(pts, targetN = 300) {
  if (pts.length <= targetN) return pts;
  const step = pts.length / targetN;
  const out = [];
  for (let i = 0; i < targetN; i++) {
    out.push(pts[Math.round(i * step)]);
  }
  return out;
}

for (const circuit of CIRCUITS) {
  try {
    console.log(`\n--- ${circuit.key} ---`);
    const csv = await fetchCSV(circuit.file);
    const pts = parseCSV(csv);
    console.log(`  Parsed ${pts.length} points`);

    const sampled = downsample(pts, 250);
    const svgPath = toSvgPath(sampled);

    console.log(`  svgPath length: ${svgPath.length} chars, ${sampled.length} pts`);
    console.log(`  // ${circuit.key}: GPS-derived from TUMFTM Racetrack Database (LGPL-3.0)`);
    console.log(`  svgPath: "${svgPath}",`);
    console.log(`  svgViewBox: "0 0 400 250",`);
    console.log(`  svgIsGps: true,`);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
  }
}
