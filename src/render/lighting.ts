/**
 * The sun, ambient fill and fog, driven by the hour. Owns the directional
 * light (and its shadow settings); sky colours come from sky.ts. M2 adds the
 * rim light, shadow-frustum fitting and the sky dome here.
 */
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Vector3,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { setNightGlow } from './materials';
import { edgeFade } from './shader-patches';
import { fitSunShadow } from './shadow-fit';
import { computeSky } from './sky';
import { SkyDome } from './sky-dome';
import { SkyEnvironment } from './sky-env';

/** The rim light sits opposite the sun at this fixed distance; it casts no shadow. */
const RIM_DISTANCE = 60;
const RIM_INTENSITY = 0.3;

export class Lighting {
  private readonly sun = new DirectionalLight(0xffffff, 2);
  private readonly hemi = new HemisphereLight(0xffffff, 0x000000, 1);
  private readonly fog = new Fog(new Color('#e8c39a'), 120, 380);
  private readonly rim = new DirectionalLight(0xffffff, RIM_INTENSITY);
  private readonly dome: SkyDome;
  private readonly env: SkyEnvironment;
  private boundsCenter = new Vector3();
  private boundsRadius = 30;
  /** Tone-map exposure for the current hour; the renderer reads it each frame. */
  exposure = 1.1;

  constructor(
    private readonly scene: Scene,
    renderer: WebGLRenderer,
  ) {
    const s = this.sun;
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    s.shadow.normalBias = 0.03;
    s.shadow.bias = -0.0005;
    this.rim.castShadow = false;
    scene.add(s, s.target, this.hemi, this.rim, this.rim.target);
    scene.fog = this.fog;
    this.dome = new SkyDome(scene);
    this.env = new SkyEnvironment(renderer);
  }

  /**
   * The sphere the shadow box must cover: the base (not the camera), so panning does not
   * change what is sharp. Call when the resolved base changes.
   */
  setBounds(center: Vector3, radius: number): void {
    this.boundsCenter.copy(center);
    this.boundsRadius = Math.min(Math.max(radius, 20), 60);
  }

  /** Apply the sky for `hour`; the dome follows `focus`, the shadow box the base bounds. */
  apply(hour: number, focus: Vector3): void {
    const s = computeSky(hour);
    fitSunShadow(this.sun, this.boundsCenter, this.boundsRadius, s.lightDir);
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    this.sun.visible = s.sunIntensity > 0.001;
    this.hemi.color.copy(s.ambientSky);
    this.hemi.groundColor.copy(s.ambientGround);
    this.hemi.intensity = s.ambientIntensity;
    this.scene.background = s.skyHorizon;
    this.dome.update(s, focus);
    this.env.update(s);
    // Rim: sky-coloured, opposite the sun, to separate white hull from pale sky.
    this.rim.position
      .set(-s.lightDir.x, 0.35, -s.lightDir.z)
      .normalize()
      .multiplyScalar(RIM_DISTANCE)
      .add(focus);
    this.rim.target.position.copy(focus);
    this.rim.color.copy(s.skyHorizon);
    this.rim.intensity = RIM_INTENSITY * Math.min(1, s.sunIntensity);
    this.exposure = s.exposure;
    edgeFade.color.value.copy(s.skyHorizon);
    this.fog.color.copy(s.fogColor);
    setNightGlow(1 - Math.min(1, s.sunAltitude * 6));
  }
}
