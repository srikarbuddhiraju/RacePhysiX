/**
 * Multi-view vehicle dynamics visualisation.
 *
 * Single canvas, three viewports rendered with scissor/viewport:
 *   Left 60%       — Top-down ortho (classic plan view)
 *   Top-right 40%  — Rear view persp (body width, tyre cross-section, lateral forces)
 *   Bot-right 40%  — Isometric ortho (3/4 perspective, full car shape)
 *
 * Car silhouette varies by VehicleClass:
 *   road       — wide sedan body (fenders beyond tyres), windscreen line, cabin box
 *   track      — tapered GT (wider rear), front splitter, rear wing, cockpit
 *   motorsport — narrow chassis (0.30m), long pointed nose, open wheels, front+rear wings, helmet
 */

import { useEffect, useRef } from 'react';
import {
  Scene,
  OrthographicCamera,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Mesh,
  MeshBasicMaterial,
  ArrowHelper,
  Vector3,
  LineBasicMaterial,
  CircleGeometry,
  BufferGeometry,
  Line,
  Material,
  Object3D,
  Shape,
  ShapeGeometry,
  BoxGeometry,
  CylinderGeometry,
  Camera,
} from 'three';
import type { VehicleParams, PhysicsResult, Balance, VehicleClass, PacejkaResult, PacejkaCoeffs } from '../physics/types';

interface Props {
  params:   VehicleParams;
  result:   PhysicsResult;
  pacejka?: PacejkaResult;
  coeffs?:  PacejkaCoeffs;
  darkMode?: boolean;
}

const DEG_TO_RAD  = Math.PI / 180;
const FORCE_SCALE = 1 / 3500;   // m per N
const MIN_ARROW   = 0.25;       // m

// ── Shared geometry constants ─────────────────────────────────────────────────

const WHEEL_RADIUS   = 0.305;   // m (approximate, ~18″ rim + tyre sidewall)
const CAR_BODY_H     = 0.40;    // m, body shell height for 3D views (road/track)
const FORMULA_BODY_H = 0.22;    // m, cockpit/tub height for formula car

// ── Dispose helpers ───────────────────────────────────────────────────────────

function clearScene(scene: Scene): void {
  const toDispose: Array<BufferGeometry | Material> = [];
  scene.traverse((obj: Object3D) => {
    if (obj instanceof Mesh || obj instanceof Line) {
      toDispose.push(obj.geometry);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => toDispose.push(m));
    }
    if (obj instanceof ArrowHelper) {
      // ArrowHelper manages its own geometry/material — no manual dispose needed
    }
  });
  scene.clear();
  toDispose.forEach(d => d.dispose());
}

// ── Line / arc helpers ────────────────────────────────────────────────────────

function makeLine(pts: Vector3[], color: number, opacity = 1.0): Line {
  const mat = new LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new Line(new BufferGeometry().setFromPoints(pts), mat);
}

function makeArc(cx: number, cy: number, r: number, startAng: number, endAng: number, segs: number): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const ang = startAng + (endAng - startAng) * (i / segs);
    pts.push(new Vector3(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 0));
  }
  return pts;
}

// ── Rounded flat rectangle (ShapeGeometry) ────────────────────────────────────

