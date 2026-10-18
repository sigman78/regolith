/**
 * The few `onBeforeCompile` patches the look needs, in one place
 * (ARCHITECTURE §6.4). Everything else uses stock three materials.
 */
import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  NoColorSpace,
  RGFormat,
  UnsignedByteType,
  type MeshStandardMaterial,
} from 'three';
import { WEAR_CHANNELS, type WearField } from '@/world/wear';

/** Shared with Lighting, which sets the colour to the sky's horizon each frame. */
export const edgeFade = {
  color: { value: new Color('#e8c39a') },
  /** Distance from the map centre (square, metres) where the fade starts and where it is complete. */
  start: { value: 28 },
  end: { value: 47 },
};

/** How far the regolith darkens at full wear (the rest of the dark tint is never needed). */
const WEAR_MIX = 0.9;

/**
 * The wear raster (world/wear.ts) as a texture the regolith shader reads. Starts clear; `update`
 * swaps the bytes in when the base's wear changed.
 */
export const wearMap = {
  texture: new DataTexture(new Uint8Array(WEAR_CHANNELS), 1, 1, RGFormat, UnsignedByteType),
  half: { value: 48 },
  color: { value: new Color('#7a3a1e') },
  key: '',
  update(field: WearField, half: number): void {
    if (field.key === this.key) return;
    this.key = field.key;
    this.texture.dispose();
    this.texture = new DataTexture(field.data, field.size, field.size, RGFormat, UnsignedByteType);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.colorSpace = NoColorSpace;
    this.texture.needsUpdate = true;
    this.half.value = half;
    this.sampler.value = this.texture;
  },
  sampler: { value: null as DataTexture | null },
};
wearMap.sampler.value = wearMap.texture;

function must(source: string, anchor: string, withText: string): string {
  if (!source.includes(anchor)) throw new Error(`shader patch anchor missing: ${anchor}`);
  return source.replace(anchor, withText);
}

/**
 * The regolith's two patches, in one `onBeforeCompile` (a second assignment would replace the first):
 *
 * - Terrain dissolves into the horizon colour toward the map edge, so the edge of the world is
 *   haze, not a cliff against the sky. The sky dome draws the same colour at the horizon.
 * - Wear darkens the regolith where parts and footpads have disturbed it, read from `wearMap` by
 *   world XZ. Channel G is reserved for M4's paths.
 */
export function patchRegolith(material: MeshStandardMaterial, color: string): void {
  wearMap.color.value.set(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uEdgeColor'] = edgeFade.color;
    shader.uniforms['uEdgeStart'] = edgeFade.start;
    shader.uniforms['uEdgeEnd'] = edgeFade.end;
    shader.uniforms['uWear'] = wearMap.sampler;
    shader.uniforms['uWearHalf'] = wearMap.half;
    shader.uniforms['uWearColor'] = wearMap.color;
    shader.vertexShader = must(
      shader.vertexShader,
      '#include <common>',
      '#include <common>\nvarying vec2 vEdgeXZ;',
    );
    shader.vertexShader = must(
      shader.vertexShader,
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvEdgeXZ = (modelMatrix * vec4(transformed, 1.0)).xz;',
    );
    shader.fragmentShader = must(
      shader.fragmentShader,
      '#include <common>',
      '#include <common>\nvarying vec2 vEdgeXZ;\nuniform vec3 uEdgeColor;\nuniform float uEdgeStart;\nuniform float uEdgeEnd;\nuniform sampler2D uWear;\nuniform float uWearHalf;\nuniform vec3 uWearColor;',
    );
    shader.fragmentShader = must(
      shader.fragmentShader,
      '#include <color_fragment>',
      `#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uWearColor, texture2D(uWear, (vEdgeXZ + uWearHalf) / (2.0 * uWearHalf)).r * ${WEAR_MIX.toFixed(2)});`,
    );
    shader.fragmentShader = must(
      shader.fragmentShader,
      '#include <opaque_fragment>',
      'outgoingLight = mix(outgoingLight, uEdgeColor, smoothstep(uEdgeStart, uEdgeEnd, max(abs(vEdgeXZ.x), abs(vEdgeXZ.y))));\n#include <opaque_fragment>',
    );
  };
  material.customProgramCacheKey = () => 'regolith-edge-wear';
}
