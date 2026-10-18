/**
 * The few `onBeforeCompile` patches the look needs, in one place
 * (ARCHITECTURE §6.4). Everything else uses stock three materials.
 */
import { Color, type MeshStandardMaterial } from 'three';

/** Shared with Lighting, which sets the colour to the sky's horizon each frame. */
export const edgeFade = {
  color: { value: new Color('#e8c39a') },
  /** Distance from the map centre (square, metres) where the fade starts and where it is complete. */
  start: { value: 28 },
  end: { value: 47 },
};

/**
 * Terrain dissolves into the horizon colour toward the map edge, so the edge of the
 * world is haze, not a cliff against the sky. The sky dome draws the same colour at the
 * horizon, so the two meet seamlessly.
 */
export function patchEdgeFade(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uEdgeColor'] = edgeFade.color;
    shader.uniforms['uEdgeStart'] = edgeFade.start;
    shader.uniforms['uEdgeEnd'] = edgeFade.end;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vEdgeXZ;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvEdgeXZ = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vEdgeXZ;\nuniform vec3 uEdgeColor;\nuniform float uEdgeStart;\nuniform float uEdgeEnd;',
      )
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight = mix(outgoingLight, uEdgeColor, smoothstep(uEdgeStart, uEdgeEnd, max(abs(vEdgeXZ.x), abs(vEdgeXZ.y))));\n#include <opaque_fragment>',
      );
  };
  material.customProgramCacheKey = () => 'edge-fade';
}
