import {
  KEYS,
  rebonus,
  seededRandom,
  wilson,
  type Stat,
  type Stats,
} from "../domain/calculations/core";
export type BatchRequest = {
  count: number;
  seed: number;
  deprioritized: Stat[];
  goals: Record<Stat, { min: number; max: number }>;
};
export type BatchResult = {
  kind: "complete";
  count: number;
  successes: number;
  interval: ReturnType<typeof wilson>;
  histograms: Record<Stat, number[]>;
  means: Stats;
};
self.onmessage = (event: MessageEvent<BatchRequest>) => {
  try {
    const { count, seed, deprioritized, goals } = event.data;
    if (!Number.isInteger(count) || count < 1 || count > 100000)
      throw Error("rebonus.batchRange");
    for (const key of KEYS) {
      const { min, max } = goals[key];
      if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < 1 ||
        max > 136 ||
        min > max
      )
        throw Error(`rebonus.badGoal:${key.toUpperCase()}`);
    }
    const rng = seededRandom(seed);
    const histograms = Object.fromEntries(
      KEYS.map((key) => [key, Array(137).fill(0)]),
    ) as Record<Stat, number[]>;
    const means = Object.fromEntries(KEYS.map((key) => [key, 0])) as Stats;
    let successes = 0;
    for (let i = 0; i < count; i++) {
      const sample = rebonus(deprioritized, rng);
      for (const key of KEYS) {
        histograms[key][sample[key]]++;
        means[key] += sample[key] / count;
      }
      if (
        KEYS.every(
          (key) =>
            sample[key] >= goals[key].min && sample[key] <= goals[key].max,
        )
      )
        successes++;
      if ((i + 1) % 1000 === 0)
        self.postMessage({ kind: "progress", completed: i + 1, count });
    }
    self.postMessage({
      kind: "complete",
      count,
      successes,
      interval: wilson(successes, count),
      histograms,
      means,
    } satisfies BatchResult);
  } catch (error) {
    self.postMessage({
      kind: "error",
      message: error instanceof Error ? error.message : "rebonus.batchError",
    });
  }
};