function makeRoundedRect(w: number, h: number, rFront: number, rRear: number): Shape {
  const hw = w / 2, hh = h / 2;
  const s = new Shape();
  s.moveTo(-hw + rRear,  -hh);
  s.lineTo( hw - rRear,  -hh);
  s.quadraticCurveTo( hw, -hh,  hw, -hh + rRear);
  s.lineTo( hw,           hh - rFront);
  s.quadraticCurveTo( hw,  hh,  hw - rFront,  hh);
  s.lineTo(-hw + rFront,  hh);
  s.quadraticCurveTo(-hw,  hh, -hw,  hh - rFront);
  s.lineTo(-hw,          -hh + rRear);
  s.quadraticCurveTo(-hw, -hh, -hw + rRear, -hh);
  return s;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function lerp32(c1: number, c2: number, t: number): number {
  const t_ = Math.max(0, Math.min(1, t));
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  return (
    (Math.round(r1 + (r2 - r1) * t_) << 16) |
    (Math.round(g1 + (g2 - g1) * t_) << 8)  |
     Math.round(b1 + (b2 - b1) * t_)
  );
}

// ── Vehicle body — top-down ShapeGeometry ─────────────────────────────────────
// Each class returns: { bodyShapes: Array<{shape, color, z}>, outlineShapes, extrusionH }

function addRoadBodyTopDown(scene: Scene, L: number, TW: number, a: number, b: number): void {
  const BW = TW + 0.22;          // fenders overhang each side by ~110mm
  const BL = L + 0.88;
  const centreY = (a - b) / 2;  // body centre so front/rear overhangs are proportional

  // Main body
  const bodyShape = makeRoundedRect(BW, BL, 0.42, 0.26);
  const bodyMesh  = new Mesh(new ShapeGeometry(bodyShape), new MeshBasicMaterial({ color: 0x12121e }));
  bodyMesh.position.set(0, centreY, 0);
  scene.add(bodyMesh);

  // Outline
  const oPts = bodyShape.getPoints(48).map(p => new Vector3(p.x, p.y + centreY, 0.01));
  oPts.push(oPts[0]);
  scene.add(makeLine(oPts, 0x3a3a70));

  // Windscreen
  const wsW = BW * 0.55;
  const wsY = centreY + BL / 2 - 0.50;
  const ws = new Shape();
  ws.moveTo(-wsW / 2, 0); ws.lineTo(wsW / 2, 0);
  ws.lineTo(wsW * 0.30, 0.24); ws.lineTo(-wsW * 0.30, 0.24); ws.closePath();
  scene.add(new Mesh(new ShapeGeometry(ws), new MeshBasicMaterial({ color: 0x1e2438 })));
  scene.children[scene.children.length - 1].position.set(0, wsY, 0.02);

  // Cabin (rear window)
  const cabW = BW * 0.48, cabH = 0.32;
  const cabY = centreY + BL / 2 - 0.90;
  const cab  = new Shape();
  cab.moveTo(-cabW / 2, 0); cab.lineTo(cabW / 2, 0);
  cab.lineTo(cabW * 0.40, cabH); cab.lineTo(-cabW * 0.40, cabH); cab.closePath();
  scene.add(new Mesh(new ShapeGeometry(cab), new MeshBasicMaterial({ color: 0x1e2438 })));
  scene.children[scene.children.length - 1].position.set(0, cabY, 0.02);

  // Side mirrors
  for (const side of [-1, 1]) {
    const mx = side * (BW / 2 + 0.05), my = centreY + BL / 2 - 0.62;
    const mShape = new Shape();
    mShape.moveTo(0, 0); mShape.lineTo(0.08 * side, 0);
    mShape.lineTo(0.08 * side, 0.13); mShape.lineTo(0, 0.13); mShape.closePath();
    const mMesh = new Mesh(new ShapeGeometry(mShape), new MeshBasicMaterial({ color: 0x2a2a40 }));
    mMesh.position.set(mx, my, 0.02);
    scene.add(mMesh);
  }
}

function addTrackBodyTopDown(scene: Scene, L: number, TW: number, a: number, b: number): void {
  const BWFront = TW - 0.10;    // slightly narrower at front
  const BWRear  = TW + 0.08;    // slightly wider at rear
  const BL      = L + 0.70;
  const centreY = (a - b) / 2;

  // Trapezoidal body
  const hw_f = BWFront / 2, hw_r = BWRear / 2;
  const hh   = BL / 2;
  const s = new Shape();
  s.moveTo(-hw_f,  hh);   // front-left
  s.lineTo( hw_f,  hh);   // front-right
  s.lineTo( hw_r, -hh);   // rear-right
  s.lineTo(-hw_r, -hh);   // rear-left
  s.closePath();
  const bodyMesh = new Mesh(new ShapeGeometry(s), new MeshBasicMaterial({ color: 0x0e0e1a }));
  bodyMesh.position.set(0, centreY, 0);
  scene.add(bodyMesh);

  const oPts = s.getPoints(24).map(p => new Vector3(p.x, p.y + centreY, 0.01));
  oPts.push(oPts[0]);
  scene.add(makeLine(oPts, 0x502090));

  // Front splitter
  const splitterY = centreY + hh + 0.06;
  scene.add(makeLine([
    new Vector3(-BWFront * 0.65, splitterY, 0.02),
    new Vector3( BWFront * 0.65, splitterY, 0.02),
  ], 0x7030c0));

  // Rear wing
  const rwY = centreY - hh - 0.08;
  scene.add(makeLine([
    new Vector3(-(BWRear / 2 + 0.12), rwY, 0.02),
    new Vector3( (BWRear / 2 + 0.12), rwY, 0.02),
  ], 0x7030c0, 0.9));
  scene.add(makeLine([
    new Vector3(-(BWRear / 2 + 0.12), rwY - 0.06, 0.02),
    new Vector3( (BWRear / 2 + 0.12), rwY - 0.06, 0.02),
  ], 0x7030c0, 0.5));

  // Cockpit oval
  const cpGeom = new CircleGeometry(0.24, 16);
  const cpMesh = new Mesh(cpGeom, new MeshBasicMaterial({ color: 0x1a1a2e }));
  cpMesh.position.set(0, centreY + BL * 0.08, 0.02);
  cpMesh.scale.set(1, 1.4, 1);
  scene.add(cpMesh);
}

function addFormulaBodyTopDown(scene: Scene, L: number, TW: number, a: number, b: number): void {
  const chassisW = 0.30;        // narrow tub — wheels are fully outside
  const noseconeL = 0.70;       // pointed nose extension in front of front axle
  const overallL = L + noseconeL + 0.35;  // +0.35 for rear overhang
  const centreY = (a - b) / 2 + noseconeL / 2;  // shift body so front axle aligns

  // Cockpit tub — tapered rectangle
  const hw = chassisW / 2;
  const hh = overallL / 2;
  const tub = new Shape();
  tub.moveTo(-hw * 0.55,  hh);   // narrow at nose
  tub.lineTo( hw * 0.55,  hh);
  tub.lineTo( hw,  hh * 0.40);
  tub.lineTo( hw, -hh);
  tub.lineTo(-hw, -hh);
  tub.lineTo(-hw,  hh * 0.40);
  tub.closePath();
  const tubMesh = new Mesh(new ShapeGeometry(tub), new MeshBasicMaterial({ color: 0x0e0e1a }));
  tubMesh.position.set(0, centreY, 0);
  scene.add(tubMesh);

  const oPts = tub.getPoints(24).map(p => new Vector3(p.x, p.y + centreY, 0.01));
  oPts.push(oPts[0]);
  scene.add(makeLine(oPts, 0xf43f5e));

  // Front wing — wide flat bar at front axle level + a
  const fwY = a + 0.18;
  scene.add(makeLine([
    new Vector3(-(TW / 2 + 0.22), fwY, 0.02),
    new Vector3( (TW / 2 + 0.22), fwY, 0.02),
  ], 0xf43f5e));
  scene.add(makeLine([
    new Vector3(-(TW / 2 + 0.22), fwY - 0.10, 0.02),
    new Vector3( (TW / 2 + 0.22), fwY - 0.10, 0.02),
  ], 0xf43f5e, 0.5));

  // Rear wing at rear axle
  const rwY = -b - 0.14;
  scene.add(makeLine([
    new Vector3(-(TW / 2 + 0.08), rwY, 0.02),
    new Vector3( (TW / 2 + 0.08), rwY, 0.02),
  ], 0xf43f5e));

  // Helmet dot
  const helmetGeom = new CircleGeometry(0.12, 14);
  const helmetMesh = new Mesh(helmetGeom, new MeshBasicMaterial({ color: 0xf43f5e }));
  helmetMesh.position.set(0, centreY + overallL * 0.10, 0.03);
  scene.add(helmetMesh);
}

// ── 3D body geometry (for rear & isometric views) ────────────────────────────
// Adds Box/Cylinder geometry that gives the car visual volume.

function add3DCarGeometry(
  scene: Scene,
  vehicleClass: VehicleClass,
  L: number,
  TW: number,
  TSW: number,
  a: number,
  b: number,
): void {
  const bodyColor = vehicleClass === 'motorsport' ? 0x1e0a0a :
                    vehicleClass === 'track'       ? 0x0a0a1e : 0x12121e;
  const bodyEdge  = vehicleClass === 'motorsport' ? 0xf43f5e :
                    vehicleClass === 'track'       ? 0x6020a0 : 0x3a3a70;

  // ── Body shell ──────────────────────────────────────────────────────────────
  let BW: number, BL: number, bodyH: number;
  if (vehicleClass === 'road') {
    BW = TW + 0.22; BL = L + 0.88; bodyH = CAR_BODY_H;
  } else if (vehicleClass === 'track') {
    BW = (TW - 0.10 + TW + 0.08) / 2; BL = L + 0.70; bodyH = CAR_BODY_H * 0.90;
  } else {
    BW = 0.30; BL = L + 1.05; bodyH = FORMULA_BODY_H;
  }

  const bodyGeom = new BoxGeometry(BW, BL, bodyH);
  const bodyMesh = new Mesh(bodyGeom, new MeshBasicMaterial({ color: bodyColor }));
  bodyMesh.position.set(0, (a - b) / 2, bodyH / 2);
  scene.add(bodyMesh);

  // Body edge lines (8 edges of box — simplified as 4 top-down corners)
  const bx = BW / 2, by = BL / 2, bz_top = bodyH;
  const corners3D = [
    new Vector3(-bx, -by + (a - b) / 2, bz_top),
    new Vector3( bx, -by + (a - b) / 2, bz_top),
    new Vector3( bx,  by + (a - b) / 2, bz_top),
    new Vector3(-bx,  by + (a - b) / 2, bz_top),
    new Vector3(-bx, -by + (a - b) / 2, bz_top),
  ];
  scene.add(makeLine(corners3D, bodyEdge));

  // Vertical pillars at corners
  for (const [cx, cy] of [[-bx, -by], [bx, -by], [bx, by], [-bx, by]]) {
    scene.add(makeLine([
      new Vector3(cx, cy + (a - b) / 2, 0),
      new Vector3(cx, cy + (a - b) / 2, bz_top),
    ], bodyEdge, 0.5));
  }

  // Windscreen / cockpit top indicator
  if (vehicleClass === 'road') {
    const wsY = (a - b) / 2 + BL / 2 - 0.50;
    scene.add(makeLine([
      new Vector3(-BW * 0.26, wsY - 0.10, bz_top),
      new Vector3(-BW * 0.22, wsY + 0.24, bz_top),
      new Vector3( BW * 0.22, wsY + 0.24, bz_top),
      new Vector3( BW * 0.26, wsY - 0.10, bz_top),
    ], 0x2a3a5a));
  } else if (vehicleClass === 'track') {
    // Cockpit roll hoop bar on top
    scene.add(makeLine([
      new Vector3(-0.20, (a - b) / 2 + BL * 0.10, bz_top + 0.15),
      new Vector3( 0.20, (a - b) / 2 + BL * 0.10, bz_top + 0.15),
    ], bodyEdge));
  }

  // Formula car: nose cone as wedge and helmet
  if (vehicleClass === 'motorsport') {
    const noseGeom = new BoxGeometry(0.14, 0.55, FORMULA_BODY_H * 0.55);
    const noseMesh = new Mesh(noseGeom, new MeshBasicMaterial({ color: 0x1a0808 }));
    noseMesh.position.set(0, (a - b) / 2 + BL / 2 + 0.28, FORMULA_BODY_H * 0.28);
    scene.add(noseMesh);

    // Helmet (small sphere-ish = circle)
    const helmGeom = new CylinderGeometry(0.13, 0.13, 0.22, 12);
    const helmMesh = new Mesh(helmGeom, new MeshBasicMaterial({ color: 0xf43f5e }));
    helmMesh.rotation.x = Math.PI / 2;
    helmMesh.position.set(0, (a - b) / 2 + BL * 0.10, bodyH + 0.10);
    scene.add(helmMesh);
  }

  // ── Wheels (CylinderGeometry — looks correct from all angles) ──────────────
  const WR   = WHEEL_RADIUS;
  const WWid = TSW;           // wheel width = tyre section width
  const wheelColor = 0x1a1a2a;
  const rimColor   = 0x3a3a60;

  // Wheel positions: [x_local, y_local, steerRad]
  // We pass 0 for steer here — caller handles front rotation separately below
  const wheelDefs: Array<[number, number, boolean]> = [
    [-TW / 2,  a, true ],   // FL
    [ TW / 2,  a, true ],   // FR
    [-TW / 2, -b, false],   // RL
    [ TW / 2, -b, false],   // RR
  ];

  for (const [wx, wy] of wheelDefs) {
    // Tyre torus approximated as wide cylinder on its side (X axis = rotation axis)
    const wGeom = new CylinderGeometry(WR, WR, WWid, 20);
    const wMesh = new Mesh(wGeom, new MeshBasicMaterial({ color: wheelColor }));
    wMesh.rotation.z = Math.PI / 2;  // lay cylinder on its side (axis = X)
    wMesh.position.set(wx, wy, WR);  // z = WR so bottom touches ground
    scene.add(wMesh);

    // Rim face (inner circle outline visible from rear)
    const rimGeom = new CircleGeometry(WR * 0.60, 16);
    const rimMesh = new Mesh(rimGeom, new MeshBasicMaterial({ color: rimColor }));
    rimMesh.rotation.y = Math.PI / 2;
    rimMesh.position.set(wx + (wx > 0 ? WWid / 2 + 0.005 : -(WWid / 2 + 0.005)), wy, WR);
    scene.add(rimMesh);
  }

  // ── Ground plane strip (helps anchor the car visually in 3D views) ─────────
  const gW = TW + 1.0, gL = L + 1.2;
  const groundGeom = new BoxGeometry(gW, gL, 0.02);
  const groundMesh = new Mesh(groundGeom, new MeshBasicMaterial({ color: 0x0c0c14 }));
  groundMesh.position.set(0, (a - b) / 2, -0.01);
  scene.add(groundMesh);
  scene.add(makeLine([
    new Vector3(-gW / 2, (a - b) / 2 - gL / 2, 0.005),
    new Vector3( gW / 2, (a - b) / 2 - gL / 2, 0.005),
    new Vector3( gW / 2, (a - b) / 2 + gL / 2, 0.005),
    new Vector3(-gW / 2, (a - b) / 2 + gL / 2, 0.005),
    new Vector3(-gW / 2, (a - b) / 2 - gL / 2, 0.005),
  ], 0x1e1e30));
}

// ── Suspension struts (colored by corner load relative to static) ─────────────

function addSuspensionStruts(scene: Scene, params: VehicleParams, pacejka: PacejkaResult): void {
  const { a, b, FzFL, FzFR, FzRL, FzRR } = pacejka;
  const TW       = params.trackWidth;
  const staticFz = (params.mass * 9.81) / 4;
  const strutBot = WHEEL_RADIUS;
  const strutTop = WHEEL_RADIUS + CAR_BODY_H * 0.85;

  /** green = static, orange = compressed (outside), blue = extended (inside) */
  function strutColor(fz: number): number {
    const r = fz / staticFz;
    if (r > 1.10) return lerp32(0x4ade80, 0xf97316, Math.min((r - 1.10) / 0.40, 1));
    if (r < 0.90) return lerp32(0x4ade80, 0x60a5fa, Math.min((0.90 - r) / 0.40, 1));
    return 0x4ade80;
  }

  const corners: Array<[number, number, number]> = [
    [-TW / 2,  a,  FzFL],
    [ TW / 2,  a,  FzFR],
    [-TW / 2, -b,  FzRL],
    [ TW / 2, -b,  FzRR],
  ];

  for (const [sx, sy, fz] of corners) {
    const col = strutColor(fz);
    scene.add(makeLine([new Vector3(sx, sy, strutBot), new Vector3(sx, sy, strutTop)], col, 0.85));
    const cap = new Mesh(new CircleGeometry(0.055, 8), new MeshBasicMaterial({ color: col }));
    cap.position.set(sx, sy, strutTop + 0.01);
    scene.add(cap);
  }
}

// ── Aerodynamic downforce arrows ──────────────────────────────────────────────

function addDownforceArrows(scene: Scene, params: VehicleParams, pacejka: PacejkaResult): void {
  const { a, b, FzAeroFront, FzAeroRear } = pacejka;
  const SCALE   = 1 / 5000;    // m per N
  const bodyTop = CAR_BODY_H + 0.55;
  const downDir = new Vector3(0, 0, -1);
  const col     = 0x818cf8;    // indigo
  void params;                 // params provided for API symmetry; not needed here

  const fLen = Math.max(0.22, FzAeroFront * SCALE);
  const rLen = Math.max(0.22, FzAeroRear  * SCALE);
  scene.add(new ArrowHelper(downDir, new Vector3(0,  a * 0.55, bodyTop), fLen, col, 0.15, 0.12));
  scene.add(new ArrowHelper(downDir, new Vector3(0, -b * 0.55, bodyTop), rLen, col, 0.15, 0.12));
}

// ── Full scene: top-down layer (flat) + 3D layer ──────────────────────────────

function buildScene(
  scene:   Scene,
  params:  VehicleParams,
  result:  PhysicsResult,
  pacejka: PacejkaResult | null = null,
): void {
  const {
    wheelbase: L,
    trackWidth: TW,
    tyreSectionWidth: TSW,
    turnRadius: R,
    speedKph,
    vehicleClass,
  } = params;

  const {
    a, b,
    frontLateralForceN, rearLateralForceN,
    totalSteerAngleDeg,
    frontSlipAngleDeg, rearSlipAngleDeg,
    balance,
  } = result;

  const steerRad  = totalSteerAngleDeg * DEG_TO_RAD;
  const alphaF    = frontSlipAngleDeg  * DEG_TO_RAD;
  const alphaR    = rearSlipAngleDeg   * DEG_TO_RAD;
  const speedMs   = speedKph / 3.6;
  const speedNorm = Math.min(speedMs / 55, 1);

  // ── Road grid (z=0) ────────────────────────────────────────────────────────
  const gridColor = 0x131320, gridRange = 10;
  for (let x = -gridRange; x <= gridRange; x++) {
    scene.add(makeLine([new Vector3(x, -gridRange, -0.05), new Vector3(x, gridRange, -0.05)], gridColor));
  }
  for (let y = -gridRange; y <= gridRange; y++) {
    scene.add(makeLine([new Vector3(-gridRange, y, -0.05), new Vector3(gridRange, y, -0.05)], gridColor));
  }

  // ── Corner arc ─────────────────────────────────────────────────────────────
  const arcSpan = Math.min(2.5, 5 * L / R);
  const arcMid  = Math.PI / 2;
  for (const { r, color, opacity } of [
    { r: R - TW / 2 - 0.1, color: 0x1e2a3a, opacity: 0.6 },
    { r: R,                 color: 0x2a3a4a, opacity: 0.9 },
    { r: R + TW / 2 + 0.1, color: 0x1e2a3a, opacity: 0.6 },
  ]) {
    scene.add(makeLine(makeArc(-R, 0, r, arcMid - arcSpan / 2, arcMid + arcSpan / 2, 60), color, opacity));
  }

  const tcGeom = new CircleGeometry(0.18, 12);
  const tc     = new Mesh(tcGeom, new MeshBasicMaterial({ color: 0x2a3a5a }));
  tc.position.set(-R, 0, -0.08);
  scene.add(tc);

  // ── 3D car geometry (body + wheels, visible from all views) ────────────────
  add3DCarGeometry(scene, vehicleClass, L, TW, TSW, a, b);

  // ── Top-down class-specific flat body overlay (z ≈ 0.05+) ─────────────────
  // This sits on top of the 3D geometry, only clearly visible from directly above.
  if (vehicleClass === 'road')       addRoadBodyTopDown(scene, L, TW, a, b);
  else if (vehicleClass === 'track') addTrackBodyTopDown(scene, L, TW, a, b);
  else                               addFormulaBodyTopDown(scene, L, TW, a, b);

  // ── Wheels top-down (flat outlines, visible from above) ────────────────────
  const WW = TSW, WH = TSW * 2.4;
  const frontFrac = Math.min(frontLateralForceN / (params.mass * 9.81), 1);
  const rearFrac  = Math.min(rearLateralForceN  / (params.mass * 9.81), 1);

  for (const { x, y, rotZ, color } of [
    { x: -TW / 2, y:  a, rotZ:  steerRad, color: lerp32(0x1e1e30, 0x3040a0, frontFrac) },
    { x:  TW / 2, y:  a, rotZ:  steerRad, color: lerp32(0x1e1e30, 0x3040a0, frontFrac) },
    { x: -TW / 2, y: -b, rotZ: 0, color: lerp32(0x1e1e30, 0x3040a0, rearFrac) },
    { x:  TW / 2, y: -b, rotZ: 0, color: lerp32(0x1e1e30, 0x3040a0, rearFrac) },
  ]) {
    const hw = WW / 2, hh = WH / 2, r = 0.05;
    const ws = new Shape();
    ws.moveTo(-hw + r, -hh); ws.lineTo(hw - r, -hh);
    ws.quadraticCurveTo(hw, -hh, hw, -hh + r);
    ws.lineTo(hw, hh - r);
    ws.quadraticCurveTo(hw, hh, hw - r, hh);
    ws.lineTo(-hw + r, hh);
    ws.quadraticCurveTo(-hw, hh, -hw, hh - r);
    ws.lineTo(-hw, -hh + r);
    ws.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    const wm = new Mesh(new ShapeGeometry(ws), new MeshBasicMaterial({ color }));
    wm.position.set(x, y, 0.50);
    wm.rotation.z = rotZ;
    scene.add(wm);

    const cos = Math.cos(rotZ), sin = Math.sin(rotZ);
    const wPts = ws.getPoints(16).map(p => new Vector3(
      x + p.x * cos - p.y * sin,
      y + p.x * sin + p.y * cos,
      0.51,
    ));
    wPts.push(wPts[0]);
    scene.add(makeLine(wPts, 0x5060b0));
  }

  // ── Slip angle vectors ─────────────────────────────────────────────────────
  const slipL = 1.3, slipHL = 0.22, slipHW = 0.14;
  const frontHeadDir = new Vector3(Math.sin(steerRad), Math.cos(steerRad), 0).normalize();
  const frontVelDir  = new Vector3(Math.sin(steerRad - alphaF), Math.cos(steerRad - alphaF), 0).normalize();
  const rearHeadDir  = new Vector3(0, 1, 0);
  const rearVelDir   = new Vector3(-Math.sin(alphaR), Math.cos(alphaR), 0).normalize();

  const vecZ = 0.55;
  scene.add(new ArrowHelper(frontHeadDir, new Vector3(0, a, vecZ), slipL, 0x22d3ee, slipHL, slipHW));
  scene.add(new ArrowHelper(frontVelDir,  new Vector3(0, a, vecZ), slipL, 0xfde68a, slipHL, slipHW));
  scene.add(new ArrowHelper(rearHeadDir,  new Vector3(0, -b, vecZ), slipL, 0x22d3ee, slipHL, slipHW));
  scene.add(new ArrowHelper(rearVelDir,   new Vector3(0, -b, vecZ), slipL, 0xfde68a, slipHL, slipHW));

  // ── Lateral force arrows ───────────────────────────────────────────────────
  const leftDir      = new Vector3(-1, 0, 0);
  const frontFyColor = balance === 'understeer' ? 0xf97316 : 0x4ade80;
  const rearFyColor  = balance === 'oversteer'  ? 0xf43f5e : 0x4ade80;
  const frontLen     = Math.max(MIN_ARROW, frontLateralForceN * FORCE_SCALE);
  const rearLen      = Math.max(MIN_ARROW, rearLateralForceN  * FORCE_SCALE);
  const fH = 0.38, fW = 0.25;
  scene.add(new ArrowHelper(leftDir, new Vector3(0,  a, vecZ + 0.02), frontLen, frontFyColor, fH, fW));
  scene.add(new ArrowHelper(leftDir, new Vector3(0, -b, vecZ + 0.02), rearLen,  rearFyColor,  fH, fW));

  // ── CG marker ─────────────────────────────────────────────────────────────
  scene.add(new Mesh(new CircleGeometry(0.22, 24), new MeshBasicMaterial({ color: 0x3a2800 })));
  scene.children[scene.children.length - 1].position.set(0, 0, vecZ + 0.06);
  scene.add(new Mesh(new CircleGeometry(0.12, 24), new MeshBasicMaterial({ color: 0xfacc15 })));
  scene.children[scene.children.length - 1].position.set(0, 0, vecZ + 0.07);

  // ── Velocity arrow ─────────────────────────────────────────────────────────
  const velLen   = Math.max(0.8, speedMs * 0.06);
  const velColor = lerp32(0x2244aa, 0x60a5fa, speedNorm);
  scene.add(new ArrowHelper(new Vector3(0, 1, 0), new Vector3(0, 0, vecZ + 0.08), velLen, velColor, 0.32, 0.20));

  // ── Axle lines ────────────────────────────────────────────────────────────
  scene.add(makeLine([new Vector3(-TW / 2 - 0.05, a,  0.02), new Vector3(TW / 2 + 0.05, a,  0.02)], 0x2a2a4a));
  scene.add(makeLine([new Vector3(-TW / 2 - 0.05, -b, 0.02), new Vector3(TW / 2 + 0.05, -b, 0.02)], 0x2a2a4a));

  // ── Stage 3-6 visual enhancements (suspension struts + aero arrows) ────────
  if (pacejka) {
    addSuspensionStruts(scene, params, pacejka);
    if (pacejka.aeroDownforceN > 100) addDownforceArrows(scene, params, pacejka);
  }
}

// ── Camera definitions ────────────────────────────────────────────────────────

function makeTopDownCamera(asp: number): OrthographicCamera {
  const h = 7.5;
  const cam = new OrthographicCamera(-h * asp, h * asp, h, -h, 0.1, 200);
  cam.position.set(0, 0, 50);
  cam.lookAt(0, 0, 0);
  return cam;
}

function makeRearCamera(): PerspectiveCamera {
  // Chase-cam: behind and above the car, looking toward it
  const cam = new PerspectiveCamera(42, 1, 0.1, 200);
  cam.position.set(0, -9.5, 3.2);
  cam.lookAt(0, 0.5, 0.4);
  return cam;
}

// ── Viewport layout ───────────────────────────────────────────────────────────
//   [ top-down (60% W, 100% H) | chase-cam (40% W, 100% H) ]

function computeViewports(w: number, h: number) {
  const split = Math.round(w * 0.60);
  return {
    topdown: { x: 0,     y: 0, w: split,      h },
    rear:    { x: split, y: 0, w: w - split,  h },
  };
}

// ── React component ───────────────────────────────────────────────────────────

export function TopDownView({ params, result, pacejka, coeffs, darkMode = true }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const stateRef    = useRef<{
    scene:    Scene;
    renderer: WebGLRenderer;
    camTop:   OrthographicCamera;
    camRear:  PerspectiveCamera;
  } | null>(null);

  // Initialise renderer once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene    = new Scene();
    scene.background = new Color(darkMode ? 0x0a0a12 : 0xf2f2fa);

    const w = mount.clientWidth, h = mount.clientHeight;
    const vp = computeViewports(w, h);
    const topAsp  = vp.topdown.w / vp.topdown.h;
    const rearAsp = vp.rear.w    / vp.rear.h;

    const camTop  = makeTopDownCamera(topAsp);
    const camRear = makeRearCamera();
    camRear.aspect = rearAsp;
    camRear.updateProjectionMatrix();

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setScissorTest(true);
    mount.appendChild(renderer.domElement);

    stateRef.current = { scene, renderer, camTop, camRear };

    const render = (s: typeof stateRef.current) => {
      if (!s) return;
      const cw = mount.clientWidth, ch = mount.clientHeight;
      const dpr = window.devicePixelRatio;
      const vps = computeViewports(cw, ch);

      function setVP(vx: number, vy: number, vw: number, vh: number, cam: Camera) {
        renderer.setViewport(vx * dpr, vy * dpr, vw * dpr, vh * dpr);
        renderer.setScissor( vx * dpr, vy * dpr, vw * dpr, vh * dpr);
        renderer.render(s.scene, cam);
      }

      setVP(vps.topdown.x, vps.topdown.y, vps.topdown.w, vps.topdown.h, s.camTop);
      setVP(vps.rear.x,    vps.rear.y,    vps.rear.w,    vps.rear.h,    s.camRear);
    };

    // Store render fn for reuse on resize
    (stateRef.current as any)._render = render;

    const st = stateRef.current;
    const onResize = () => {
      const nw = mount.clientWidth, nh = mount.clientHeight;
      const vps = computeViewports(nw, nh);
      const dpr = window.devicePixelRatio;

      st.camTop.left  = -(7.5 * vps.topdown.w / vps.topdown.h);
      st.camTop.right =  (7.5 * vps.topdown.w / vps.topdown.h);
      st.camTop.updateProjectionMatrix();

      st.camRear.aspect = vps.rear.w / vps.rear.h;
      st.camRear.updateProjectionMatrix();

      renderer.setSize(nw, nh);
      renderer.setPixelRatio(dpr);
      render(stateRef.current!);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      ro.disconnect();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // Re-draw scene on params/result/pacejka change
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    clearScene(st.scene);
    buildScene(st.scene, params, result, pacejka ?? null);
    (st as any)._render?.(st);
  }, [params, result, pacejka]);

  // Update scene background on theme change
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    st.scene.background = new Color(darkMode ? 0x0a0a12 : 0xf2f2fa);
    (st as any)._render?.(st);
  }, [darkMode]);

  const fyFrontColor = result.balance === 'understeer' ? '#60a5fa' : '#4ade80';  // blue=understeer (MoTeC convention)
  const fyRearColor  = result.balance === 'oversteer'  ? '#f43f5e' : '#4ade80';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }}
        aria-label="Vehicle dynamics visualisation — top-down and chase views" />

      {/* View labels */}
      <ViewLabel text="Top View"   left="8px"  top="6px" />
      <ViewLabel text="Chase View" left="62%"  top="6px" />

      {/* ── Top-down panel overlays (confined to left 60% so Chase View stays clear) ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '60%', height: '100%', pointerEvents: 'none' }}>
        {coeffs  && <TyreCompoundBadge mu={coeffs.peakMu} />}
        {pacejka && pacejka.aeroDownforceN > 50 && <AeroOverlay pacejka={pacejka} />}
        {pacejka && <CornerLoadGauges pacejka={pacejka} params={params} />}
      </div>

      {/* Vertical divider */}
      <div style={{
        position: 'absolute', top: 0, left: '60%', width: 1,
        height: '100%', background: 'var(--border-subtle)', pointerEvents: 'none',
      }} />

      {/* Legend — bottom of the top-down panel, horizontal strip */}
      <ViewLegend fyFrontColor={fyFrontColor} fyRearColor={fyRearColor} balance={result.balance} darkMode={darkMode} />
    </div>
  );
}

