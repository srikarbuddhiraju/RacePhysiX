/**
 * Top-down 2D visualisation of the bicycle model scenario.
 * Shows: car body, wheels (front steered), lateral force vectors at each axle.
 *
 * Three.js coordinate system used here:
 *   +Y = forward (car heading)
 *   +X = rightward
 *   +Z = out of screen (camera above, looking down)
 *
 * Scenario: left-hand turn. Lateral forces (Fy) point in −X direction (toward turn centre).
 */

import { useEffect, useRef } from 'react';
import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  Color,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  ArrowHelper,
  Vector3,
  LineSegments,
  EdgesGeometry,
  LineBasicMaterial,
  CircleGeometry,
  DoubleSide,
  BufferGeometry,
  Line,
  Material,
  Object3D,
} from 'three';
import type { VehicleParams, PhysicsResult } from '../physics/types';

interface Props {
  params: VehicleParams;
  result: PhysicsResult;
}

const TRACK_WIDTH = 1.8;      // m, visual track width (not physics)
const BODY_OVERHANG = 0.4;    // m, body extends beyond each axle
const WHEEL_W = 0.22;         // m
const WHEEL_H = 0.55;         // m
const FRUSTUM_HALF = 8;       // m, half-height of orthographic view
const FORCE_SCALE = 1 / 4000; // m per N (arrow length)
const MIN_ARROW = 0.3;        // m, minimum arrow length for visibility

// ── Scene clear & dispose ────────────────────────────────────────────────────

function clearScene(scene: Scene): void {
  const toDispose: Array<BufferGeometry | Material> = [];

  scene.traverse((obj: Object3D) => {
    if (obj instanceof Mesh || obj instanceof Line) {
      toDispose.push(obj.geometry);
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => toDispose.push(m));
      } else {
        toDispose.push(obj.material);
      }
    }
  });

  scene.clear();
  toDispose.forEach((d) => d.dispose());
}

// ── Scene drawing ────────────────────────────────────────────────────────────

