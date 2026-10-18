/**
 * The suited crew member seen outdoors: a chunky figure in hull white with a graphite pack and
 * visor, feet at y = 0, facing +x, about SUIT_HEIGHT tall. One recipe, shared by every instance.
 */
import type { BundleBuilder } from './bundle';
import {
  SUIT_ARM,
  SUIT_HEIGHT,
  SUIT_HELMET_RADIUS,
  SUIT_LEG,
  SUIT_PACK,
  SUIT_SEGMENTS,
  SUIT_TORSO,
  SUIT_VISOR,
} from './design-constants';
import { bevelBox, lathe, sphereProfile } from './profiles';

export function buildSuit(out: BundleBuilder): void {
  const torsoY = SUIT_LEG[1];
  for (const side of [1, -1]) {
    const leg = bevelBox(SUIT_LEG[0], SUIT_LEG[1], SUIT_LEG[2]);
    leg.translate(0, 0, side * 0.13);
    out.add('hull', leg);

    const arm = bevelBox(SUIT_ARM[0], SUIT_ARM[1], SUIT_ARM[2]);
    arm.translate(0, torsoY + SUIT_TORSO[1] - SUIT_ARM[1] - 0.02, side * (SUIT_TORSO[2] / 2 + 0.1));
    out.add('hull', arm);
  }

  const torso = bevelBox(SUIT_TORSO[0], SUIT_TORSO[1], SUIT_TORSO[2]);
  torso.translate(0, torsoY, 0);
  out.add('hull', torso);

  // The helmet sits on the shoulders; its top is the figure's height.
  const helmetY = SUIT_HEIGHT - SUIT_HELMET_RADIUS;
  const helmet = lathe(sphereProfile(SUIT_HELMET_RADIUS, 8), SUIT_SEGMENTS);
  helmet.translate(0, helmetY, 0);
  out.add('hull', helmet);

  const visor = bevelBox(SUIT_VISOR[0], SUIT_VISOR[1], SUIT_VISOR[2]);
  visor.translate(SUIT_HELMET_RADIUS - 0.06, helmetY - SUIT_VISOR[1] / 2, 0);
  out.add('graphite', visor);

  const pack = bevelBox(SUIT_PACK[0], SUIT_PACK[1], SUIT_PACK[2]);
  pack.translate(-(SUIT_TORSO[0] / 2 + SUIT_PACK[0] / 2 - 0.02), torsoY + 0.06, 0);
  out.add('graphite', pack);
}