// ── UI overlays ───────────────────────────────────────────────────────────────

function ViewLabel({ text, left, top }: { text: string; left: string; top: string }) {
  return (
    <div style={{
      position: 'absolute', left, top, pointerEvents: 'none',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--text-muted)',
    }}>
      {text}
    </div>
  );
}

function ArrowSvg({ color }: { color: string }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" style={{ flexShrink: 0 }}>
      <line x1="1" y1="5" x2="16" y2="5" stroke={color} strokeWidth="1.8" />
      <polygon points="16,1 22,5 16,9" fill={color} />
    </svg>
  );
}

function DotSvg({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
      <circle cx="5" cy="5" r="4" fill={color} />
    </svg>
  );
}

/** Suspension strut icon: vertical bar with spring coil indicator */
function StrutSvg({ color }: { color: string }) {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" style={{ flexShrink: 0 }}>
      <line x1="5" y1="0" x2="5" y2="4"  stroke={color} strokeWidth="2" />
      <line x1="5" y1="4" x2="2" y2="6"  stroke={color} strokeWidth="1.2" />
      <line x1="2" y1="6" x2="8" y2="8"  stroke={color} strokeWidth="1.2" />
      <line x1="8" y1="8" x2="2" y2="10" stroke={color} strokeWidth="1.2" />
      <line x1="2" y1="10" x2="5" y2="12" stroke={color} strokeWidth="1.2" />
      <line x1="5" y1="12" x2="5" y2="16" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** Downforce arrow icon: vertical arrow pointing downward */
function DownforceSvg({ color }: { color: string }) {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" style={{ flexShrink: 0 }}>
      <line x1="5" y1="0" x2="5" y2="10" stroke={color} strokeWidth="1.8" />
      <polygon points="1,9 5,16 9,9" fill={color} />
    </svg>
  );
}

