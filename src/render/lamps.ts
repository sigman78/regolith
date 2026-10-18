/**
 * Draws lamp heads (sim/lamps.ts) as one instanced mesh with per-instance colour: the airlock
 * lamp is warm when idle, orange while sealing, yellow while pumping, green when open. Colours are
 * palette entries only (DESIGN_GUIDE: accent orange, warning yellow, plant green, window warm).
 */
import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, type Scene } from 'three';
import { lampGeometry } from '@/geometry/lamp';
import { materials, PALETTE } from './materials';

/** The phases a lamp can show (the sim's `LockPhase`). */
export type LampPhase = 'idle' | 'seal' | 'pump' | 'open';

export interface LampPlacement {
  phase: LampPhase;
  matrix: readonly number[];
}

const COLOURS: Record<LampPhase, Color> = {
  idle: new Color(PALETTE.windowWarm),
  seal: new Color(PALETTE.accentOrange),
  pump: new Color(PALETTE.warningYellow),
  open: new Color(PALETTE.plantGreen),
};

/** Airlocks drawn at most; more are ignored (the world holds far fewer). */
const CAPACITY = 64;

export class Lamps {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();

  constructor(scene: Scene) {
    this.mesh = new InstancedMesh(lampGeometry(), materials.lamp, CAPACITY);
    this.mesh.name = 'lamps';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // The colour buffer exists from the start so the shader always has `instanceColor`.
    this.mesh.setColorAt(0, COLOURS.idle);
    scene.add(this.mesh);
  }

  get count(): number {
    return this.mesh.count;
  }

  set(lamps: readonly LampPlacement[]): void {
    const n = Math.min(lamps.length, CAPACITY);
    for (let i = 0; i < n; i++) {
      const lamp = lamps[i];
      if (!lamp) continue;
      this.m.fromArray(lamp.matrix as number[]);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, COLOURS[lamp.phase]);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
