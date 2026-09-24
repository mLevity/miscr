// Pure implementation of the supplied snapshot. No browser, storage or React dependencies.
import { applyStatExtras, parseAbilityExtras } from "./effects";
export const KEYS = ["hp", "spd", "ea", "pa", "ed", "pd"] as const;
export type Stat = (typeof KEYS)[number];
export type Stats = Record<Stat, number>;
export type Color = "red" | "white" | "green";
export type Colors = Record<Stat, Color>;
export const RULES_VERSION = "snapshot-2026-09-15";
export const DATASET_VERSION = "2026-09-15.1";
export const STRONG: Record<string, string> = {
  water: "fire",
  fire: "nature",
  nature: "water",
  earth: "lightning",
  wind: "earth",
  lightning: "wind",
};
export const statRecord = <T>(value: T): Record<Stat, T> =>
  Object.fromEntries(KEYS.map((key) => [key, value])) as Record<Stat, T>;
function finite(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${label}: допустимо от ${min} до ${max}`);
  return value;
}
function integer(value: number, min: number, max: number, label: string) {
  finite(value, min, max, label);
  if (!Number.isSafeInteger(value))
    throw new RangeError(`${label}: требуется целое число`);
  return value;
}
export function baseStat(
  rank: number,
  level: number,
  color: Color,
  isHp = false,
) {
  integer(rank, 1, 5, "Ранг");
  integer(level, 1, 35, "Уровень");
  if (!["red", "white", "green"].includes(color))
    throw new TypeError("Неизвестный цвет");
  const c = { red: 1, white: 2, green: 3 }[color];
  return Math.floor(
    (((isHp ? 12 : 3) + 2 * rank + 1.5 * c) / (isHp ? 5 : 6)) * level +
      (isHp ? 10 : 5),
  );
}
export function bonusTotal(bonuses: Stats) {
  let total = 0;
  for (const key of KEYS)
    total += integer(bonuses[key], 0, 136, `Бонус ${key.toUpperCase()}`);
  return integer(total, 0, 136, "Сумма бонусов");
}
export function totalStats(
  ranks: Stats,
  level: number,
  colors: Colors,
  bonuses: Stats,
  relics: { statModifiers: Partial<Stats> }[] = [],
  temporary: Partial<Stats> = {},
) {
  bonusTotal(bonuses);
  return Object.fromEntries(
    KEYS.map((key) => [
      key,
      baseStat(ranks[key], level, colors[key], key === "hp") +
        bonuses[key] +
        relics.reduce(
          (sum, relic) =>
            sum +
            finite(relic.statModifiers[key] ?? 0, -10000, 10000, "Реликвия"),
          0,
        ) +
        finite(temporary[key] ?? 0, -10000, 10000, "Временный модификатор"),
    ]),
  ) as Stats;
}
export function elementMultiplier(
  attack: string,
  defenders: string[],
  negate = false,
) {
  if (!(attack in STRONG) && attack !== "physical")
    throw new TypeError("Неизвестная стихия атаки");
  if (
    !Array.isArray(defenders) ||
    defenders.length < 1 ||
    defenders.length > 2 ||
    new Set(defenders).size !== defenders.length ||
    defenders.some((item) => !(item in STRONG))
  )
    throw new TypeError("Нужны одна или две различные стихии защиты");
  if (negate || attack === "physical") return 1;
  return defenders.reduce(
    (m, d) => m * (STRONG[attack] === d ? 2 : STRONG[d] === attack ? 0.5 : 1),
    1,
  );
}
export function directDamage({
  ap,
  attack,
  defense,
  hp,
  element = "physical",
  defenderElements = ["fire"],
  hits = 1,
  negate = false,
}: {
  ap: number;
  attack: number;
  defense: number;
  hp: number;
  element?: string;
  defenderElements?: string[];
  hits?: number;
  negate?: boolean;
}) {
  finite(ap, 0, 10000, "AP");
  finite(attack, 1, 100000, "Атака");
  finite(defense, 1, 100000, "Защита");
  finite(hp, 1, 100000, "HP");
  integer(hits, 1, 100, "Удары");
  const multiplier = elementMultiplier(element, defenderElements, negate);
  const base = ((ap * attack) / defense) * multiplier;
  const perHitMin = Math.floor(base * 0.9),
    perHitMax = Math.floor(base * 1.1);
  const min = perHitMin * hits,
    max = perHitMax * hits,
    midpoint = Math.floor((min + max) / 2);
  return {
    modelId: "hub-direct-v1",
    rulesVersion: RULES_VERSION,
    datasetVersion: DATASET_VERSION,
    base,
    perHitMin,
    perHitMax,
    min,
    max,
    midpoint,
    multiplier,
    koMinHits: max > 0 ? Math.ceil(hp / max) : null,
    koGuaranteedHits: min > 0 ? Math.ceil(hp / min) : null,
  };
}
export type MechanicalAbility = {
  id: string;
  kind: string;
  element: string;
  ap: number | null;
  accuracyPercent: number | null;
  hits: number | null;
  calculationSupport: string;
  rawEffects?: unknown[];
  enchant: Record<string, unknown> | null;
  descriptionEn?: string;
  enchantDescriptionEn?: string;
};
export function resolveAbility(ability: MechanicalAbility, enchanted = false) {
  const e = enchanted ? (ability.enchant ?? {}) : {};
  const add = (base: number | null, key: string) =>
    base === null
      ? null
      : base + (typeof e[key] === "number" ? (e[key] as number) : 0);
  const effects = [
    ...(ability.rawEffects ?? []),
    ...(Array.isArray(e.additional) ? e.additional : []),
  ];
  return {
    ...ability,
    ap: add(ability.ap, "ap"),
    accuracyPercent: add(ability.accuracyPercent, "accuracy"),
    hits: add(ability.hits, "times"),
    effects,
    calculationSupport:
      ability.calculationSupport === "requires-effect-handler"
        ? "requires-effect-handler"
        : effects.length
          ? "direct-component-only"
          : ability.calculationSupport,
  };
}
export function abilityDamage(
  ability: MechanicalAbility,
  attacker: Stats,
  defender: Stats,
  defenderElements: string[],
  enchanted = false,
  negate = false,
) {
  const resolved = resolveAbility(ability, enchanted);
  if (resolved.kind !== "attack")
    throw new Error("damage.notAttack");
  if (resolved.ap === null || resolved.hits === null)
    throw new Error("damage.missingAp");
  const physical = resolved.element === "physical";
  const extras = parseAbilityExtras(ability, enchanted);
  const hit = directDamage({
    ap: resolved.ap,
    attack: attacker[physical ? "pa" : "ea"],
    defense: defender[physical ? "pd" : "ed"],
    hp: defender.hp,
    element: resolved.element,
    defenderElements,
    hits: resolved.hits,
    negate,
  });
  const nextAttacker = applyStatExtras(attacker, extras, "self");
  const nextDefender = applyStatExtras(defender, extras, "foe");
  const nextChanged =
    nextAttacker[physical ? "pa" : "ea"] !== attacker[physical ? "pa" : "ea"] ||
    nextDefender[physical ? "pd" : "ed"] !== defender[physical ? "pd" : "ed"];
  const nextHit = nextChanged
    ? directDamage({
        ap: resolved.ap,
        attack: nextAttacker[physical ? "pa" : "ea"],
        defense: nextDefender[physical ? "pd" : "ed"],
        hp: nextDefender.hp,
        element: resolved.element,
        defenderElements,
        hits: resolved.hits,
        negate,
      })
    : null;
  return {
    ...hit,
    extras,
    nextHit,
    nextAttacker,
    nextDefender,
    partial: extras.some((item) => item.kind === "note"),
    accuracyPercent: resolved.accuracyPercent,
  };
}
export function seededRandom(seed: number) {
  integer(seed, 0, 4294967295, "Seed");
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function random(rng: () => number) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new RangeError("Генератор должен возвращать [0,1)");
  return value;
}
export function rebonusProbabilities(deprioritized: Stat[]) {
  if (
    !Array.isArray(deprioritized) ||
    deprioritized.length > 5 ||
    new Set(deprioritized).size !== deprioritized.length ||
    deprioritized.some((key) => !KEYS.includes(key))
  )
    throw new TypeError("Выберите от 0 до 5 разных статов");
  const d = deprioritized.length,
    // Community stand-in only. Live deprio weights are unpublished and not flat.
    low = 1 / 6 - 0.02,
    high = d ? (1 - d * low) / (6 - d) : 1 / 6;
  return KEYS.map((key) => (d && deprioritized.includes(key) ? low : high));
}
export function rebonus(
  deprioritized: Stat[] = [],
  rng: () => number = Math.random,
): Stats {
  const weights = rebonusProbabilities(deprioritized),
    counts = KEYS.map(() => 0);
  for (let n = 0; n < 130; n++) {
    const r = random(rng);
    let cumulative = 0,
      chosen = 5;
    for (let i = 0; i < 6; i++) {
      cumulative += weights[i];
      if (r <= cumulative) {
        chosen = i;
        break;
      }
    }
    counts[chosen]++;
  }
  const order = [0, 1, 2, 3, 4, 5].sort(
    (a, b) => counts[a] - counts[b] || a - b,
  );
  const excess = Math.max(0, counts[order[0]] + counts[order[1]] - 32);
  if (excess) {
    counts[order[1]] -= excess;
    for (let i = 0; i < excess; i++)
      counts[order[2 + Math.floor(random(rng) * 4)]]++;
  }
  return Object.fromEntries(
    KEYS.map((key, i) => [key, counts[i] + 1]),
  ) as Stats;
}
export function rebonusPrice(current: Stats, count: number) {
  integer(count, 0, 5, "Число пониженных статов");
  return 136 - bonusTotal(current) + [25, 60, 50, 45, 50, 60][count];
}
export function wilson(successes: number, n: number) {
  integer(n, 1, 100000, "Число попыток");
  integer(successes, 0, n, "Успехи");
  const z = 1.959963984540054,
    p = successes / n,
    den = 1 + (z * z) / n,
    c = (p + (z * z) / (2 * n)) / den,
    h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return { p, low: Math.max(0, c - h), high: Math.min(1, c + h) };
}