function ViewLegend({ fyFrontColor, fyRearColor, balance, darkMode = true }: {
  fyFrontColor: string; fyRearColor: string; balance: Balance; darkMode?: boolean;
}) {
  const balanceNote =
    balance === 'understeer' ? 'front harder' :
    balance === 'oversteer'  ? 'rear harder'  : 'balanced';

  // Horizontal strip pinned to the bottom of the top-down panel (left 60%)
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, width: '60%',
      background: darkMode ? 'rgba(10,10,18,0.85)' : 'rgba(242,242,250,0.90)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '5px 12px',
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      gap: 16, flexWrap: 'wrap',
      pointerEvents: 'none',
    }}>
      <span style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
        Legend
      </span>
      <LegendItem icon={<ArrowSvg color="#22d3ee" />} label="Wheel heading" />
      <LegendItem icon={<ArrowSvg color="#fde68a" />} label="Contact velocity (gap = α)" />
      <LegendItem icon={<ArrowSvg color={fyFrontColor} />} label={`Front Fy (${balanceNote}) · blue=US red=OS`} />
      <LegendItem icon={<ArrowSvg color={fyRearColor}  />} label="Rear Fy" />
      <LegendItem icon={<ArrowSvg color="#60a5fa" />} label="Speed" />
      <LegendItem icon={<DotSvg   color="#facc15" />} label="CG" />
      <LegendItem icon={<DotSvg   color="#3a607a" />} label="Turn centre" />
      <LegendItem icon={<StrutSvg  color="#a78bfa" />} label="Suspension strut (colour = Fz load)" />
      <LegendItem icon={<DownforceSvg color="#34d399" />} label="Downforce arrow (aero > 100 N)" />
    </div>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      {icon}
      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

