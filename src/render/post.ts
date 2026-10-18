/**
 * The post chain (DESIGN_GUIDE §7): ambient occlusion -> bloom -> ACES tone
 * map -> colour grade, with MSAA instead of FXAA. No outlines, vignette,
 * aberration or grain: soft is good, dirty is not.
 *
 * Quality presets decide how much of it runs:
 *   low    no composer: one direct render with the renderer's own tone mapping
 *   medium MSAA 4x + bloom + tone map + grade
 *   high   medium + half-resolution GTAO
 */
import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type Quality = 'low' | 'medium' | 'high';

export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

export function parseQuality(value: string | null): Quality {
  return QUALITIES.find((q) => q === value) ?? 'high';
}

/** Colour grade after the tone map: +10% saturation, lifted blacks, warm highlights. */
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.1 },
    uLift: { value: 0.018 },
    uWarm: { value: 0.07 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uLift;
    uniform float uWarm;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = mix(vec3(luma), c.rgb, uSaturation);
      col = col * (1.0 - uLift) + uLift;
      col += vec3(1.0, 0.62, 0.28) * uWarm * smoothstep(0.55, 1.0, luma);
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export class PostChain {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private ao: GTAOPass | null = null;
  private size = new Vector2(1, 1);
  private pixelRatio = 1;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private quality: Quality,
  ) {
    this.build();
  }

  get current(): Quality {
    return this.quality;
  }

  setQuality(quality: Quality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.build();
  }

  /** Bloom only takes what is brighter than this (HDR): emissives, not sunlit hull. */
  setBloomThreshold(threshold: number): void {
    if (this.bloom) this.bloom.threshold = threshold;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.size.set(width, height);
    this.pixelRatio = pixelRatio;
    this.applySize();
  }

  render(dt: number): void {
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.composer?.dispose();
  }

  private build(): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.ao = null;
    if (this.quality === 'low') return;

    const target = new WebGLRenderTarget(this.size.x, this.size.y, {
      type: HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.quality === 'high') {
      const ao = new GTAOPass(this.scene, this.camera, this.size.x / 2, this.size.y / 2);
      ao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1, thickness: 1, scale: 1.1 });
      ao.blendIntensity = 0.9;
      composer.addPass(ao);
      this.ao = ao;
    }
    const bloom = new UnrealBloomPass(this.size.clone(), 0.45, 0.55, 1.0);
    composer.addPass(bloom);
    this.bloom = bloom;
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GRADE_SHADER));
    this.composer = composer;
    this.applySize();
  }

  private applySize(): void {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.size.x, this.size.y);
    this.ao?.setSize((this.size.x * this.pixelRatio) / 2, (this.size.y * this.pixelRatio) / 2);
  }
}