function drawScene(scene: Scene, params: VehicleParams, result: PhysicsResult): void {
  const { wheelbase: L } = params;
  const { a, b, frontLateralForceN, rearLateralForceN, totalSteerAngleDeg, balance } = result;

  // Car body — centred at origin, CG at y=0
  const bodyLength = L + BODY_OVERHANG * 2;
  const bodyWidth  = TRACK_WIDTH + 0.1;

  // CG offset from body centre: front axle is at y=+a, rear at y=-b.
  // Body centre is midpoint of axles = (a - b) / 2 from CG.
  const bodyCentreY = (a - b) / 2;

  const bodyGeom = new PlaneGeometry(bodyWidth, bodyLength);
  const bodyMat  = new MeshBasicMaterial({ color: 0x1e1e2e, side: DoubleSide });
  const body = new Mesh(bodyGeom, bodyMat);
  body.position.set(0, bodyCentreY, 0);
  scene.add(body);

  const edgeGeom = new EdgesGeometry(bodyGeom);
  const edgeMat  = new LineBasicMaterial({ color: 0x5050a0 });
  const edges = new LineSegments(edgeGeom, edgeMat);
  edges.position.set(0, bodyCentreY, 0.01);
  scene.add(edges);

  // ── Wheels ────────────────────────────────────────────────────────────────
  const steerRad = (totalSteerAngleDeg * Math.PI) / 180;

  const addWheel = (x: number, y: number, rotZ: number): void => {
    const wGeom = new PlaneGeometry(WHEEL_W, WHEEL_H);
    const wMat  = new MeshBasicMaterial({ color: 0x303048, side: DoubleSide });
    const wheel = new Mesh(wGeom, wMat);
    wheel.position.set(x, y, 0.02);
    wheel.rotation.z = rotZ;
    scene.add(wheel);

    const wEdge = new EdgesGeometry(wGeom);
    const wEdgeMat = new LineBasicMaterial({ color: 0x6060a0 });
    const wEdgeMesh = new LineSegments(wEdge, wEdgeMat);
    wEdgeMesh.position.set(x, y, 0.03);
    wEdgeMesh.rotation.z = rotZ;
    scene.add(wEdgeMesh);
  };

  // Front wheels — steered (positive steerRad = left turn = counterclockwise = +Z rotation)
  addWheel(-TRACK_WIDTH / 2, a, steerRad);
  addWheel( TRACK_WIDTH / 2, a, steerRad);

  // Rear wheels — straight
  addWheel(-TRACK_WIDTH / 2, -b, 0);
  addWheel( TRACK_WIDTH / 2, -b, 0);

  // ── Lateral force arrows ──────────────────────────────────────────────────
  // Left turn: forces point in −X direction (toward turn centre on the left)
  const leftDir = new Vector3(-1, 0, 0);

  const frontLen = Math.max(MIN_ARROW, frontLateralForceN * FORCE_SCALE);
  const rearLen  = Math.max(MIN_ARROW, rearLateralForceN  * FORCE_SCALE);

  // Colour: the higher-slip axle is highlighted in orange (working harder)
  // understeer → front stressed, oversteer → rear stressed, neutral → both green
  const frontColor = balance === 'understeer' ? 0xf97316 : 0x4ade80;
  const rearColor  = balance === 'oversteer'  ? 0xf43f5e : 0x4ade80;

  const headLen  = 0.35;
  const headW    = 0.22;

  const frontArrow = new ArrowHelper(
    leftDir,
    new Vector3(0, a, 0.04),
    frontLen, frontColor, headLen, headW,
  );
  scene.add(frontArrow);

  const rearArrow = new ArrowHelper(
    leftDir,
    new Vector3(0, -b, 0.04),
    rearLen, rearColor, headLen, headW,
  );
  scene.add(rearArrow);

  // ── CG marker ─────────────────────────────────────────────────────────────
  const cgGeom = new CircleGeometry(0.15, 16);
  const cgMat  = new MeshBasicMaterial({ color: 0xfacc15 });
  const cg = new Mesh(cgGeom, cgMat);
  cg.position.set(0, 0, 0.05);
  scene.add(cg);

  // ── Forward velocity arrow ────────────────────────────────────────────────
  const velArrow = new ArrowHelper(
    new Vector3(0, 1, 0),
    new Vector3(0, a + BODY_OVERHANG, 0.04),
    1.4, 0x6080ff, 0.3, 0.2,
  );
  scene.add(velArrow);

  // ── Axle centreline markers ───────────────────────────────────────────────
  const axleMat = new LineBasicMaterial({ color: 0x303050 });

  const addAxleLine = (y: number): void => {
    const pts = [
      new Vector3(-TRACK_WIDTH / 2 - 0.1, y, 0.01),
      new Vector3( TRACK_WIDTH / 2 + 0.1, y, 0.01),
    ];
    const geom = new BufferGeometry().setFromPoints(pts);
    scene.add(new Line(geom, axleMat));
  };

  addAxleLine(a);
  addAxleLine(-b);
}

// ── React component ──────────────────────────────────────────────────────────

export function TopDownView({ params, result }: Props) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const sceneRef  = useRef<Scene | null>(null);
  const cameraRef = useRef<OrthographicCamera | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);

  // Initialise renderer once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new Scene();
    scene.background = new Color(0x0a0a12);

    const w = mount.clientWidth;
    const h = mount.clientHeight;
    const aspect = w / h;

    const camera = new OrthographicCamera(
      -FRUSTUM_HALF * aspect,
       FRUSTUM_HALF * aspect,
       FRUSTUM_HALF,
      -FRUSTUM_HALF,
      0.1, 200,
    );
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    sceneRef.current   = scene;
    cameraRef.current  = camera;
    rendererRef.current = renderer;

    const onResize = (): void => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      const asp = nw / nh;

      camera.left   = -FRUSTUM_HALF * asp;
      camera.right  =  FRUSTUM_HALF * asp;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);

      if (sceneRef.current) renderer.render(sceneRef.current, camera);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      ro.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // Redraw whenever params or result change
  useEffect(() => {
    const scene    = sceneRef.current;
    const camera   = cameraRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !renderer) return;

    clearScene(scene);
    drawScene(scene, params, result);
    renderer.render(scene, camera);
  }, [params, result]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%' }}
      aria-label="Top-down vehicle dynamics visualisation"
    />
  );
}
