/**
 * Crew: small state machines that live on the press graph. An agent is never a coordinate; it is
 * "this far along step i of a route", so a dragged part carries its crew with it, and a solve that
 * removes what an agent stands on just sends the agent home. Everything is a pure function of
 * (state, graph, seed, tick, sol hour): same input, same walk, byte for byte.
 *
 * Count is `floor(pressurised volume / CREW_VOLUME)` up to CREW_MAX. Each agent has a home node
 * and a three-stop errand list rebuilt every sol-hour, picked from the nodes it can reach.
 */
import { CREW_MAX, CREW_VOLUME } from '@/geometry/design-constants';
import { hashInts, hashString } from '@/core/rng';
import type { PartId } from '@/world/document';
import type { PressGraph } from '@/grammar/solver';
import { TICK_SECONDS } from './fixed-step';
import {
  navOf,
  polylineLength,
  route,
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
  stops: PartId[];
  stop: number;
}

export interface CrewState {
  agents: Agent[];
  /** the graph the agents were last checked against */
  graph: PressGraph | null;
}

export function emptyCrew(): CrewState {
  return { agents: [], graph: null };
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
  };
}

/** The graph changed (or this is the first look): fix the agents so nothing refers to what is gone. */
export function reconcile(state: CrewState, graph: PressGraph): void {
  if (state.graph === graph) return;
  state.graph = graph;
  const nav = navOf(graph);
  const homes = homesOf(graph);
  const want = homes.length === 0 ? 0 : crewCount(graph);
  state.agents.length = Math.min(state.agents.length, want);
  for (let i = state.agents.length; i < want; i++) {
    state.agents.push(newAgent(i, homes[i % homes.length] ?? ''));
  }
  for (const a of state.agents) {
    a.home = homes[a.index % homes.length] ?? a.home;
    const routeOk = a.route.every((st) => stepPolyline(nav, st) !== null);
    if (!graph.nodes.has(a.at) || !graph.nodes.has(a.home) || !routeOk) {
      a.at = a.home;
      a.route = [];
      a.step = 0;
      a.s = 0;
      a.stops = [];
      a.stopsHour = -1;
      continue;
    }
    // The geometry of the current step may have changed length under a drag.
    const poly = a.route[a.step] ? stepPolyline(nav, a.route[a.step] as Step) : null;
    if (poly) a.s = Math.min(a.s, polylineLength(poly));
  }
}

/** Nodes an agent can reach from `at`, in id order. */
function reachable(nav: Nav, from: PartId): PartId[] {
  const out: PartId[] = [];
  for (const id of nav.graph.nodes.keys()) if (id !== from && route(nav, from, id)) out.push(id);
  return out.sort();
}

function planStops(a: Agent, nav: Nav, seed: number, hourKey: number): void {
  a.stopsHour = hourKey;
  a.stop = 0;
  const pool = reachable(nav, a.home);
  a.stops = [];
  if (pool.length === 0) return;
  for (let k = 0; k < ERRAND_STOPS; k++) {
    a.stops.push(pool[hashInts(seed, a.index, hourKey, k) % pool.length] ?? a.home);
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

/** Advance every agent by one sim tick. */
export function stepCrew(
  state: CrewState,
  graph: PressGraph,
  seed: string,
  tick: number,
  solHour: number,
): void {
  reconcile(state, graph);
  const nav = navOf(graph);
  const key = hashString(seed);
  const hourKey = Math.floor(solHour);
  for (const a of state.agents) {
    if (a.route.length === 0) {
      if (a.dwell > 0) {
        a.dwell--;
        continue;
      }
      if (a.stopsHour !== hourKey) planStops(a, nav, key, hourKey);
      // Visit the stops in order, then go home; at home with nothing to do, wait for the next hour.
      const target =
        a.stop < a.stops.length ? a.stops[a.stop] : a.at !== a.home ? a.home : undefined;
      if (target === undefined) {
        a.dwell = 10;
        continue;
      }
      if (a.stop < a.stops.length) a.stop++;
      startRoute(a, nav, target);
      if (a.route.length === 0) {
        a.dwell = DWELL_MIN + (hashInts(key, a.index, tick) % DWELL_SPAN);
      }
      continue;
    }
    let left = WALK_SPEED * TICK_SECONDS;
    while (left > 0 && a.route.length > 0) {
      const st = a.route[a.step];
      const poly = st ? stepPolyline(nav, st) : null;
      if (!st || !poly) {
        a.route = [];
        a.at = a.home;
        break;
      }
      const len = polylineLength(poly);
      if (a.s + left < len) {
        a.s += left;
        break;
      }
      left -= len - a.s;
      a.step++;
      a.s = 0;
      if (a.step >= a.route.length) {
        const last = a.route[a.route.length - 1];
        a.at = last && last.k === 'node' ? last.node : a.at;
        a.route = [];
        a.step = 0;
        a.dwell =
          a.at === a.home && a.stop >= a.stops.length
            ? HOME_DWELL_MIN + (hashInts(key, a.index, tick) % HOME_DWELL_SPAN)
            : DWELL_MIN + (hashInts(key, a.index, tick) % DWELL_SPAN);
      }
    }
  }
}

/** Floats per crew member in the output array. */
export const CREW_STRIDE = 8;

/**
 * World position, heading and animation of every agent: x, y, z, heading (radians about +y),
 * walk phase (0..1, one cycle per metre-pair), walking (0/1), exposed (0 indoors, 1 outside), index.
 */
export function crewPoints(state: CrewState, graph: PressGraph, out?: Float32Array): Float32Array {
  const nav = navOf(graph);
  const buf =
    out && out.length >= state.agents.length * CREW_STRIDE
      ? out
      : new Float32Array(state.agents.length * CREW_STRIDE);
  state.agents.forEach((a, i) => {
    const o = i * CREW_STRIDE;
    const node = graph.nodes.get(a.at);
    const st = a.route[a.step];
    const poly = st ? stepPolyline(nav, st) : null;
    let x = 0;
    let y = 0;
    let z = 0;
    let heading = 0;
    if (poly) {
      const { point, heading: h } = sampleAlong(poly, a.s);
      [x, y, z] = point;
      heading = Math.atan2(-h[1], h[0]);
    } else if (node) {
      [x, y, z] = node.centre;
    }
    buf[o] = x;
    buf[o + 1] = y;
    buf[o + 2] = z;
    buf[o + 3] = heading;
    buf[o + 4] = poly ? (a.s / 0.9) % 1 : 0;
    buf[o + 5] = poly ? 1 : 0;
    buf[o + 6] = 0;
    buf[o + 7] = a.index;
  });
  return buf;
}
