/**
 * Scaffold bootstrap: terrain, sun with time of day, snapping camera, and a
 * couple of habitat modules so there is something to look at. Everything in
 * here gets replaced by the real app shell (see docs/ARCHITECTURE.md), but
 * the pieces it uses (terrain, sky, materials, hab) are keepers.
 */
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFShadowMap,
  Scene,
  Timer,
  WebGLRenderer,
} from 'three';
import { generateTerrain, heightAt } from '@/world/terrain';
import { buildTerrainMesh } from '@/render/terrain-mesh';
import { computeSky } from '@/render/sky';
import { CameraRig } from '@/render/camera-rig';
import { buildHab } from '@/geometry/hab';
import { setNightGlow } from '@/render/materials';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;

const scene = new Scene();
scene.fog = new Fog(new Color('#e8c39a'), 60, 220);

const rig = new CameraRig(canvas);

// Terrain
const terrain = generateTerrain({ seed: 'olympus-07', size: 96 });
scene.add(buildTerrainMesh(terrain));

// Lights
const sun = new DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.normalBias = 0.06;
sun.shadow.bias = -0.0002;
scene.add(sun);
scene.add(sun.target);
const hemi = new HemisphereLight(0xffffff, 0x000000, 1);
scene.add(hemi);

// A few habs, planted on the terrain
const placements: Array<{ x: number; z: number; len: number; yaw: number }> = [
  { x: 0, z: 0, len: 8, yaw: 0 },
  { x: 7, z: -1, len: 6, yaw: Math.PI / 2 },
  { x: -8, z: 2, len: 4, yaw: 0 },
];
for (const p of placements) {
  const hab = buildHab({ length: p.len, radius: 2 });
  const y = heightAt(terrain, p.x, p.z);
  hab.position.set(p.x, y + 2.2, p.z);
  hab.rotation.y = p.yaw;
  scene.add(hab);
}

// Time of day
let hour = 15.5;
window.addEventListener('keydown', (e) => {
  if (e.key === '[') hour -= 0.5;
  if (e.key === ']') hour += 0.5;
  if (e.key === 'q') rig.rotateStep(-1);
  if (e.key === 'e') rig.rotateStep(1);
});

function applySky(): void {
  const s = computeSky(hour);
  sun.position.copy(s.sunDir).multiplyScalar(80).add(rig.target);
  sun.target.position.copy(rig.target);
  sun.color.copy(s.sunColor);
  sun.intensity = s.sunIntensity;
  sun.visible = s.sunIntensity > 0.001;
  hemi.color.copy(s.ambientSky);
  hemi.groundColor.copy(s.ambientGround);
  hemi.intensity = s.ambientIntensity;
  scene.background = s.skyHorizon;
  (scene.fog as Fog).color.copy(s.fogColor);
  setNightGlow(1 - Math.min(1, s.sunAltitude * 6));
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  rig.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

const timer = new Timer();
function frame(): void {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  rig.update(dt);
  applySky();
  renderer.render(scene, rig.camera);
  requestAnimationFrame(frame);
}
frame();
