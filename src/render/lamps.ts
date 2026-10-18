/**
 * Draws lamp heads (sim/lamps.ts) as instanced meshes with per-instance colour: the airlock lamp is
 * warm when idle, orange while sealing, yellow while pumping, green when open; light poles keep
 * their head warm; the beacon ball is accent orange. Colours are palette entries only (DESIGN_GUIDE:
 * accent orange, warning yellow, plant green, window warm). Whether they glow is the material's
 * night ramp (setNightGlow), so a lamp never needs a redraw for the sun.
 */
import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, type Scene } from 'three';
import { beaconGeometry, lampGeometry } from '@/geometry/lamp';
import { LAMP_CAPACITY } from '@/geometry/design-constants';
import { materials, PALETTE } from './materials';

/** What a lamp shows (the sim's `LampTone`). */
export type LampTone = 'idle' | 'seal' | 'pump' | 'open' | 'beacon';

export interface LampPlacement {
  tone: LampTone;
  matrix: readonly number[];
}

/** The beacon ball glows at this share of the lamp colour, so night-ramp bloom keeps it orange. */
const BEACON_STRENGTH = 0.5;

const COLOURS: Record<LampTone, Color> = {
  idle: new Color(PALETTE.windowWarm),
  seal: new Color(PALETTE.accentOrange),
  pump: new Color(PALETTE.warningYellow),
  open: new Color(PALETTE.plantGreen),
  // Same hue, half the strength: at night the lamp material would push full orange to cream.
  beacon: new Color(PALETTE.accentOrange).multiplyScalar(BEACON_STRENGTH),
};

/** The base has exactly one beacon (DESIGN_GUIDE rule 8). */
const BEACON_CAPACITY = 1;

function instanced(geometry: ReturnType<typeof lampGeometry>, capacity: number, name: string) {
  const mesh = new InstancedMesh(geometry, materials.lamp, capacity);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  // The colour buffer exists from the start so the shader always has `instanceColor`.
  mesh.setColorAt(0, COLOURS.idle);
  return mesh;
}

export class Lamps {
  readonly plates: InstancedMesh;
  readonly balls: InstancedMesh;
  private readonly m = new Matrix4();

  constructor(scene: Scene) {
    this.plates = instanced(lampGeometry(), LAMP_CAPACITY, 'lamps');
    this.balls = instanced(beaconGeometry(), BEACON_CAPACITY, 'beacon');
    scene.add(this.plates, this.balls);
  }

  get count(): number {
    return this.plates.count + this.balls.count;
  }

  set(lamps: readonly LampPlacement[]): void {
    let plates = 0;
    let balls = 0;
    for (const lamp of lamps) {
      const ball = lamp.tone === 'beacon';
      const mesh = ball ? this.balls : this.plates;
      const i = ball ? balls : plates;
      if (i >= mesh.instanceMatrix.count) continue;
      this.m.fromArray(lamp.matrix as number[]);
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, COLOURS[lamp.tone]);
      if (ball) balls++;
      else plates++;
    }
    for (const [mesh, n] of [
      [this.plates, plates],
      [this.balls, balls],
    ] as const) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
