import {
  areas,
  familyById,
  forms,
  spawnsByFamily,
  variants,
  type Family,
  type Spawn,
} from "../../data/static";
import familyTagsRaw from "../../data/generated/family-tags.json";
import tags from "../../data/generated/tags.json";
import { isCaught } from "../collection/profile";
const familyTags: Record<string, string[]> = familyTagsRaw;

export type CatalogFilter = {
  q: string;
  elements: string[];
  elementMode: "any" | "all" | "exact";
  rarity: string[];
  tags: string[];
  caught: "all" | "caught" | "missing";
  favorite: boolean;
  day: number | null;
  locations: string[];
  areas: string[];
  acquisition: string[];
  variant: string[];
  ranks: Partial<Record<keyof Family["baseRanks"], [number, number]>>;
  sort: string;
};
export const elements = [
  "fire",
  "water",
  "nature",
  "earth",
  "lightning",
  "wind",
];
export const rarities = ["common", "rare", "epic", "exotic", "legendary"];
export const rankKeys = ["hp", "spd", "ea", "ed", "pa", "pd"] as const;
export const variantsByFamily = new Map(
  (variants as { familyId: string; variant: string }[]).map((item) => [
    item.familyId,
    item.variant,
  ]),
);
export const defaultFilter: CatalogFilter = {
  q: "",
  elements: [],
  elementMode: "all",
  rarity: [],
  tags: [],
  caught: "all",
  favorite: false,
  day: null,
  locations: [],
  areas: [],
  acquisition: [],
  variant: [],
  ranks: {},
  sort: "name-asc",
};
export const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/g, " ");
const searchable = (value: string) => [
  normalize(value),
  normalize(value.replace(/[’'-]/g, " ")),
  normalize(value.replace(/[’'-]/g, "")),
];
export function searchMatch(
  family: Family,
  q: string,
): { score: number; formName?: string; formId?: string } | null {
  const needle = normalize(q);
  if (!needle) return { score: 0 };
  const names = [
    { name: family.name, id: undefined },
    ...family.formIds.map((id) => ({
      name: forms.find((form) => form.id === id)?.name || "",
      id,
    })),
    ...family.aliases.map((name) => ({ name, id: undefined })),
  ];
  let best: { score: number; formName?: string; formId?: string } | null = null;
  for (const entry of names) {
    for (const variant of searchable(entry.name)) {
      const score =
        variant === needle
          ? 0
          : variant.startsWith(needle)
            ? 1
            : variant.includes(needle)
              ? 2
              : Infinity;
      if (score < Infinity && (!best || score < best.score)) {
        best = {
          score,
          formName: entry.name === family.name ? undefined : entry.name,
          formId: entry.id,
        };
      }
    }
  }
  return best;
}
export function matchingSpawn(spawn: Spawn, filter: CatalogFilter): boolean {
  if (filter.locations.length && !filter.locations.includes(spawn.locationId))
    return false;
  if (filter.areas.length && !filter.areas.includes(spawn.areaId || ""))
    return false;
  if (
    filter.acquisition.length &&
    !filter.acquisition.includes(spawn.acquisition)
  )
    return false;
  if (filter.day !== null && !spawn.schedule.weekdays?.includes(filter.day))
    return false;
  return true;
}
export function filterFamilies(
  items: Family[],
  filter: CatalogFilter,
  entries: Record<string, { everCaught?: boolean; favorite?: boolean; captures?: string[] }>,
): {
  family: Family;
  match: { score: number; formName?: string; formId?: string };
}[] {
  const results = [];
  for (const family of items) {
    const match = searchMatch(family, filter.q);
    if (!match) continue;
    if (filter.elements.length) {
      const selected = filter.elements;
      const actual = family.elements;
      const ok = selected.every((value) => actual.includes(value));
      if (!ok) continue;
    }
    if (filter.rarity.length && !filter.rarity.includes(family.rarity))
      continue;
    if (filter.tags.some((tag) => !familyTags[family.id]?.includes(tag)))
      continue;
    if (filter.caught === "caught" && !isCaught(entries[family.id])) continue;
    if (filter.caught === "missing" && isCaught(entries[family.id])) continue;
    if (filter.favorite && !entries[family.id]?.favorite) continue;
    if (
      filter.variant.length &&
      !filter.variant.includes(variantsByFamily.get(family.id) || "base")
    )
      continue;
    if (
      rankKeys.some((key) => {
        const range = filter.ranks[key];
        return (
          range &&
          (family.baseRanks[key] < range[0] || family.baseRanks[key] > range[1])
        );
      })
    )
      continue;
    if (
      (filter.day !== null ||
        filter.locations.length ||
        filter.areas.length ||
        filter.acquisition.length) &&
      !(spawnsByFamily.get(family.id) || []).some((spawn) =>
        matchingSpawn(spawn, filter),
      )
    )
      continue;
    results.push({ family, match });
  }
  const rarityOrder = rarities;
  results.sort((a, b) => {
    if (filter.q && a.match.score !== b.match.score)
      return a.match.score - b.match.score;
    const sort = filter.sort;
    let compared = 0;
    if (sort === "name-desc")
      compared = b.family.name.localeCompare(a.family.name);
    else if (sort === "rarity-asc" || sort === "rarity-desc") {
      compared =
        rarityOrder.indexOf(a.family.rarity) -
        rarityOrder.indexOf(b.family.rarity);
      if (sort === "rarity-desc") compared *= -1;
    } else if (sort.startsWith("stat-")) {
      const key = sort.slice(5) as keyof Family["baseRanks"];
      compared =
        (b.family.baseRanks[key] || 0) - (a.family.baseRanks[key] || 0);
    } else if (sort === "id")
      compared =
        parseInt(a.family.id.split(":")[1]) -
        parseInt(b.family.id.split(":")[1]);
    else compared = a.family.name.localeCompare(b.family.name);
    return compared || a.family.id.localeCompare(b.family.id);
  });
  return results;
}
export function readFilter(params: URLSearchParams): CatalogFilter {
  const csv = (key: string, valid: string[]) =>
    Array.from(
      new Set(
        (params.get(key) || "")
          .split(",")
          .filter((value) => valid.includes(value)),
      ),
    );
  const day = Number(params.get("day"));
  const ranks: CatalogFilter["ranks"] = {};
  for (const key of rankKeys) {
    const raw = params.get(key);
    if (raw) {
      const [lo, hi] = raw.split("-").map(Number);
      if (lo >= 1 && hi <= 5 && lo <= hi) ranks[key] = [lo, hi];
    }
  }
  const sortOptions = [
    "name-asc",
    "name-desc",
    "rarity-asc",
    "rarity-desc",
    "id",
    ...rankKeys.map((key) => `stat-${key}`),
  ];
  return {
    q: (params.get("q") || "").slice(0, 120),
    elements: csv("elements", elements),
    elementMode: "all",
    rarity: csv("rarity", rarities).slice(0, 1),
    tags: csv(
      "tags",
      tags.map((tag) => tag.id),
    ),
    caught: ["all", "caught", "missing"].includes(params.get("caught") || "")
      ? (params.get("caught") as CatalogFilter["caught"])
      : "all",
    favorite: params.get("favorite") === "1",
    day: Number.isInteger(day) && day >= 1 && day <= 7 ? day : null,
    locations: csv(
      "location",
      Array.from(new Set(areas.map((area) => area.locationId))),
    ),
    areas: csv(
      "area",
      areas.map((area) => area.id),
    ),
    acquisition: csv("acquisition", ["wild", "shop", "unknown"]),
    variant: csv("variant", ["base", "dark", "light", "blighted", "foil"]),
    ranks,
    sort: sortOptions.includes(params.get("sort") || "")
      ? params.get("sort")!
      : "name-asc",
  };
}
export function writeFilter(filter: CatalogFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (filter.q) p.set("q", filter.q);
  for (const [key, values] of [
    ["elements", filter.elements],
    ["rarity", filter.rarity],
    ["tags", filter.tags],
    ["location", filter.locations],
    ["area", filter.areas],
    ["acquisition", filter.acquisition],
    ["variant", filter.variant],
  ] as [string, string[]][]) {
    if (values.length) p.set(key, values.join(","));
  }
  if (filter.caught !== "all") p.set("caught", filter.caught);
  if (filter.favorite) p.set("favorite", "1");
  if (filter.day !== null) p.set("day", String(filter.day));
  for (const key of rankKeys) {
    if (filter.ranks[key]) p.set(key, filter.ranks[key]!.join("-"));
  }
  if (filter.sort !== "name-asc") p.set("sort", filter.sort);
  return p;
}
export function familyFromId(id: string) {
  return familyById.get(id);
}
