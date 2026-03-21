/**
 * Fetch OSM highway=raceway for GT circuits, join all segments → SVG paths.
 * Attribution: © OpenStreetMap contributors (ODbL v1.0)
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const delay = ms => new Promise(r => setTimeout(r, ms));

const CIRCUITS = [
  { key: 'laguna_seca', bbox: '36.4,-121.9,36.8,-121.6', exclude: /pit|complex|salinas/i },
  { key: 'imola',       bbox: '44.30,11.67,44.40,11.76',  exclude: /pit/i                },
  { key: 'le_mans',     bbox: '47.93,0.19,48.05,0.27',    exclude: /pit|paddock/i        },
  { key: 'sebring',     bbox: '27.43,-81.38,27.56,-81.32', exclude: /pit|club|bypass/i   },
  { key: 'mugello',     bbox: '43.97,11.35,44.08,11.56',  exclude: /pit|bypass|motocross|mugellino/i },
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

function dist(a, b) {
  return Math.hypot(a.lat - b.lat, a.lon - b.lon);
}

// Greedy chain join — returns ordered lat/lon array
function joinAll(ways, nodeMap) {
  const segments = ways
    .map(w => w.nodes.map(id => nodeMap[id]).filter(Boolean))
    .filter(s => s.length >= 2);

  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  // Start with the longest segment
  segments.sort((a, b) => b.length - a.length);
  let chain = [...segments[0]];
  const rem = segments.slice(1);

  while (rem.length > 0) {
    const tail = chain[chain.length - 1];
    const head = chain[0];
    let bestI = -1, bestFlip = false, bestAtHead = false, bestD = Infinity;

    for (let i = 0; i < rem.length; i++) {
      const s = rem[i];
      const sH = s[0], sT = s[s.length - 1];
      // Append to tail
      const d1 = dist(tail, sH);
      const d2 = dist(tail, sT);
      // Prepend to head
      const d3 = dist(head, sT);
      const d4 = dist(head, sH);
      const best = Math.min(d1, d2, d3, d4);
      if (best < bestD) {
        bestD = best; bestI = i;
        if (best === d1) { bestFlip = false; bestAtHead = false; }
        else if (best === d2) { bestFlip = true; bestAtHead = false; }
        else if (best === d3) { bestFlip = false; bestAtHead = true; }
        else { bestFlip = true; bestAtHead = true; }
      }
    }

    if (bestI < 0 || bestD > 0.003) break; // ~330m max gap — stop if nothing close
    const seg = rem.splice(bestI, 1)[0];
    const ordered = bestFlip ? [...seg].reverse() : seg;
    if (bestAtHead) {
      chain = [...ordered.slice(0, -1), ...chain];
    } else {
      chain = [...chain, ...ordered.slice(1)];
    }
  }

  if (rem.length > 0) {
    console.log(`  Warning: ${rem.length} segments not connected (max gap exceeded)`);
  }
  return chain;
}

for (const circuit of CIRCUITS) {
  console.log(`\n=== ${circuit.key} ===`);
  await delay(5000);

  try {
    const query = `[out:json];way["highway"="raceway"](${circuit.bbox});(._;>;);out body;`;
    const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const nodeMap = {};
    for (const el of json.elements) {
      if (el.type === 'node') nodeMap[el.id] = el;
    }

    const allWays = json.elements.filter(e => e.type === 'way');
    console.log(`  ${allWays.length} total ways`);

    // Filter out pit lanes and other non-circuit ways
    const raceWays = allWays.filter(w => {
      const n = w.tags?.name || '';
      return !circuit.exclude.test(n);
    });
    console.log(`  ${raceWays.length} after filtering`);
    raceWays.forEach(w => console.log(`    "${w.tags?.name || '?'}" ${w.nodes.length}pts`));

    const chain = joinAll(raceWays, nodeMap);
    console.log(`  Chain: ${chain.length} nodes`);

    if (chain.length < 20) {
      console.log('  SKIP: too short');
      continue;
    }

    const lat0 = chain.reduce((s,p) => s+p.lat, 0) / chain.length;
    const lon0 = chain.reduce((s,p) => s+p.lon, 0) / chain.length;
    const pts = chain.map(p => latLonToMeters(p.lat, p.lon, lat0, lon0));

    // Check closure — distance from end to start
    const closure = Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1]);
    console.log(`  Closure gap: ${closure.toFixed(0)}m`);

    const svgPath = toSvgPath(pts);
    console.log(`  svgPath length: ${svgPath.length} chars`);
    console.log(`OUTPUT_${circuit.key.toUpperCase()}:`);
    console.log(`  svgPath: "${svgPath}",`);
    console.log(`  svgViewBox: "0 0 400 250",`);
    console.log(`  svgIsGps: true,`);
    console.log(`  svgSource: 'osm',`);
  } catch(e) {
    console.error(`  ERROR: ${e.message}`);
  }
}
