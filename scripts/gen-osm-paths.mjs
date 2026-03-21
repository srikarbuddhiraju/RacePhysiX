/**
 * Fetch OSM Overpass data for GT circuits and convert to normalized 400×250 SVG paths.
 * Attribution required: © OpenStreetMap contributors (ODbL v1.0)
 * Usage: node scripts/gen-osm-paths.mjs
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';

const CIRCUITS = [
  {
    key: 'laguna_seca',
    query: 'way["leisure"="track"]["name"~"WeatherTech",i](36.5,-122,37.5,-121);',
    bbox: '36.5,-122,37.5,-121',
    name: 'Laguna Seca',
  },
  {
    key: 'imola',
    query: 'way["leisure"="track"]["name"~"Enzo e Dino",i](44.3,11.6,44.4,11.8);',
    bbox: '44.3,11.6,44.4,11.8',
    name: 'Imola',
  },
  {
    key: 'le_mans',
    query: 'way["leisure"="track"]["name"~"Sarthe",i](47.9,0.1,48.1,0.4);',
    bbox: '47.9,0.1,48.1,0.4',
    name: 'Le Mans',
  },
  {
    key: 'sebring',
    query: 'way["leisure"="track"]["name"~"Sebring",i](27.4,-81.4,27.6,-81.2);',
    bbox: '27.4,-81.4,27.6,-81.2',
    name: 'Sebring',
  },
  {
    key: 'mugello',
    query: 'way["leisure"="track"]["name"~"Mugello",i](43.9,11.3,44.1,11.6);',
    bbox: '43.9,11.3,44.1,11.6',
    name: 'Mugello',
  },
];

// Equirectangular projection: lat/lon → local meters
function latLonToMeters(lat, lon, lat0, lon0) {
  const R = 6371000;
  const x = R * (lon - lon0) * Math.PI / 180 * Math.cos(lat0 * Math.PI / 180);
  const y = R * (lat - lat0) * Math.PI / 180;
  return [x, y];
}

function toSvgPath(pts, W = 400, H = 250, margin = 15) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleX = (W - 2 * margin) / rangeX;
  const scaleY = (H - 2 * margin) / rangeY;
  const scale = Math.min(scaleX, scaleY);
  const ox = (W - rangeX * scale) / 2 - minX * scale;
  const oy = (H - rangeY * scale) / 2 - minY * scale;
  // Flip Y (SVG y-down, geographic y-up)
  const svgPts = pts.map(([x, y]) => [
    +(x * scale + ox).toFixed(1),
    +(H - (y * scale + oy)).toFixed(1),
  ]);
  return svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}

function downsample(pts, targetN = 250) {
  if (pts.length <= targetN) return pts;
  const step = pts.length / targetN;
  const out = [];
  for (let i = 0; i < targetN; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

async function fetchOverpass(data) {
  const url = `${OVERPASS}?data=${encodeURIComponent(data)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

for (const circuit of CIRCUITS) {
  try {
    console.log(`\n--- ${circuit.key} ---`);
    const data = `[out:json];${circuit.query}(._;>;);out body;`;
    const json = await fetchOverpass(data);

    // Build node map
    const nodeMap = {};
    for (const el of json.elements) {
      if (el.type === 'node') nodeMap[el.id] = { lat: el.lat, lon: el.lon };
    }

    // Find the way (the circuit outline)
    const way = json.elements.find(el => el.type === 'way');
    if (!way) {
      console.log(`  No way found. Elements: ${json.elements.length}`);
      // Try broader search
      console.log(`  Elements found: ${json.elements.map(e => `${e.type}:${e.tags?.name||''}`).join(', ')}`);
      continue;
    }

    console.log(`  Way: ${way.tags?.name || '(unnamed)'}, ${way.nodes.length} nodes`);

    const latLons = way.nodes.map(id => nodeMap[id]).filter(Boolean);
    if (latLons.length < 10) {
      console.log(`  Too few nodes: ${latLons.length}`);
      continue;
    }

    // Reference point: centroid
    const lat0 = latLons.reduce((s, p) => s + p.lat, 0) / latLons.length;
    const lon0 = latLons.reduce((s, p) => s + p.lon, 0) / latLons.length;

    const pts = latLons.map(p => latLonToMeters(p.lat, p.lon, lat0, lon0));
    console.log(`  ${pts.length} points parsed`);

    const sampled = downsample(pts, 250);
    const svgPath = toSvgPath(sampled);
    console.log(`  svgPath: ${svgPath.length} chars, ${sampled.length} pts`);
    console.log(`  // ${circuit.key}: GPS-derived from OpenStreetMap (ODbL) © OpenStreetMap contributors`);
    console.log(`  svgPath: "${svgPath}",`);
    console.log(`  svgViewBox: "0 0 400 250",`);
    console.log(`  svgIsGps: true,`);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
  }
}