// ── Right-panel overlay components ────────────────────────────────────────────

/** Small SVG tyre cross-section icon */
function TyreIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8.5" fill="none" stroke={color} strokeWidth="3.8" />
      <circle cx="11" cy="11" r="4.0" fill="none" stroke={color} strokeWidth="1"   opacity="0.55" />
      {([0, 90, 180, 270] as number[]).map(deg => {
        const r  = deg * Math.PI / 180;
        const x1 = 11 + Math.cos(r) * 4.5, y1 = 11 + Math.sin(r) * 4.5;
        const x2 = 11 + Math.cos(r) * 6.0, y2 = 11 + Math.sin(r) * 6.0;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1" opacity="0.45" />;
      })}
    </svg>
  );
}

function TyreCompoundBadge({ mu }: { mu: number }) {
  const compound =
    mu >= 1.45 ? { name: 'Slick',        color: '#dc2626' } :
    mu >= 1.25 ? { name: 'Semi-Slick',   color: '#f97316' } :
    mu >= 1.05 ? { name: 'Sport UHP',    color: '#f59e0b' } :
    mu >= 0.90 ? { name: 'Road Sport',   color: '#38bdf8' } :
                 { name: 'All-Season',   color: '#22d3ee' };

  const surface =
    mu >= 1.20 ? 'Dry track' :
    mu >= 0.95 ? 'Dry asphalt' :
    mu >= 0.75 ? 'Damp surface' :
                 'Wet / winter';

  return (
    <div style={{ position: 'absolute', top: 26, right: 8, display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: 'none' }}>
      {/* Tyre compound badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(10,10,18,0.82)', border: `1px solid ${compound.color}40`,
        borderRadius: 5, padding: '4px 8px',
      }}>
        <TyreIcon color={compound.color} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: compound.color, letterSpacing: '0.04em' }}>
            {compound.name}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 1 }}>
            peak &mu; = {mu.toFixed(2)}
          </div>
        </div>
      </div>
      {/* Road surface */}
      <div style={{
        background: 'rgba(10,10,18,0.72)', border: '1px solid var(--border-subtle)',
        borderRadius: 4, padding: '3px 7px',
        fontSize: 8, color: 'var(--text-faint)', letterSpacing: '0.04em',
      }}>
        Road: {surface}
      </div>
    </div>
  );
}

