/**
 * M3.5 stage 0: one floor rule. Every pressurised part's floor is FLOOR_ABOVE_BELLY over its lowest
 * foot, so on level ground every door in a base is one deck (DECK_HEIGHT) over the ground and
 * parts of different letters and sizes dock and link on the level.
 */
import { describe, expect, it } from 'vitest';
import { snapYaw } from '@/core/math';
import {
  CORRIDOR_MAX_SLOPE,
  DECK_HEIGHT,
  DOOR_SILL,
  FLOOR_ABOVE_BELLY,
  LEG_MIN_CLEARANCE,
  TUBE_RADIUS,
} from '@/geometry/design-constants';
import { addLink, addPart, createDocument, type BaseDocument } from '@/world/document';
import { allParts, getPart } from '../registry';
import type { Letter, ParamValues } from '../types';
import { habHalfExtent } from '../parts/H';
import { solve, type SolverWorld } from './index';
import { isHorizontal } from './ports';

const FLAT: SolverWorld = { halfSize: 64, heightAt: () => 0 };
const HILL: SolverWorld = {
  halfSize: 64,
  heightAt: (x) => Math.max(0, Math.min(8, (x - 6) * 0.9)),
};

interface Spec {
  id: string;
  letter: Letter;
  params: ParamValues;
  x: number;
  z: number;
}

function docOf(parts: Spec[]): BaseDocument {
  let doc = createDocument({ seed: 'floors' });
  for (const p of parts) {
    doc = addPart(doc, {
      id: p.id,
      letter: p.letter,
      params: p.params,
      pose: { x: p.x, z: p.z, yaw: snapYaw(0) },
    });
  }
  return doc;
}

describe('the deck rule', () => {
  it('is DECK_HEIGHT: the clearance plus the floor over the belly', () => {
    expect(DECK_HEIGHT).toBe(LEG_MIN_CLEARANCE + FLOOR_ABOVE_BELLY);
    expect(DECK_HEIGHT).toBe(1.5);
  });

  it('gives every letter with a door a floor, and puts each door within a sill of one', () => {
    for (const def of allParts()) {
      const p = def.resolve({});
      const doors = def.ports(p).filter((q) => q.type === 'PRESS' && isHorizontal(q.normal));
      if (doors.length === 0) continue;
      expect(def.floor, `${def.letter} needs floor()`).toBeDefined();
      const decks = def.floors?.(p) ?? [def.floor?.(p) ?? NaN];
      for (const door of doors) {
        const off = Math.min(...decks.map((y) => Math.abs(door.position[1] - y)));
        expect(off, `${def.letter}/${door.id}`).toBeLessThanOrEqual(DOOR_SILL);
      }
    }
  });

  it('puts the ground floor of every letter and size DECK_HEIGHT over level ground', () => {
    const specs: Spec[] = [
      { id: 'h2', letter: 'H', params: { length: 8, radius: 2 }, x: -40, z: -30 },
      { id: 'h3', letter: 'H', params: { length: 8, radius: 3 }, x: 0, z: -30 },
      { id: 'n2', letter: 'N', params: { size: 2 }, x: 30, z: -30 },
      { id: 'n25', letter: 'N', params: { size: 2.5 }, x: -40, z: 0 },
      { id: 'n3', letter: 'N', params: { size: 3 }, x: -20, z: 0 },
      { id: 'd3', letter: 'D', params: { radius: 3 }, x: 0, z: 0 },
      { id: 'd8', letter: 'D', params: { radius: 8 }, x: 25, z: 0 },
      { id: 'v', letter: 'V', params: { floors: 3 }, x: -40, z: 30 },
      { id: 'a2', letter: 'A', params: { radius: 2 }, x: 0, z: 30 },
      { id: 'a3', letter: 'A', params: { radius: 3 }, x: 30, z: 30 },
    ];
    const base = solve(docOf(specs), FLAT, { diagnose: true });
    expect(base.diagnostics.filter((d) => d.kind === 'invariant')).toEqual([]);
    for (const s of specs) {
      const node = base.graph.nodes.get(s.id);
      expect(node, s.id).toBeDefined();
      expect(node?.centre[1], `${s.id} centre`).toBeCloseTo(DECK_HEIGHT, 9);
      const part = base.parts.get(s.id);
      for (const port of part?.ports ?? []) {
        if (port.type !== 'PRESS' || !isHorizontal(port.normal)) continue;
        if (s.letter === 'V' && port.id.startsWith('f')) continue; // upper floors
        expect(port.position[1], `${s.id}/${port.id}`).toBeCloseTo(DECK_HEIGHT, 9);
      }
    }
  });

  it("leaves a node's top hatch out of the walkable graph", () => {
    const base = solve(docOf([{ id: 'n', letter: 'N', params: { size: 2 }, x: 0, z: 0 }]), FLAT);
    const ports = [...(base.graph.nodes.get('n')?.ports.keys() ?? [])].sort();
    expect(ports).toEqual(['x+', 'x-', 'z+', 'z-']);
  });
});

