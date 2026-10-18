/**
 * Crew: small state machines that live on the press graph. An agent is never a coordinate; it is
 * "this far along step i of a route", so a dragged part carries its crew with it, and a solve that
 * removes what an agent stands on just sends the agent home. Everything is a pure function of
 * (state, world, seed, tick, sol hour): same input, same walk, byte for byte.
 *
 * Count is `floor(pressurised volume / CREW_VOLUME)` up to CREW_MAX. Each agent has a home node
 * and a three-stop errand list rebuilt every sol-hour, picked from the nodes it can reach. Between
 * OUTDOOR_FROM_HOUR and OUTDOOR_TO_HOUR one of the stops may be outdoors: through an airlock (which
 * cycles, and takes a couple at a time), to a loiter spot on open ground, and back.
 */
import {
  CREW_MAX,
  CREW_VOLUME,
  LOITER_DWELL_MIN,
  LOITER_DWELL_SPAN,
  OUTDOOR_CHANCE,
  OUTDOOR_FROM_HOUR,
  OUTDOOR_TO_HOUR,
} from '@/geometry/design-constants';
import { hashInts, hashString } from '@/core/rng';
import type { PartId } from '@/world/document';
import type { PressGraph } from '@/grammar/solver';
import { enqueue, keepWaiting, newLock, stepLock, type Lock, type LockDir } from './airlock';
import { TICK_SECONDS } from './fixed-step';
import { LOITER_CANDIDATES, type NavEnv } from './loiter';
import {
  CENTRE,
  navOf,
  polylineLength,
  route,
  routeToExit,
  sampleAlong,
  stepPolyline,
  type Nav,
  type Step,
} from './nav';

/** Walking speed, metres per second (toy-scaled, a touch brisk). */
export const WALK_SPEED = 1.4;
/** Errands per sol-hour, and the dwell range at a stop in ticks. */
export const ERRAND_STOPS = 3;
const DWELL_MIN = 20;
const DWELL_SPAN = 80;
const HOME_DWELL_MIN = 40;
const HOME_DWELL_SPAN = 120;
/** An outdoor errand is the stop `@out:<airlock>`; the rest are node ids. */
const OUT = '@out:';

/** What the crew walk on: the press graph, and the ground and keep-out outside it. */
export interface CrewWorld {
  graph: PressGraph;
  env?: NavEnv;
}

export interface Agent {
  index: number;
  home: PartId;
  /** the node it is in, or last left */
  at: PartId;
  route: Step[];
  /** index into `route` and metres along that step */
  step: number;
  s: number;
  /** ticks left to stand still */
  dwell: number;
  /** sol hour the errand list was made for (integer), the list, and how many were done */
  stopsHour: number;
  stops: string[];
  stop: number;
  /** on the ground outside an airlock (walking out, standing about, or waiting to come in) */
  outside: boolean;
  /** the airlock, its exit and the loiter slot of the current outdoor errand */
  lock: PartId;
  exit: string;
  slot: number;
  /** waiting in a lock's queue, and let through by it */
  waiting: boolean;
  cleared: boolean;
}

export interface CrewState {
  agents: Agent[];
  /** the graph the agents were last checked against */
  graph: PressGraph | null;
  /** one cycle per airlock, by node id */
  locks: Map<PartId, Lock>;
}

export function emptyCrew(): CrewState {
  return { agents: [], graph: null, locks: new Map() };
}

/** How many crew a graph supports. */
export function crewCount(graph: PressGraph): number {
  let volume = 0;
  for (const n of graph.nodes.values()) volume += n.volume;
  return Math.min(CREW_MAX, Math.floor(volume / CREW_VOLUME));
}

