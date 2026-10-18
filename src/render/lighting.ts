/**
 * The sun, ambient fill and fog, driven by the hour. Owns the directional
 * light (and its shadow settings); sky colours come from sky.ts. M2 adds the
 * rim light, shadow-frustum fitting and the sky dome here.
 */
import { Color, DirectionalLight, Fog, HemisphereLight, type Scene, type Vector3 } from 'three';
import { setNightGlow } from './materials';
import { edgeFade } from './shader-patches';
import { computeSky } from './sky';
import { SkyDome } from './sky-dome';

const SUN_DISTANCE = 80;

export class Lighting {
  private readonly sun = new DirectionalLight(0xffffff, 2);
  private readonly hemi = new HemisphereLight(0xffffff, 0x000000, 1);
  private readonly fog = new Fog(new Color('#e8c39a'), 120, 380);
  private readonly dome: SkyDome;
  /** Tone-map exposure for the current hour; the renderer reads it each frame. */
  exposure = 1.1;

  constructor(private readonly scene: Scene) {
    const s = this.sun;
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    s.shadow.camera.near = 1;
    s.shadow.camera.far = 200;
    s.shadow.camera.left = -50;
    s.shadow.camera.right = 50;
    s.shadow.camera.top = 50;
    s.shadow.camera.bottom = -50;
    s.shadow.normalBias = 0.06;
    s.shadow.bias = -0.0002;
    scene.add(s, s.target, this.hemi);
    scene.fog = this.fog;
    this.dome = new SkyDome(scene);
  }

  /** Apply the sky for `hour`, with the sun and its shadow box following `focus`. */
  apply(hour: number, focus: Vector3): void {
    const s = computeSky(hour);
    this.sun.position.copy(s.lightDir).multiplyScalar(SUN_DISTANCE).add(focus);
    this.sun.target.position.copy(focus);
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    this.sun.visible = s.sunIntensity > 0.001;
    this.hemi.color.copy(s.ambientSky);
    this.hemi.groundColor.copy(s.ambientGround);
    this.hemi.intensity = s.ambientIntensity;
    this.scene.background = s.skyHorizon;
    this.dome.update(s, focus);
    this.exposure = s.exposure;
    edgeFade.color.value.copy(s.skyHorizon);
    this.fog.color.copy(s.fogColor);
    setNightGlow(1 - Math.min(1, s.sunAltitude * 6));
  }
}
