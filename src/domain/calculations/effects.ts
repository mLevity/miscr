import type { MechanicalAbility, Stat, Stats } from "./core";

export type ExtraHeal = {
  kind: "heal" | "lifesteal" | "hot";
  amount: number;
  turns?: number;
  chance?: number;
};
export type ExtraDot = {
  kind: "dot";
  amount: number | null;
  turns: number | null;
  name: string;
  chance?: number;
};
export type ExtraStat = {
  kind: "stat";
  keys: string[];
  amount: number;
  target: "self" | "foe";
  chance?: number;
  name?: string;
};
export type ExtraNote = { kind: "note"; name: string };
export type Extra = ExtraHeal | ExtraDot | ExtraStat | ExtraNote;

const COMBAT_STATS: Stat[] = ["hp", "spd", "ea", "pa", "ed", "pd"];
const ALL_KEYS = ["ea", "pa", "ed", "pd", "spd", "acc"];

type NamedBuff = {
  keys: string[];
  amount: number;
  target: "self" | "foe";
};

const NAMED_BUFFS: Record<string, NamedBuff> = {
  "stats chaos": { keys: ALL_KEYS, amount: -5, target: "foe" },
  "stats surge": { keys: ALL_KEYS, amount: 5, target: "self" },
  "stats pacific": { keys: ALL_KEYS, amount: 5, target: "self" },
};

const STAT_WORDS: Record<string, string[]> = {
  "physical attack": ["pa"],
  "elemental attack": ["ea"],
  "physical defense": ["pd"],
  "elemental defense": ["ed"],
  defenses: ["ed", "pd"],
  attacks: ["ea", "pa"],
  speed: ["spd"],
  accuracy: ["acc"],
  health: ["hp"],
  hp: ["hp"],
};

type RawEffect = Record<string, unknown>;

function textOf(ability: MechanicalAbility, enchanted: boolean) {
  return `${ability.descriptionEn || ""} ${enchanted ? ability.enchantDescriptionEn || "" : ""}`;
}

function chanceOf(text: string) {
  const m = text.match(/(\d+)\s*%\s*chance/i);
  return m ? Number(m[1]) : undefined;
}

function rawList(ability: MechanicalAbility, enchanted: boolean): RawEffect[] {
  const extra = enchanted ? ability.enchant ?? {} : {};
  return [
    ...((ability.rawEffects as RawEffect[]) ?? []),
    ...((Array.isArray(extra.additional) ? extra.additional : []) as RawEffect[]),
  ];
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const n = m.slice(1).map(Number).find((v) => Number.isFinite(v) && v !== 0);
    if (n != null) return n;
  }
  return null;
}

function namedBuff(name: string | undefined): NamedBuff | null {
  if (!name) return null;
  return NAMED_BUFFS[name.trim().toLowerCase()] || null;
}

function handleHeal(effect: RawEffect, text: string, chance?: number): Extra {
  const amount =
    num(effect.ap) ??
    firstNumber(text, [/heals? yourself by (\d+)/i, /replenishes (\d+) health/i]);
  return amount
    ? { kind: "heal", amount, chance }
    : { kind: "note", name: "Heal" };
}

function handleLifeSteal(effect: RawEffect, text: string, chance?: number): Extra {
  const amount = num(effect.ap) ?? firstNumber(text, [/steals? (\d+) HP/i]);
  return amount
    ? { kind: "lifesteal", amount, chance }
    : { kind: "note", name: "LifeSteal" };
}

function handleHot(effect: RawEffect, text: string, chance?: number): Extra {
  const hot = text.match(/(\d+) healing for (\d+) turns/i);
  const amount = num(effect.ap) ?? (hot ? Number(hot[1]) : null);
  const turns = num(effect.turns) ?? (hot ? Number(hot[2]) : null);
  return amount
    ? { kind: "hot", amount, turns: turns || undefined, chance }
    : { kind: "note", name: "HoT" };
}

function handleDot(effect: RawEffect, text: string, chance?: number): Extra {
  const type = String(effect.type || "Dot");
  const parsed = text.match(
    /(\d+)\s*AP\s+[\w/]+\s+(?:DoT|Poison|Bleed|Disease)(?: on (?:the )?foe)? for (\d+)/i,
  );
  const namedTurns = text.match(
    /inflicts (Bleed|Poison|Disease)(?: and [A-Za-z-]+)? for (\d+) turns/i,
  );
  return {
    kind: "dot",
    name: type,
    amount: num(effect.ap) ?? (parsed ? Number(parsed[1]) : null),
    turns:
      num(effect.turns) ??
      (parsed ? Number(parsed[2]) : namedTurns ? Number(namedTurns[2]) : null),
    chance,
  };
}

