/**
 * Environment reflections from the procedural sky. The sky dome is rendered
 * into a small cube map and prefiltered (PMREM) once per half hour of the sol,
 * lazily and cached, then handed only to the materials that reflect it:
 * aluminium and glass (DESIGN_GUIDE §4). Everything else keeps the hemisphere
 * ambient, so the look does not change; this is what lets `aluminum` stop
 * rendering black.
 */
import { PMREMGenerator, Scene, Vector3, type Texture, type WebGLRenderer } from 'three';
import { materials } from './materials';
import type { SkyState } from './sky';
import { SkyDome } from './sky-dome';

/** Cube map resolution before prefiltering; reflections of a soft gradient need no more. */
const SIZE = 128;

/** Half-hour step of the sol; the cache has at most 48 entries. */
export function envKey(hour: number): number {
  return Math.round((((hour % 24) + 24) % 24) * 2) % 48;
}

export class SkyEnvironment {
  private readonly pmrem: PMREMGenerator;
  private readonly scene = new Scene();
  private readonly dome = new SkyDome(this.scene);
  private readonly cache = new Map<number, Texture>();
  private current = -1;

  constructor(renderer: WebGLRenderer) {
    this.pmrem = new PMREMGenerator(renderer);
  }

  /** Make the reflective materials use the environment for `sky`'s half hour. */
  update(sky: SkyState): void {
    const key = envKey(sky.hour);
    if (key === this.current) return;
    let tex = this.cache.get(key);
    if (!tex) {
      this.dome.update(sky, new Vector3());
      tex = this.pmrem.fromScene(this.scene, 0, 1, 1000, { size: SIZE }).texture;
      this.cache.set(key, tex);
    }
    materials.aluminum.envMap = tex;
    materials.glass.envMap = tex;
    materials.aluminum.needsUpdate = true;
    materials.glass.needsUpdate = true;
    this.current = key;
  }

  get cached(): number {
    return this.cache.size;
  }
}
