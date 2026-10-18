/**
 * First letter of the alphabet: H, the horizontal habitat module.
 * Built from a shared profile so every pressurized part has the same rib,
 * flange and bevel vocabulary. Placeholder geometry for the scaffold; the
 * real generator lives behind the grammar layer and emits port data too.
 */
import { BufferGeometry, Group, LatheGeometry, Mesh, Vector2 } from 'three';
import { materials } from '@/render/materials';

export interface HabParams {
  /** metres, end cap to end cap */
  length: number;
  radius: number;
  /** rib every N metres */
  ribSpacing?: number;
}

const BEVEL = 0.06; // one bevel size everywhere, see design guide
const FLANGE = 0.1; // flange thickness as fraction of radius

/** Lathe profile in (r, y) with y along the module axis. */
function hullProfile(p: HabParams): Vector2[] {
  const r = p.radius;
  const half = p.length / 2;
  const cap = r * 0.35; // shallow dome end cap
  const pts: Vector2[] = [];
  pts.push(new Vector2(0, -half - cap));
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    const a = (t * Math.PI) / 2;
    pts.push(new Vector2(Math.sin(a) * r, -half - Math.cos(a) * cap));
  }
  pts.push(new Vector2(r, half));
  for (let i = 5; i >= 0; i--) {
    const t = i / 6;
    const a = (t * Math.PI) / 2;
    pts.push(new Vector2(Math.sin(a) * r, half + Math.cos(a) * cap));
  }
  return pts;
}

function ribProfile(r: number, y: number, thick: number, flange: number): Vector2[] {
  const b = Math.min(BEVEL, thick / 2);
  return [
    new Vector2(r - 0.01, y - thick / 2),
    new Vector2(r + flange - b, y - thick / 2),
    new Vector2(r + flange, y - thick / 2 + b),
    new Vector2(r + flange, y + thick / 2 - b),
    new Vector2(r + flange - b, y + thick / 2),
    new Vector2(r - 0.01, y + thick / 2),
  ];
}

export function buildHab(p: HabParams): Group {
  const g = new Group();
  const segments = 32;

  const hull = new Mesh(new LatheGeometry(hullProfile(p), segments), materials.hull);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  const spacing = p.ribSpacing ?? 2;
  const count = Math.max(1, Math.round(p.length / spacing));
  const ribGeos: BufferGeometry[] = [];
  for (let i = 0; i <= count; i++) {
    const y = -p.length / 2 + (p.length * i) / count;
    const isEnd = i === 0 || i === count;
    ribGeos.push(
      new LatheGeometry(ribProfile(p.radius, y, isEnd ? 0.28 : 0.18, p.radius * FLANGE), segments),
    );
  }
  for (const rg of ribGeos) {
    const rib = new Mesh(rg, materials.graphite);
    rib.castShadow = true;
    rib.receiveShadow = true;
    g.add(rib);
  }

  // Accent stripe: one band of orange, offset slightly to avoid z-fighting.
  const stripe = new Mesh(
    new LatheGeometry(
      [new Vector2(p.radius + 0.012, -0.5), new Vector2(p.radius + 0.012, 0.5)],
      segments,
    ),
    materials.accent,
  );
  stripe.position.y = p.length / 2 - 1.4;
  g.add(stripe);

  // Lathe is along Y; habs lie down.
  g.rotation.z = Math.PI / 2;
  return g;
}
