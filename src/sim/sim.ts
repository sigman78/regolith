/**
 * The sim as the editor sees it: a fixed-rate stepper plus the crew. The caller feeds it scaled
 * wall time (zero while the clock is paused), the world the crew walk on, the seed and the sol
 * hour; nothing here reads the clock or the renderer.
 */
import {
  CREW_STRIDE,
  crewPoints,
  emptyCrew,
  stepCrew,
  type CrewState,
  type CrewWorld,
} from './crew';
import { FixedStep } from './fixed-step';

export class Sim {
  readonly steps = new FixedStep();
  readonly crew: CrewState = emptyCrew();

  /** Advance by `dt` sim seconds; returns the ticks run. */
  update(dt: number, world: CrewWorld, seed: string, solHour: number): number {
    const n = this.steps.advance(dt);
    const first = this.steps.tick - n;
    for (let i = 0; i < n; i++) stepCrew(this.crew, world, seed, first + i, solHour);
    return n;
  }

  get crewCount(): number {
    return this.crew.agents.length;
  }

  points(world: CrewWorld, out?: Float32Array): Float32Array {
    return crewPoints(this.crew, world, out);
  }
}

export { CREW_STRIDE };
