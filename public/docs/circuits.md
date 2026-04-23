# Circuit Reference

RacePhysiX includes 22 circuits across three categories. All real circuits are geometrically accurate to GPS-quality data.

---

## Generic circuits

These are purpose-designed for testing — they are not based on real locations.

| Circuit | Length | Description |
|---|---|---|
| Club Circuit | ~1.9 km | Short club-level track with two hairpins and a fast sweeper |
| Karting Circuit | ~1.0 km | Tight, technical karting layout — all slow corners |
| GT Circuit | ~3.2 km | Flowing GT-style track with one long straight and high-speed sections |
| Formula Test | ~2.1 km | Technical Formula-style circuit with chicanes |

---

## Schematic real circuits

Geometrically representative but not GPS-derived. Corner radii, distances, and segment order are accurate; exact GPS coordinates are not used.

| Circuit | Length | Character |
|---|---|---|
| Monza | 5.793 km | Power circuit — long straights, two chicanes, fast Parabolica |
| Spa-Francorchamps | 7.004 km | High-speed + technical — Eau Rouge/Raidillon, Pouhon, Bus Stop chicane |
| Silverstone | 5.891 km | High-speed, flowing — Copse, Maggotts/Becketts, Stowe |
| Suzuka | 5.807 km | Technical figure-8 — 130R, Degner, Casio triangle |

---

## GPS-accurate circuits — TUMFTM (LGPL-3.0)

These 10 circuits are derived from the **TUMFTM Racetrack Database** published by the Technical University of Munich (Institute of Automotive Technology). GPS paths are licensed under **LGPL-3.0**.

The GPS coordinates are processed using circumradius segmentation: 3-point circumradius → rolling-mean smoothing → curvature threshold → segment merging → harmonic-mean radius per corner. Total circuit lengths are accurate to within ±9 m.

| Circuit | Country | Length | Character |
|---|---|---|---|
| Nürburgring Grand Prix | Germany | 5.148 km | Technical — stadium section, flowing infield |
| Bahrain / Sakhir | Bahrain | 5.412 km | Mixed — three long straights, technical infield |
| Barcelona / Catalunya | Spain | 4.655 km | High-downforce — technical sector 2, fast final corner |
| Hungaroring / Budapest | Hungary | 4.381 km | Slow and twisty — very little straight-line time |
| Circuit Gilles Villeneuve / Montreal | Canada | 4.361 km | Street circuit — fast chicane at end of back straight |
| Brands Hatch | United Kingdom | 3.916 km | Undulating — Paddock Hill Bend, Druids, Clearways |
| Hockenheimring | Germany | 4.574 km | Power circuit — two long straights, tight stadium section |
| Red Bull Ring / Spielberg | Austria | 4.326 km | Short, fast — three main straights, flowing Sector 1 |
| Zandvoort | Netherlands | 4.259 km | Banked Hugenholtz, technical final sector |
| São Paulo / Interlagos | Brazil | 4.309 km | Anti-clockwise — uphill Sector 1, twisty Sector 2 |

**Attribution:** GPS path data © TU Munich (TUMFTM), Racetrack Database, LGPL-3.0.
Source: [https://github.com/TUMFTM/racetrack-database](https://github.com/TUMFTM/racetrack-database)

---

## GPS-accurate circuits — OpenStreetMap (ODbL)

These 4 circuits are sourced from **OpenStreetMap** contributors, licensed under the **Open Database Licence (ODbL)**.

OSM `highway=raceway` ways for each circuit were fetched, stitched into a continuous closed loop, and simplified. Geometric closure is verified to within 5 m.

| Circuit | Country | Length | Character |
|---|---|---|---|
| Laguna Seca | USA | 3.602 km | Corkscrew, fast uphill straight, technical infield |
| Imola | Italy | 4.909 km | Classic Italian — Tamburello chicane, Rivazza, anti-clockwise |
| Le Mans | France | 13.626 km | Longest circuit — Mulsanne + two chicanes, Porsche Curves |
| Mugello | Italy | 5.245 km | Fast and flowing — San Donato, Casanova, Scarperia |

**Attribution:** © OpenStreetMap contributors, ODbL 1.0.
Source: [https://www.openstreetmap.org](https://www.openstreetmap.org)

---

## Banking and gradient data

The following real-world banking angles and gradients are encoded in the simulator:

| Circuit | Feature | Value | Effect |
|---|---|---|---|
| Spa | Eau Rouge | 5° bank | GT3 flat-out through the corner |
| Spa | Raidillon | 6° bank | GT3 flat-out over the crest |
| Spa | Uphill to Eau Rouge | 18% gradient | Reduced acceleration on the uphill run |
| Spa | Kemmel Straight | −4% gradient | Slight downhill speed gain |
| Monza | Parabolica | 3° bank | Minor corner speed increase |
| Silverstone | Copse | 3° bank | Minor corner speed increase |
| Suzuka | 130R | 2° bank | Minor corner speed increase |

---

## Track editor

The Track Editor (available in the Lap Time panel) lets you define a custom circuit as a sequence of segments. Each segment is either a straight (length in metres) or a corner (radius in metres, direction left/right, sweep angle in degrees).

You can:
- Edit the segment table directly
- Preview the circuit in the live SVG view (updates as you type)
- Export the circuit as JSON for future sessions
- Import a previously saved circuit JSON

**Note on circuit closure:** A circuit is geometrically closed when the sum of all heading changes equals exactly 360° AND the cumulative x/y displacement returns to zero. The preview shows a closure indicator — a gap of more than ~5 px suggests a geometry error.

---

## Known limitations

- **Sector markers**: Sectors are split at 1/3 and 2/3 of circuit distance, not at real-world sector boundaries. Sector times will differ from official timing data.
- **Track evolution**: The rubber evolution model is global — it does not account for the racing line being more rubbered than the off-line.
- **Elevation profile**: Only select banking angles and gradients are modelled explicitly. Full 3D elevation profiles (e.g. Nürburgring's 300 m elevation change) are not currently included.
- **Pit lane**: Not modelled. Strategy lap counts assume all laps are flying laps.
- **Safety car / VSC**: Not modelled.
