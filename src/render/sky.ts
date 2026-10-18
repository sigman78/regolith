/**
 * Time of day on Mars. One sol is 24h 39m; we pretend it is 24 hours and let
 * the player scrub it. Returns sun direction and the palette for the sky, sun
 * and ambient. Martian sunsets are blue near the sun and the sky is
 * butterscotch at noon; we lean into that because it is distinctive.
 */
import { Color, Vector3 } from 'three';

export interface SkyState {
  /** 0..24 */
  hour: number;
  /** unit vector pointing from the scene toward the sun */
  sunDir: Vector3;
  /** 0..1, 0 below horizon */
  sunAltitude: number;
  sunColor: Color;
  sunIntensity: number;
  skyZenith: Color;
  skyHorizon: Color;
  ambientSky: Color;
  ambientGround: Color;
  ambientIntensity: number;
  fogColor: Color;
}

const NOON_SKY_ZENITH = new Color('#c99a6b');
const NOON_SKY_HORIZON = new Color('#e8c39a');
const DUSK_SKY_ZENITH = new Color('#5a3f55');
const DUSK_SKY_HORIZON = new Color('#6f8fc9'); // the blue halo around a Martian sunset
const NIGHT_SKY_ZENITH = new Color('#0b0d16');
const NIGHT_SKY_HORIZON = new Color('#1a1b2a');
const SUN_NOON = new Color('#fff1dc');
const SUN_LOW = new Color('#ffb070');
const GROUND = new Color('#8a4a2a');

function mix(out: Color, a: Color, b: Color, t: number): Color {
  return out.copy(a).lerp(b, Math.min(Math.max(t, 0), 1));
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

export function computeSky(hour: number, latitudeDeg = 18): SkyState {
  const h = ((hour % 24) + 24) % 24;
  const dayAngle = ((h - 12) / 24) * Math.PI * 2; // 0 at noon
  const lat = (latitudeDeg * Math.PI) / 180;
  // Sun on a tilted circle; good enough for a toy, no ephemeris needed.
  const elev = Math.cos(dayAngle) * Math.cos(lat);
  const sunDir = new Vector3(Math.sin(dayAngle), elev, -Math.sin(lat) * Math.cos(dayAngle) * 0.6).normalize();
  const altitude = Math.max(0, sunDir.y);

  // 0 = night, 1 = full day, with a twilight band around the horizon.
  const dayness = smoothstep(-0.08, 0.25, sunDir.y);
  const duskness = 1 - Math.abs(smoothstep(-0.2, 0.2, sunDir.y) * 2 - 1); // peaks at horizon

  const skyZenith = new Color();
  const skyHorizon = new Color();
  mix(skyZenith, NIGHT_SKY_ZENITH, NOON_SKY_ZENITH, dayness);
  mix(skyHorizon, NIGHT_SKY_HORIZON, NOON_SKY_HORIZON, dayness);
  skyZenith.lerp(DUSK_SKY_ZENITH, duskness * 0.7);
  skyHorizon.lerp(DUSK_SKY_HORIZON, duskness * 0.85);

  const sunColor = mix(new Color(), SUN_LOW, SUN_NOON, smoothstep(0.05, 0.5, altitude));
  const sunIntensity = altitude > 0 ? 2.2 * smoothstep(0, 0.12, altitude) + 0.6 * altitude : 0;

  const ambientSky = skyHorizon.clone().lerp(skyZenith, 0.5);
  const ambientGround = GROUND.clone().multiplyScalar(0.35 + 0.65 * dayness);
  const ambientIntensity = 0.25 + 0.9 * dayness;

  return {
    hour: h,
    sunDir,
    sunAltitude: altitude,
    sunColor,
    sunIntensity,
    skyZenith,
    skyHorizon,
    ambientSky,
    ambientGround,
    ambientIntensity,
    fogColor: skyHorizon.clone(),
  };
}