function AeroOverlay({ pacejka }: { pacejka: PacejkaResult }) {
  const { aeroDownforceN, aeroDragN } = pacejka;
  const ld = aeroDragN > 0 ? (aeroDownforceN / aeroDragN).toFixed(2) : '—';
  return (
    <div style={{
      position: 'absolute', top: 108, right: 8, pointerEvents: 'none',
      background: 'rgba(10,10,18,0.80)', border: '1px solid rgba(129,140,248,0.35)',
      borderRadius: 5, padding: '5px 8px', minWidth: 96,
    }}>
      <div style={{ fontSize: 8, color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        Aero
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { label: 'DF',   value: `${(aeroDownforceN / 1000).toFixed(2)} kN` },
          { label: 'Drag', value: `${(aeroDragN       / 1000).toFixed(2)} kN` },
          { label: 'L/D',  value: ld },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 9 }}>
            <span style={{ color: 'var(--text-faint)' }}>{label}</span>
            <span style={{ color: '#c7d2fe', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CornerBar({ label, fz, max, staticFz }: { label: string; fz: number; max: number; staticFz: number }) {
  const pct   = (fz / max) * 100;
  const ratio = fz / staticFz;
  const color = ratio > 1.10 ? '#f97316' : ratio < 0.90 ? '#60a5fa' : '#4ade80';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
        <span style={{ color: 'var(--text-faint)' }}>{label}</span>
        <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{(fz / 1000).toFixed(2)}k</span>
      </div>
      <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function CornerLoadGauges({ pacejka, params }: { pacejka: PacejkaResult; params: VehicleParams }) {
  const { FzFL, FzFR, FzRL, FzRR } = pacejka;
  const staticFz = (params.mass * 9.81) / 4;
  const maxFz    = Math.max(FzFL, FzFR, FzRL, FzRR, staticFz * 1.4);
  return (
    <div style={{
      position: 'absolute', bottom: 8, right: 8, pointerEvents: 'none',
      background: 'rgba(10,10,18,0.82)', border: '1px solid var(--border-subtle)',
      borderRadius: 6, padding: '6px 8px', minWidth: 112,
    }}>
      <div style={{ fontSize: 8, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
        Corner loads
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px' }}>
        <CornerBar label="FL" fz={FzFL} max={maxFz} staticFz={staticFz} />
        <CornerBar label="FR" fz={FzFR} max={maxFz} staticFz={staticFz} />
        <CornerBar label="RL" fz={FzRL} max={maxFz} staticFz={staticFz} />
        <CornerBar label="RR" fz={FzRR} max={maxFz} staticFz={staticFz} />
      </div>
    </div>
  );
}
