/**
 * Stage — diagnose. Checks the "always / never" list of DESIGN_GUIDE §8.4 that
 * the resolved base can answer, and reports each violation as an `invariant`
 * diagnostic. Never shown to the player; the app logs them in debug mode and
 * the property tests assert there are none.
 *
 *   stands-on-something   every STRUCT port has a leg ending on terrain or a slab top
 *   unique-serial         stencil numbers are unique among the document's parts
 *   hull-gap              no two hulls (outside slabs) overlap, per exact footprint gap
 *   tube-free-end         a tube starts and ends at a real, connected port
 *   tube-crosses-hull     a routed tube never passes through a hull it is not attached to
 *   halo-usable           a tube only ever leaves a port that can take one
 *
 * The geometry rules (watertight, outward normals, 6 cm bevel) live in
 * geometry/validate and its tests.
 */
import { DOOR_SILL, FOOT_SINK, TUBE_PORT_EMBED } from '@/geometry/design-constants';
import type { BaseDocument } from '@/world/document';
import { footprintContains, footprintGap } from '../footprint';
import { portKey } from './dock';
import { getPart } from '../registry';
import { canTakeTube, isHorizontal } from './ports';
import type {
  Diagnostic,
  InvariantRule,
  Leg,
  ResolvedBase,
  ResolvedPart,
  SolverWorld,
} from './types';

const EPS = 1e-6;
/** Tube coordinates are rounded to a millimetre in x, y and z (stable hashes), and terrain slopes, so a foot may sit a couple of mm off. */
const TUBE_ROUNDING = 2e-3;
/** Spacing of the samples used to walk a tube centreline, metres. */
const SAMPLE = 0.25;

function fail(out: Diagnostic[], rule: InvariantRule, subject: string, detail: string): void {
  out.push({ kind: 'invariant', rule, subject, detail });
}

export function diagnose(
  doc: BaseDocument,
  base: ResolvedBase,
  worlds: { terrain: SolverWorld; surface: SolverWorld },
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const parts = [...base.parts.values()];
  const isHost = (p: ResolvedPart): boolean => p.letter === 'P';

  // stands-on-something
  const checkLeg = (leg: Leg, world: SolverWorld, subject: string, tol = EPS): void => {
    const ground = world.heightAt(leg.bottom[0], leg.bottom[2]) - FOOT_SINK;
    if (Math.abs(leg.bottom[1] - ground) > tol) {
      fail(
        out,
        'stands-on-something',
        subject,
        `foot at y=${leg.bottom[1]} but ground is ${ground}`,
      );
    }
    if (leg.top[1] <= leg.bottom[1]) fail(out, 'stands-on-something', subject, 'leg points up');
  };
  for (const part of parts) {
    const structs = part.ports.filter((p) => p.type === 'STRUCT').length;
    if (part.legs.length !== structs || structs === 0) {
      fail(out, 'stands-on-something', part.id, `${part.legs.length} legs for ${structs} feet`);
    }
    for (const leg of part.legs) {
      checkLeg(leg, isHost(part) ? worlds.terrain : worlds.surface, part.id);
    }
  }
  for (const tube of base.tubes.values()) {
    for (const leg of tube.legs) checkLeg(leg, worlds.surface, tube.id, TUBE_ROUNDING);
  }

  // port-on-floor
  for (const part of parts) {
    const def = getPart(part.letter);
    const params = def?.resolve(part.params);
    const floor = params && def?.floor?.(params);
    const decks = (params && def?.floors?.(params)) || (floor === undefined ? [] : [floor]);
    for (const port of part.ports) {
      if (port.type !== 'PRESS' || !isHorizontal(port.normal)) continue;
      if (floor === undefined) {
        fail(out, 'port-on-floor', part.id, `${part.letter} has doors but no floor()`);
        break;
      }
      const off = decks.reduce((m, y) => {
        const o = port.position[1] - (part.pose.y + y);
        return Math.abs(o) < Math.abs(m) ? o : m;
      }, Infinity);
      if (Math.abs(off) > DOOR_SILL) {
        fail(out, 'port-on-floor', `${part.id}/${port.id}`, `door is ${off} m off the floor`);
      }
    }
  }

  // unique-serial
  const serials = new Set<number>();
  for (const p of Object.values(doc.parts)) {
    if (serials.has(p.serial)) fail(out, 'unique-serial', p.id, `serial ${p.serial} used twice`);
    serials.add(p.serial);
  }

  // hull-gap
  const solid = parts.filter((p) => !isHost(p));
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i];
      const b = solid[j];
      if (!a || !b) continue;
      const gap = footprintGap(
        { fp: a.footprint, pose: a.pose },
        { fp: b.footprint, pose: b.pose },
      );
      if (gap < -EPS) fail(out, 'hull-gap', `${a.id}|${b.id}`, `footprints overlap by ${-gap}`);
    }
  }

  // tubes
  const fallbacks = base.diagnostics.flatMap((d) =>
    d.kind === 'tube-unroutable' || d.kind === 'tube-too-long' ? [d.tube] : [],
  );
  for (const tube of base.tubes.values()) {
    const ends = [
      { ref: tube.a, point: tube.path[0] },
      { ref: tube.b, point: tube.path[tube.path.length - 1] },
    ];
    for (const { ref, point } of ends) {
      const part = base.parts.get(ref.part);
      const port = part?.ports.find((p) => p.id === ref.port);
      if (!part || !port || !point) {
        fail(out, 'tube-free-end', tube.id, `no port ${ref.part}/${ref.port}`);
        continue;
      }
      const d = Math.hypot(
        point[0] - port.position[0],
        point[1] - port.position[1],
        point[2] - port.position[2],
      );
      if (d > TUBE_PORT_EMBED + 0.05) {
        fail(out, 'tube-free-end', tube.id, `ends ${d} m from ${ref.part}/${ref.port}`);
      }
      if (!base.usedPorts.has(portKey(ref.part, ref.port))) {
        fail(out, 'tube-free-end', tube.id, `${ref.part}/${ref.port} is not marked used`);
      }
      if (tube.kind === 'tube' && !canTakeTube(port)) {
        fail(out, 'halo-usable', tube.id, `${ref.part}/${ref.port} cannot take a tube`);
      }
    }

    // A tube that fell back to the tight route is already flagged; do not double-report it.
    if (tube.kind !== 'tube' || fallbacks.some((f) => tube.id.startsWith(f.replace(/:\d+$/, '')))) {
      continue;
    }
    const attached = new Set([tube.a.part, tube.b.part]);
    for (let i = 0; i + 1 < tube.path.length; i++) {
      const p = tube.path[i];
      const q = tube.path[i + 1];
      if (!p || !q) continue;
      const len = Math.hypot(q[0] - p[0], q[2] - p[2]);
      const steps = Math.max(1, Math.ceil(len / SAMPLE));
      for (let s = 0; s <= steps; s++) {
        const x = p[0] + ((q[0] - p[0]) * s) / steps;
        const z = p[2] + ((q[2] - p[2]) * s) / steps;
        const hit = solid.find(
          (h) => !attached.has(h.id) && footprintContains(h.footprint, h.pose, x, z),
        );
        if (hit) {
          fail(
            out,
            'tube-crosses-hull',
            tube.id,
            `passes through ${hit.id} at ${x.toFixed(2)},${z.toFixed(2)}`,
          );
          break;
        }
      }
    }
  }
  return out;
}
