/**
 * The sim as the editor sees it: a fixed-rate stepper plus the crew. The caller feeds it scaled
 * wall time (zero while the clock is paused), the current graph, seed and sol hour; nothing here
 * reads the clock or the renderer.
 */
import type { PressGraph } from '@/grammar/solver';
import { CREW_STRIDE, crewPoints, emptyCrew, stepCrew, type CrewState } from './crew';
import { FixedStep } from './fixed-step';

export class Sim {
  readonly steps = new FixedStep();
  readonly crew: CrewState = emptyCrew();

  /** Advance by `dt` sim seconds; returns the ticks run. */
  update(dt: number, graph: PressGraph, seed: string, solHour: number): number {
    const n = this.steps.advance(dt);
    const first = this.steps.tick - n;
    for (let i = 0; i < n; i++) stepCrew(this.crew, graph, seed, first + i, solHour);
    return n;
  }

  get crewCount(): number {
    return this.crew.agents.length;
  }

  points(graph: PressGraph, out?: Float32Array): Float32Array {
    return crewPoints(this.crew, graph, out);
  }
}

export { CREW_STRIDE };
