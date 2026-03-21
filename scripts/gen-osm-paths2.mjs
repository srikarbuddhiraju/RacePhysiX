/**
 * Fetch OSM highway=raceway data for GT circuits → normalized 400×250 SVG paths.
 * Attribution: © OpenStreetMap contributors (ODbL v1.0)
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';

const CIRCUITS = [
  { key: 'laguna_seca', name: 'Laguna Seca',  bbox: '36.4,-121.9,36.8,-121.6', needle: /laguna seca/i },
  { key: 'imola',       name: 'Imola',         bbox: '44.3,11.6,44.4,11.8',     needle: /imola|enzo/i  },
  { key: 'le_mans',     name: 'Le Mans',       bbox: '47.9,0.1,48.1,0.4',       needle: /mans|sarthe/i },
  { key: 'sebring',     name: 'Sebring',       bbox: '27.4,-81.4,27.6,-81.2',   needle: /sebring/i     },
  { key: 'mugello',     name: 'Mugello',       bbox: '43.9,11.3,44.1,11.6',     needle: /mugello/i     },
];

function latLonToMeters(lat, lon, lat0, lon0) {
  const R = 6371000;
  const x = R * (lon - lon0) * Math.PI / 180 * Math.cos(lat0 * Math.PI / 180);
  const y = R * (lat - lat0) * Math.PI / 180;
  return [x, y];
}

function toSvgPath(pts, W = 400, H = 250, margin = 15) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((W - 2*margin)/(maxX-minX||1), (H - 2*margin)/(maxY-minY||1));
  const ox = (W - (maxX-minX)*scale)/2 - minX*scale;
  const oy = (H - (maxY-minY)*scale)/2 - minY*scale;
  const svgPts = pts.map(([x,y]) => [+(x*scale+ox).toFixed(1), +(H-(y*scale+oy)).toFixed(1)]);
  return svgPts.map((p,i) => `${i===0?'M':'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}

function downsample(pts, n = 250) {
  if (pts.length <= n) return pts;
  const step = pts.length / n;
  return Array.from({length: n}, (_, i) => pts[Math.round(i * step)]);
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

for (const circuit of CIRCUITS) {
  try {
    console.log(`\n--- ${circuit.key} ---`);
    await delay(3000); // be polite to Overpass

    const data = `[out:json];way["highway"="raceway"](${circuit.bbox});(._;>;);out body;`;
    const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(data)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const nodeMap = {};
    for (const el of json.elements) {
      if (el.type === 'node') nodeMap[el.id] = el;
    }

    // Find the main raceway (longest way matching name)
    const ways = json.elements.filter(e => e.type === 'way');
    console.log(`  ${ways.length} ways found`);
    for (const w of ways) console.log(`    ${w.id}: "${w.tags?.name||'?'}" ${w.nodes.length} nodes`);

    const main = ways
      .filter(w => !w.tags?.name || circuit.needle.test(w.tags.name))
      .sort((a, b) => b.nodes.length - a.nodes.length)[0];

    if (!main) { console.log('  No matching way'); continue; }
    console.log(`  Using: "${main.tags?.name}" (${main.nodes.length} nodes)`);

    const latLons = main.nodes.map(id => nodeMap[id]).filter(Boolean);
    if (latLons.length < 10) { console.log('  Too few resolved nodes'); continue; }

    const lat0 = latLons.reduce((s,p) => s+p.lat, 0) / latLons.length;
    const lon0 = latLons.reduce((s,p) => s+p.lon, 0) / latLons.length;
    const pts = latLons.map(p => latLonToMeters(p.lat, p.lon, lat0, lon0));
    const sampled = downsample(pts, 250);
    const svgPath = toSvgPath(sampled);

    console.log(`  svgPath length: ${svgPath.length} chars, ${sampled.length} pts`);
    console.log(`  // ${circuit.key}: GPS-derived from OpenStreetMap (ODbL) © OpenStreetMap contributors`);
    console.log(`  svgPath: "${svgPath}",`);
    console.log(`  svgViewBox: "0 0 400 250",`);
    console.log(`  svgIsGps: true,`);
  } catch(e) {
    console.error(`  ERROR: ${e.message}`);
  }
}