/** Home nodes, biggest first (ties by id), used round robin. */
function homesOf(graph: PressGraph): PartId[] {
  return [...graph.nodes.values()]
    .filter((n) => n.volume > 0)
    .sort((a, b) => b.volume - a.volume || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((n) => n.id);
}

function newAgent(index: number, home: PartId): Agent {
  return {
    index,
    home,
    at: home,
    route: [],
    step: 0,
    s: 0,
    dwell: 0,
    stopsHour: -1,
    stops: [],
    stop: 0,
    outside: false,
    lock: '',
    exit: '',
    slot: 0,
    waiting: false,
    cleared: false,
  };
}

/** Back to the home node with nothing in hand. */
function sendHome(a: Agent): void {
  a.at = a.home;
  a.route = [];
  a.step = 0;
  a.s = 0;
  a.stops = [];
  a.stopsHour = -1;
  a.outside = false;
  a.waiting = false;
  a.cleared = false;
}

/** The airlock exit of a node, if it has one (the first by id). */
function exitOf(graph: PressGraph, id: PartId): string | undefined {
  const node = graph.nodes.get(id);
  return node ? [...node.exits.keys()].sort()[0] : undefined;
}

/** The graph changed (or this is the first look): fix the agents so nothing refers to what is gone. */
export function reconcile(state: CrewState, world: CrewWorld): void {
  const graph = world.graph;
  if (state.graph === graph) return;
  state.graph = graph;
  const nav = navOf(graph, world.env);
  const homes = homesOf(graph);
  const want = homes.length === 0 ? 0 : crewCount(graph);
  state.agents.length = Math.min(state.agents.length, want);
  for (let i = state.agents.length; i < want; i++) {
    state.agents.push(newAgent(i, homes[i % homes.length] ?? ''));
  }
  for (const a of state.agents) {
    a.home = homes[a.index % homes.length] ?? a.home;
    const routeOk = a.route.every((st) => stepPolyline(nav, st) !== null);
    const outsideOk = !a.outside || (graph.nodes.get(a.lock)?.exits.has(a.exit) ?? false);
    if (!graph.nodes.has(a.at) || !graph.nodes.has(a.home) || !routeOk || !outsideOk) {
      sendHome(a);
      continue;
    }
    // The geometry of the current step may have changed length under a drag.
    const poly = a.route[a.step] ? stepPolyline(nav, a.route[a.step] as Step) : null;
    if (poly) a.s = Math.min(a.s, polylineLength(poly));
  }

  // One cycle per airlock; whoever waited at one that is gone has been sent home above.
  for (const id of [...state.locks.keys()]) if (!exitOf(graph, id)) state.locks.delete(id);
  for (const id of graph.nodes.keys()) {
    if (exitOf(graph, id) && !state.locks.has(id)) state.locks.set(id, newLock());
  }
  for (const lock of state.locks.values()) {
    keepWaiting(lock, (i) => state.agents[i]?.waiting === true);
  }
}

/** Nodes an agent can reach from `at`, in id order. */
function reachable(nav: Nav, from: PartId): PartId[] {
  const out: PartId[] = [];
  for (const id of nav.graph.nodes.keys()) if (id !== from && route(nav, from, id)) out.push(id);
  return out.sort();
}

const isOpenHour = (hourKey: number): boolean =>
  hourKey >= OUTDOOR_FROM_HOUR && hourKey < OUTDOOR_TO_HOUR;

function planStops(a: Agent, nav: Nav, seed: number, hourKey: number): void {
  a.stopsHour = hourKey;
  a.stop = 0;
  const pool = reachable(nav, a.home);
  a.stops = [];
  if (pool.length === 0) return;
  for (let k = 0; k < ERRAND_STOPS; k++) {
    a.stops.push(pool[hashInts(seed, a.index, hourKey, k) % pool.length] ?? a.home);
  }
  // In the working day the second errand may be outdoors, through an airlock this agent can reach.
  if (isOpenHour(hourKey) && hashInts(seed, a.index, hourKey, 77) % 100 < OUTDOOR_CHANCE) {
    const locks = [...pool, a.home].filter((id) => exitOf(nav.graph, id) !== undefined).sort();
    const lock = locks[hashInts(seed, a.index, hourKey, 78) % Math.max(1, locks.length)];
    if (lock !== undefined) a.stops[1] = OUT + lock;
  }
}

function startRoute(a: Agent, nav: Nav, to: PartId): void {
  const r = route(nav, a.at, to);
  if (!r || r.length === 0) {
    a.at = to;
    return;
  }
  a.route = r;
  a.step = 0;
  a.s = 0;
}

/** Out through `lockId`'s door and on to a loiter spot. */
function startOutdoor(a: Agent, nav: Nav, lockId: PartId, seed: number, hourKey: number): void {
  const exit = exitOf(nav.graph, lockId);
  if (exit === undefined) return;
  const r = routeToExit(nav, a.at, lockId, exit);
  if (!r) return;
  a.slot = hashInts(seed, a.index, hourKey, a.stop) % LOITER_CANDIDATES;
  a.lock = lockId;
  a.exit = exit;
  a.route = [...r, { k: 'out', node: lockId, exit, slot: a.slot, dir: 1 }];
  a.step = 0;
  a.s = 0;
}

/** Back through the door: from the loiter spot to the foot, then in. */
function startReturn(a: Agent, nav: Nav): void {
  const node = nav.graph.nodes.get(a.lock);
  if (!node || !node.exits.has(a.exit)) {
    sendHome(a);
    return;
  }
  a.route = [
    { k: 'out', node: a.lock, exit: a.exit, slot: a.slot, dir: -1 },
    { k: 'node', node: a.lock, from: a.exit, to: CENTRE },
  ];
  a.step = 0;
  a.s = 0;
}

/** The airlock door a step goes through, and which way, or null for any other step. */
function gateOf(nav: Nav, st: Step): { lock: PartId; dir: LockDir } | null {
  if (st.k !== 'node') return null;
  const exits = nav.graph.nodes.get(st.node)?.exits;
  if (!exits) return null;
  if (exits.has(st.to)) return { lock: st.node, dir: 1 };
  if (exits.has(st.from)) return { lock: st.node, dir: -1 };
  return null;
}

/** Advance every agent by one sim tick. */
export function stepCrew(
  state: CrewState,
  world: CrewWorld,
  seed: string,
  tick: number,
  solHour: number,
): void {
  reconcile(state, world);
  const nav = navOf(world.graph, world.env);
  const key = hashString(seed);
  const hourKey = Math.floor(solHour);
  const open = isOpenHour(hourKey);

  for (const id of [...state.locks.keys()].sort()) {
    const lock = state.locks.get(id);
    if (!lock) continue;
    stepLock(lock, (i) => {
      const rider = state.agents[i];
      if (rider) rider.cleared = true;
    });
  }

  for (const a of state.agents) {
    if (a.route.length === 0) {
      idle(a, nav, key, tick, hourKey, open);
      continue;
    }
    let left = WALK_SPEED * TICK_SECONDS;
    while (left > 0 && a.route.length > 0) {
      const st = a.route[a.step];
      const poly = st ? stepPolyline(nav, st) : null;
      if (!st || !poly) {
        sendHome(a);
        break;
      }
      const gate = gateOf(nav, st);
      if (gate && !a.cleared) {
        if (!a.waiting) {
          const lock = state.locks.get(gate.lock);
          if (gate.dir === 1 && !open) {
            // The working day ended on the way: forget the rest of the errands and go home.
            a.route = [];
            a.step = 0;
            a.s = 0;
            a.at = gate.lock;
            a.stop = a.stops.length;
            break;
          }
          if (lock) {
            enqueue(lock, a.index, gate.dir);
            a.waiting = true;
          } else {
            a.cleared = true;
          }
        }
        if (!a.cleared) break;
      }
      const len = polylineLength(poly);
      if (a.s + left < len) {
        a.s += left;
        break;
      }
      left -= len - a.s;
      finishStep(a, nav, st, key, tick);
    }
  }
}

/** The agent just walked all of `st`. */
function finishStep(a: Agent, nav: Nav, st: Step, seed: number, tick: number): void {
  a.step++;
  a.s = 0;
  a.cleared = false;
  a.waiting = false;
  if (st.k === 'node') {
    const exits = nav.graph.nodes.get(st.node)?.exits;
    if (exits?.has(st.to)) a.outside = true;
    if (exits?.has(st.from)) a.outside = false;
  }
  if (a.step < a.route.length) return;

  a.route = [];
  a.step = 0;
  if (st.k === 'node' || st.k === 'out') a.at = st.node;
  if (st.k === 'out' && st.dir === 1) {
    a.dwell = LOITER_DWELL_MIN + (hashInts(seed, a.index, tick) % LOITER_DWELL_SPAN);
  } else {
    a.dwell =
      a.at === a.home && a.stop >= a.stops.length
        ? HOME_DWELL_MIN + (hashInts(seed, a.index, tick) % HOME_DWELL_SPAN)
        : DWELL_MIN + (hashInts(seed, a.index, tick) % DWELL_SPAN);
  }
}

/** An agent with no route: stand, plan, or set off. */
function idle(
  a: Agent,
  nav: Nav,
  seed: number,
  tick: number,
  hourKey: number,
  open: boolean,
): void {
  if (a.outside) {
    // Standing about outside. When the working day ends nobody stays out.
    if (!open) a.dwell = 0;
    if (a.dwell > 0) {
      a.dwell--;
      return;
    }
    startReturn(a, nav);
    return;
  }
  if (a.dwell > 0) {
    a.dwell--;
    return;
  }
  if (a.stopsHour !== hourKey) planStops(a, nav, seed, hourKey);
  // Visit the stops in order, then go home; at home with nothing to do, wait for the next hour.
  const target = a.stop < a.stops.length ? a.stops[a.stop] : a.at !== a.home ? a.home : undefined;
  if (target === undefined) {
    a.dwell = 10;
    return;
  }
  if (a.stop < a.stops.length) a.stop++;
  if (target.startsWith(OUT)) {
    if (open) startOutdoor(a, nav, target.slice(OUT.length), seed, hourKey);
  } else {
    startRoute(a, nav, target);
  }
  if (a.route.length === 0) {
    a.dwell = DWELL_MIN + (hashInts(seed, a.index, tick) % DWELL_SPAN);
  }
}

/** Floats per crew member in the output array. */
export const CREW_STRIDE = 8;

/**
 * World position, heading and animation of every agent: x, y, z, heading (radians about +y, the
 * figure faces +x at 0), walk phase (0..1, one cycle per 0.9 m), walking (0/1), exposed (0
 * indoors, 1 outside), index.
 */
export function crewPoints(state: CrewState, world: CrewWorld, out?: Float32Array): Float32Array {
  const graph = world.graph;
  const nav = navOf(graph, world.env);
  const buf =
    out && out.length >= state.agents.length * CREW_STRIDE
      ? out
      : new Float32Array(state.agents.length * CREW_STRIDE);
  state.agents.forEach((a, i) => {
    const o = i * CREW_STRIDE;
    const st = a.route[a.step];
    let poly = st ? stepPolyline(nav, st) : null;
    let s = a.s;
    let standing = a.waiting;
    if (!poly && a.outside) {
      // Standing at the loiter spot: the end of the way out, facing away from the door.
      poly = stepPolyline(nav, { k: 'out', node: a.lock, exit: a.exit, slot: a.slot, dir: 1 });
      s = Infinity;
      standing = true;
    }
    let x = 0;
    let y = 0;
    let z = 0;
    let heading = 0;
    if (poly) {
      const { point, heading: h } = sampleAlong(poly, s);
      [x, y, z] = point;
      heading = Math.atan2(-h[1], h[0]);
    } else {
      const node = graph.nodes.get(a.at);
      if (node) [x, y, z] = node.centre;
    }
    const walking = poly !== null && !standing && a.route.length > 0;
    buf[o] = x;
    buf[o + 1] = y;
    buf[o + 2] = z;
    buf[o + 3] = heading;
    buf[o + 4] = walking ? (a.s / 0.9) % 1 : 0;
    buf[o + 5] = walking ? 1 : 0;
    buf[o + 6] = a.outside || st?.k === 'out' ? 1 : 0;
    buf[o + 7] = a.index;
  });
  return buf;
}
