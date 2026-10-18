/**
 * The sky: an inside-out sphere with a gradient shader. Zenith and horizon
 * colours come from the hour (sky.ts); a sun disc with a blue aureole sits
 * where the sun is, and the aureole grows as the sun gets low, which is the
 * blue Martian sunset (DESIGN_GUIDE §5). Stars fade in once the sun is gone.
 *
 * It is drawn first, without depth, so it can be any size; the view direction
 * comes from the camera, so it does not matter where the sphere is centred.
 */
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Scene } from 'three';
import { SKY_AUREOLE } from './sky';
import type { SkyState } from './sky';

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAureole;
  uniform float uAureoleStrength;
  uniform float uSunVisible;
  uniform float uStars;
  varying vec3 vWorld;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float up = clamp(dir.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));

    float d = max(dot(dir, uSunDir), 0.0);
    // Wide soft aureole, then a tight bright halo, then the disc itself.
    col += uAureole * uAureoleStrength * (pow(d, 6.0) * 0.35 + pow(d, 48.0) * 0.9);
    float disc = smoothstep(0.99955, 0.99985, d);
    col = mix(col, uSunColor * 6.0, disc * uSunVisible);

    // Stars: sparse hashed points on a coarse sphere grid, only above the horizon.
    vec3 sp = floor(dir * 140.0);
    float s = step(0.9965, hash(sp));
    col += vec3(0.9, 0.95, 1.0) * s * uStars * smoothstep(0.02, 0.25, dir.y);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class SkyDome {
  private readonly material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color() },
      uHorizon: { value: new Color() },
      uSunDir: { value: new Vector3(0, 1, 0) },
      uSunColor: { value: new Color() },
      uAureole: { value: new Color(SKY_AUREOLE) },
      uAureoleStrength: { value: 0 },
      uSunVisible: { value: 1 },
      uStars: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  private readonly mesh = new Mesh(new SphereGeometry(300, 32, 16), this.material);

  constructor(scene: Scene) {
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Follow the point the camera looks at, so the sphere always surrounds the view. */
  update(sky: SkyState, focus: Vector3): void {
    const u = this.material.uniforms;
    this.mesh.position.copy(focus);
    (u['uZenith']?.value as Color).copy(sky.skyZenith);
    (u['uHorizon']?.value as Color).copy(sky.skyHorizon);
    (u['uSunDir']?.value as Vector3).copy(sky.sunDir);
    (u['uSunColor']?.value as Color).copy(sky.sunColor);
    const low = 1 - Math.min(1, sky.sunAltitude * 2.2);
    // The blue halo is faint at noon and strongest with the sun near the horizon.
    const aureole = sky.sunAltitude > 0 ? 0.25 + 0.75 * low : 0;
    this.setUniform('uAureoleStrength', aureole);
    this.setUniform('uSunVisible', sky.sunAltitude > 0.002 ? 1 : 0);
    this.setUniform('uStars', 1 - Math.min(1, sky.sunAltitude * 8));
  }

  private setUniform(name: string, value: number): void {
    const u = this.material.uniforms[name];
    if (u) u.value = value;
  }
}