describe('different letters meet on the level', () => {
  it('docks a small hab to a large one, which axis heights never allowed', () => {
    const a = { length: 8, radius: 2 };
    const b = { length: 8, radius: 3 };
    const gap = 1.0;
    const x = habHalfExtent({ ...a }) + habHalfExtent({ ...b }) + gap;
    const base = solve(
      docOf([
        { id: 'a', letter: 'H', params: a, x: 0, z: 0 },
        { id: 'b', letter: 'H', params: b, x, z: 0 },
      ]),
      FLAT,
      { diagnose: true },
    );
    expect([...base.tubes.keys()].filter((k) => k.startsWith('dock:'))).toHaveLength(1);
    expect(base.diagnostics.filter((d) => d.kind === 'invariant')).toEqual([]);
    const [edge] = base.graph.edges;
    for (const p of edge?.path ?? []) expect(p[1]).toBeCloseTo(DECK_HEIGHT, 9);
  });

  it('draws every corridor level on level ground, with its floor a deck up', () => {
    const base = solve(
      docOf([
        { id: 'h', letter: 'H', params: { length: 8, radius: 3 }, x: 0, z: 0 },
        { id: 'd', letter: 'D', params: { radius: 4.5 }, x: 22, z: 0 },
      ]),
      FLAT,
      { diagnose: true },
    );
    const withLink = addLink(
      docOf([
        { id: 'h', letter: 'H', params: { length: 8, radius: 3 }, x: 0, z: 0 },
        { id: 'd', letter: 'D', params: { radius: 4.5 }, x: 22, z: 0 },
      ]),
      { a: { part: 'h', port: 'end+' }, b: { part: 'd', port: 'c-2' }, kind: 'tube' },
    );
    const linked = solve(withLink, FLAT, { diagnose: true });
    expect(base.tubes.size).toBe(0);
    expect(linked.tubes.size).toBeGreaterThan(0);
    for (const t of linked.tubes.values()) {
      for (const p of t.path) expect(p[1]).toBeCloseTo(DECK_HEIGHT + TUBE_RADIUS, 9);
    }
    for (const e of linked.graph.edges) {
      for (const p of e.path) expect(p[1]).toBeCloseTo(DECK_HEIGHT, 9);
    }
    expect(linked.diagnostics.filter((d) => d.kind !== 'moved')).toEqual([]);
  });
});

describe('steep corridors', () => {
  it('are flagged on a hill, never refused', () => {
    const doc = addLink(
      docOf([
        { id: 'h', letter: 'H', params: { length: 8, radius: 2 }, x: -8, z: 0 },
        { id: 'k', letter: 'H', params: { length: 8, radius: 2 }, x: 20, z: 0 },
      ]),
      { a: { part: 'h', port: 'end+' }, b: { part: 'k', port: 'end-' }, kind: 'tube' },
    );
    const base = solve(doc, HILL, { diagnose: true });
    expect([...base.tubes.keys()].some((k) => k.startsWith('tube:'))).toBe(true);
    expect(base.diagnostics.filter((d) => d.kind === 'invariant')).toEqual([]);
    expect(base.diagnostics.some((d) => d.kind === 'corridor-steep')).toBe(true);
    expect(CORRIDOR_MAX_SLOPE).toBeCloseTo(0.14, 9);
  });

  it('are not flagged on level ground', () => {
    const doc = addLink(
      docOf([
        { id: 'h', letter: 'H', params: { length: 8, radius: 2 }, x: -8, z: 0 },
        { id: 'k', letter: 'H', params: { length: 8, radius: 2 }, x: 20, z: 0 },
      ]),
      { a: { part: 'h', port: 'end+' }, b: { part: 'k', port: 'end-' }, kind: 'tube' },
    );
    const base = solve(doc, FLAT);
    expect(base.diagnostics.some((d) => d.kind === 'corridor-steep')).toBe(false);
    expect(getPart('H')?.floor).toBeDefined();
  });
});
