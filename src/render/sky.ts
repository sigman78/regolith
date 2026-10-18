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
  /**
   * Direction the sunlight comes from. Never lower than LIGHT_MIN_ELEVATION, so a low sun
   * still lights the ground with long, readable shadows instead of a grazing black.
   */
  lightDir: Vector3;
  /** Tone-map exposure: a little up at twilight and more at night, so the scene stays readable. */
  exposure: number;
  skyZenith: Color;
  skyHorizon: Color;
  ambientSky: Color;
  ambientGround: Color;
  ambientIntensity: number;
  fogColor: Color;
}

/** The blue halo around the sun, strongest at sunset (DESIGN_GUIDE §5). */
export const SKY_AUREOLE = '#6f8fc9';

const NOON_SKY_ZENITH = new Color('#c99a6b');
const NOON_SKY_HORIZON = new Color('#e8c39a');
const DUSK_SKY_ZENITH = new Color('#5a3f55');
const DUSK_SKY_HORIZON = new Color('#6f8fc9'); // the blue halo around a Martian sunset
const NIGHT_SKY_ZENITH = new Color('#0b0d16');
const NIGHT_SKY_HORIZON = new Color('#1a1b2a');
// Night is not dark (design guide §5): a cool fill so the base stays readable.
const NIGHT_AMBIENT = new Color('#5a6a8a');
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

/** The sun is above the horizon for 14 of the 24 hours: up before 06:00, down after 19:00. */
const HALF_DAY_HOURS = 7;
/** sin(elevation) the sunlight is never lower than: about 9 degrees. */
const LIGHT_MIN_ELEVATION = 0.16;
/** Sun altitude at noon, degrees. */
const NOON_ALTITUDE_DEG = 68;

export function computeSky(hour: number, latitudeDeg = 18): SkyState {
  const h = ((hour % 24) + 24) % 24;
  const dayAngle = ((h - 12) / 24) * Math.PI * 2; // hour angle, 0 at noon
  const lat = (latitudeDeg * Math.PI) / 180;
  // sin(altitude) is zero at the sunrise and sunset hour angle and peaks at noon. That puts the
  // sun 11 degrees up at 06:00 and 5 degrees up at 18:30 (design guide §5: dawn and the blue
  // sunset are *light*, long and low, not night), and below the horizon by 21:00.
  const cosEdge = Math.cos((HALF_DAY_HOURS / 24) * Math.PI * 2);
  const sinAlt =
    (Math.sin((NOON_ALTITUDE_DEG * Math.PI) / 180) / (1 - cosEdge)) *
    (Math.cos(dayAngle) - cosEdge);
  const cosAlt = Math.sqrt(Math.max(0, 1 - sinAlt * sinAlt));
  // Azimuth: east in the morning, west in the evening, a little toward the pole at noon.
  const horiz = new Vector3(Math.sin(dayAngle), 0, -Math.sin(lat) * Math.cos(dayAngle) * 0.6);
  horiz.normalize().multiplyScalar(cosAlt);
  const sunDir = new Vector3(horiz.x, sinAlt, horiz.z).normalize();
  const altitude = Math.max(0, sunDir.y);

  // 0 = night, 1 = full day, with a twilight band around the horizon.
  const dayness = smoothstep(-0.08, 0.25, sunDir.y);
  // Twilight colours while the sun is low (about 0-20 degrees) and just below the horizon.
  const duskness = (1 - smoothstep(0.02, 0.4, sunDir.y)) * smoothstep(-0.2, -0.02, sunDir.y);

  const skyZenith = new Color();
  const skyHorizon = new Color();
  mix(skyZenith, NIGHT_SKY_ZENITH, NOON_SKY_ZENITH, dayness);
  mix(skyHorizon, NIGHT_SKY_HORIZON, NOON_SKY_HORIZON, dayness);
  skyZenith.lerp(DUSK_SKY_ZENITH, duskness * 0.7);
  skyHorizon.lerp(DUSK_SKY_HORIZON, duskness * 0.85);

  const sunColor = mix(new Color(), SUN_LOW, SUN_NOON, smoothstep(0.05, 0.5, altitude));
  // Keep a low warm sun a little past the geometric horizon so dusk has light in it.
  const sunIntensity = 2.4 * smoothstep(-0.06, 0.18, sunDir.y) + 0.6 * altitude;
  if (sunDir.y < 0.05) sunDir.y = 0.05 + (sunDir.y - 0.05) * 0.2; // the disc never sinks far below the horizon
  sunDir.normalize();
  const lightDir = sunDir.clone();
  lightDir.y = Math.max(lightDir.y, LIGHT_MIN_ELEVATION);
  lightDir.normalize();

  const ambientSky = NIGHT_AMBIENT.clone().lerp(skyHorizon.clone().lerp(skyZenith, 0.5), dayness);
  const ambientGround = GROUND.clone().multiplyScalar(0.35 + 0.65 * dayness);
  // Lifted at twilight too: shadows are cool and readable, never black (design guide §5).
  const ambientIntensity =
    0.7 + 0.5 * dayness + 0.35 * duskness + 0.9 * (1 - dayness) * (1 - duskness);

  return {
    hour: h,
    sunDir,
    sunAltitude: altitude,
    sunColor,
    sunIntensity,
    lightDir,
    exposure: 1.1 + 0.35 * duskness + 0.6 * (1 - dayness) * (1 - duskness),
    skyZenith,
    skyHorizon,
    ambientSky,
    ambientGround,
    ambientIntensity,
    fogColor: skyHorizon.clone(),
  };
}