function handleBuff(effect: RawEffect, text: string, chance?: number): Extra {
  const named = namedBuff(String(effect.name || ""));
  const keys = Array.isArray(effect.keys)
    ? [...(effect.keys as string[])]
    : [...(named?.keys || [])];
  let amount = num(effect.ap);
  let target: "self" | "foe" =
    String(effect.target || "").toLowerCase() === "foe" ? "foe" : "self";
  if (named) {
    amount = amount ?? named.amount;
    if (!effect.target) target = named.target;
  }
  const move = text.match(
    /(raises?|lowers?)\s+(?:your foe's|the user's|foe's|your)\s*(Physical Attack|Elemental Attack|Physical Defense|Elemental Defense|Defenses|Attacks|Speed|Accuracy|Health)\s+by\s+(\d+)/i,
  );
  if (move) {
    const word = move[2].toLowerCase();
    if (!keys.length) keys.push(...(STAT_WORDS[word] || []));
    if (amount == null)
      amount = move[1].toLowerCase().startsWith("lower")
        ? -Number(move[3])
        : Number(move[3]);
    if (/foe's/.test(move[0])) target = "foe";
    if (/the user's/.test(move[0])) target = "self";
  }
  if (amount != null && keys.length)
    return {
      kind: "stat",
      keys,
      amount,
      target,
      chance,
      name: String(effect.name || "Buff"),
    };
  return { kind: "note", name: String(effect.name || effect.type || "Buff") };
}

function handleTrueHit(effect: RawEffect, text: string, chance?: number): Extra {
  const flat =
    num(effect.ap) ??
    firstNumber(text, [
      /additional attack with (\d+) fixed damage/i,
      /(\d+) fixed damage/i,
    ]);
  return flat
    ? { kind: "dot", name: "true", amount: flat, turns: 1, chance }
    : { kind: "note", name: "true damage" };
}

const HANDLERS: Record<string, (effect: RawEffect, text: string, chance?: number) => Extra> = {
  Heal: handleHeal,
  LifeSteal: handleLifeSteal,
  Hot: handleHot,
  Dot: handleDot,
  Poison: handleDot,
  Bleed: handleDot,
  Disease: handleDot,
  Buff: handleBuff,
  StatSteal: handleBuff,
  Attack: handleTrueHit,
};

export function parseAbilityExtras(
  ability: MechanicalAbility,
  enchanted = false,
): Extra[] {
  const text = textOf(ability, enchanted);
  const chance = chanceOf(text);
  const extras: Extra[] = [];
  const seen = new Set<string>();
  for (const effect of rawList(ability, enchanted)) {
    const type = String(effect.type || "");
    const handler = HANDLERS[type] || ((_e, _t) => ({ kind: "note" as const, name: type || "effect" }));
    const extra =
      type === "Attack" && !effect.true_dmg
        ? { kind: "note" as const, name: "Attack" }
        : handler(effect, text, chance);
    const key = JSON.stringify(extra);
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push(extra);
  }
  return extras;
}

export function applyStatExtras(
  base: Stats,
  extras: Extra[],
  side: "self" | "foe",
): Stats {
  const next = { ...base };
  for (const extra of extras) {
    if (extra.kind !== "stat" || extra.target !== side) continue;
    for (const key of extra.keys) {
      if ((COMBAT_STATS as string[]).includes(key))
        next[key as Stat] = next[key as Stat] + extra.amount;
    }
  }
  return next;
}

export function applyFlatHealth(
  attackerHp: number,
  defenderHp: number,
  extras: Extra[],
) {
  let self = attackerHp;
  let foe = defenderHp;
  for (const extra of extras) {
    if (extra.kind === "heal" || extra.kind === "hot")
      self += extra.amount * (extra.kind === "hot" ? extra.turns || 1 : 1);
    if (extra.kind === "lifesteal") {
      self += extra.amount;
      foe -= extra.amount;
    }
    if (extra.kind === "dot" && extra.amount)
      foe -= extra.amount * (extra.turns || 1);
  }
  return { attackerHp: self, defenderHp: foe };
}
