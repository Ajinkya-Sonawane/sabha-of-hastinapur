import { randomInt } from "node:crypto";

export interface RandomSource {
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Production randomness. Never use Math.random() for game state. */
export class CryptoRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}

/** Deterministic randomness for reproducible tests (mulberry32). */
export class SeededRandomSource implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextInt(maxExclusive: number): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const float = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(float * maxExclusive);
  }
}

/** Fisher–Yates shuffle returning a new array. */
export function secureShuffle<T>(items: readonly T[], rng: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
