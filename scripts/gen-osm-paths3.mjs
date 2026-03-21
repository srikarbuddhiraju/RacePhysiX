/**
 * Fetch OSM highway=raceway data, join multi-segment circuits, generate SVG paths.
 * Attribution: © OpenStreetMap contributors (ODbL v1.0)
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const delay = ms => new Promise(r => setTimeout(r, ms));

const CIRCUITS = [
  { key: 'laguna_seca', bbox: '36.4,-121.9,36.8,-121.6', mainName: /WeatherTech/i },
  { key: 'le_mans',     bbox: '47.9,0.1,48.1,0.4',       mainName: /sarthe|mans/i },
  { key: 'sebring',     bbox: '27.4,-81.4,27.6,-81.2',    mainName: /sebring/i     },
  { key: 'mugello',     bbox: '43.9,11.3,44.1,11.6',      mainName: /mugello/i     },
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
  const scale = Math.min((W-2*margin)/(maxX-minX||1), (H-2*margin)/(maxY-minY||1));
  const ox = (W-(maxX-minX)*scale)/2 - minX*scale;
  const oy = (H-(maxY-minY)*scale)/2 - minY*scale;
  const svgPts = pts.map(([x,y]) => [+(x*scale+ox).toFixed(1), +(H-(y*scale+oy)).toFixed(1)]);
  return svgPts.map((p,i) => `${i===0?'M':'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}

function downsample(pts, n = 250) {
  if (pts.length <= n) return pts;
  const step = pts.length / n;
  return Array.from({length: n}, (_, i) => pts[Math.round(i * step)]);
}

// Join ways into a single ordered polyline (greedy endpoint matching)
function joinWays(ways, nodeMap) {
  if (ways.length === 0) return [];
  const segments = ways.map(w => w.nodes.map(id => nodeMap[id]).filter(Boolean));

  let chain = [...segments[0]];
  const remaining = segments.slice(1);

  while (remaining.length > 0) {
    const head = chain[0], tail = chain[chain.length - 1];
    let bestIdx = -1, bestFlip = false, bestEnd = false;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      const segHead = seg[0], segTail = seg[seg.length - 1];
      // Connect tail → segHead
      const d1 = Math.hypot(tail.lat - segHead.lat, tail.lon - segHead.lon);
      // Connect tail → segTail (reversed)
      const d2 = Math.hypot(tail.lat - segTail.lat, tail.lon - segTail.lon);
      if (d1 < bestDist) { bestDist = d1; bestIdx = i; bestFlip = false; bestEnd = false; }
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; bestFlip = true; bestEnd = false; }
    }

    if (bestIdx < 0 || bestDist > 0.01) break; // 0.01 degrees ≈ 1km
    const seg = remaining.splice(bestIdx, 1)[0];
    const toAdd = bestFlip ? [...seg].reverse() : seg;
    chain = [...chain, ...toAdd.slice(1)]; // skip first to avoid duplicate
  }

  return chain;
}

for (const circuit of CIRCUITS) {
  try {
    console.log(`\n--- ${circuit.key} ---`);
    await delay(5000);

    const data = `[out:json];way["highway"="raceway"](${circuit.bbox});(._;>;);out body;`;
    const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(data)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const nodeMap = {};
    for (const el of json.elements) {
      if (el.type === 'node') nodeMap[el.id] = el;
    }

    const ways = json.elements.filter(e => e.type === 'way');
    console.log(`  ${ways.length} ways total`);

    // Use named ways (circuit.mainName) only; fall back to all if none match
    const named = ways.filter(w => {
      const n = w.tags?.name || '';
      return circuit.mainName.test(n);
    });
    const target = named.length > 0 ? named : ways.slice(0, 1);
    console.log(`  Using ${target.length} named ways (${target.map(w => `"${w.tags?.name||'?'}" ${w.nodes.length}pts`).join(', ')})`);

    const chain = joinWays(target, nodeMap);
    if (chain.length < 10) { console.log('  Too few points in chain'); continue; }
    console.log(`  Joined chain: ${chain.length} nodes`);

    const lat0 = chain.reduce((s,p) => s+p.lat, 0) / chain.length;
    const lon0 = chain.reduce((s,p) => s+p.lon, 0) / chain.length;
    const pts = chain.map(p => latLonToMeters(p.lat, p.lon, lat0, lon0));
    const sampled = downsample(pts, 250);
    const svgPath = toSvgPath(sampled);

    console.log(`  svgPath: "${svgPath}",`);
    console.log(`  svgViewBox: "0 0 400 250",`);
    console.log(`  svgIsGps: true,`);
  } catch(e) {
    console.error(`  ERROR: ${e.message}`);
  }
}
