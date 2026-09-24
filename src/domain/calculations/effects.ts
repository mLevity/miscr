import type { MechanicalAbility } from "./core";
import type { Stat, Stats } from "./core";

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

function chanceOf(text: string) {
  const m = text.match(/(\d+)\s*%\s*chance/i);
  return m ? Number(m[1]) : undefined;
}

function flattenEffects(ability: MechanicalAbility, enchanted: boolean) {
  const extra = enchanted ? ability.enchant ?? {} : {};
  return [
    ...((ability.rawEffects as Record<string, unknown>[]) ?? []),
    ...((Array.isArray(extra.additional) ? extra.additional : []) as Record<
      string,
      unknown
    >[]),
  ];
}

function amountFromText(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const n = m.slice(1).map(Number).find((v) => Number.isFinite(v) && v > 0);
    if (n) return n;
  }
  return null;
}

export function parseAbilityExtras(
  ability: MechanicalAbility,
  enchanted = false,
): Extra[] {
  const text = `${ability.descriptionEn || ""} ${enchanted ? ability.enchantDescriptionEn || "" : ""}`;
  const chance = chanceOf(text);
  const extras: Extra[] = [];
  const seen = new Set<string>();
  const push = (item: Extra) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return;
    seen.add(key);
    extras.push(item);
  };

  for (const effect of flattenEffects(ability, enchanted)) {
    const type = String(effect.type || "");
    const keys = Array.isArray(effect.keys) ? (effect.keys as string[]) : [];
    const ap = typeof effect.ap === "number" ? effect.ap : null;
    const turns = typeof effect.turns === "number" ? effect.turns : null;
    const target =
      String(effect.target || "").toLowerCase() === "foe" ? "foe" : "self";

    if (type === "Heal") {
      const amount =
        ap ??
        amountFromText(text, [
          /heals? yourself by (\d+)/i,
          /replenishes (\d+) health/i,
        ]);
      if (amount) push({ kind: "heal", amount, chance });
      else push({ kind: "note", name: "Heal" });
    } else if (type === "LifeSteal") {
      const amount = ap ?? amountFromText(text, [/steals? (\d+) HP/i]);
      if (amount) push({ kind: "lifesteal", amount, chance });
      else push({ kind: "note", name: "LifeSteal" });
    } else if (type === "Hot") {
      const amount =
        ap ??
        amountFromText(text, [
          /grants (\d+) healing for (\d+) turns/i,
          /(\d+) healing for (\d+) turns/i,
        ]);
      const hotTurns =
        turns ??
        Number(text.match(/healing for (\d+) turns/i)?.[1] || 0) ||
        null;
      if (amount) push({ kind: "hot", amount, turns: hotTurns || undefined, chance });
      else push({ kind: "note", name: "HoT" });
    } else if (["Dot", "Poison", "Bleed", "Disease"].includes(type)) {
      const parsed = text.match(
        /(\d+)\s*AP\s+[\w/]+\s+(?:DoT|Poison|Bleed|Disease)(?: on (?:the )?foe)? for (\d+)/i,
      );
      const namedTurns = text.match(
        /inflicts (Bleed|Poison|Disease)(?: and [A-Za-z-]+)? for (\d+) turns/i,
      );
      push({
        kind: "dot",
        name: type,
        amount: ap ?? (parsed ? Number(parsed[1]) : null),
        turns:
          turns ??
          (parsed ? Number(parsed[2]) : namedTurns ? Number(namedTurns[2]) : null),
        chance,
      });
    } else if (type === "Buff" || type === "StatSteal") {
      let amount = ap;
      let foundKeys = keys;
      let foundTarget = target;
      const move = text.match(
        /(raises?|lowers?)\s+(?:your foe's|the user's|foe's|your)\s*(Physical Attack|Elemental Attack|Physical Defense|Elemental Defense|Defenses|Attacks|Speed|Accuracy|Health)\s+by\s+(\d+)/i,
      );
      if (move) {
        const word = move[2].toLowerCase();
        foundKeys = foundKeys.length ? foundKeys : STAT_WORDS[word] || [];
        amount = amount ?? (move[1].toLowerCase().startsWith("lower") ? -Number(move[3]) : Number(move[3]));
        if (/foe|user/.test(move[0]) && /foe/.test(move[0])) foundTarget = "foe";
        if (/the user's/.test(move[0])) foundTarget = "self";
      }
      if (String(effect.name || "").toLowerCase().includes("chaos") && amount == null) {
        amount = -5;
        if (!effect.target) foundTarget = "foe";
      }
      if (amount != null && foundKeys.length)
        push({
          kind: "stat",
          keys: foundKeys,
          amount,
          target:
            /foe's/.test(text) ? "foe" : /the user's/.test(text) ? "self" : foundTarget,
          chance,
          name: String(effect.name || type),
        });
      else push({ kind: "note", name: String(effect.name || type) });
    } else if (type === "Attack" && effect.true_dmg) {
      const flat = amountFromText(text, [
        /additional attack with (\d+) fixed damage/i,
        /(\d+) fixed damage/i,
      ]);
      if (flat) push({ kind: "dot", name: "true", amount: flat, turns: 1, chance });
      else push({ kind: "note", name: "true damage" });
    } else if (type) {
      push({ kind: "note", name: type });
    }
  }
  return extras;
}

const COMBAT_STATS: Stat[] = ["hp", "spd", "ea", "pa", "ed", "pd"];

export function applyStatExtras(base: Stats, extras: Extra[], side: "self" | "foe"): Stats {
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
