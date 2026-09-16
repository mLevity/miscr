import familiesJson from "./generated/miscrits.json";
import formsJson from "./generated/forms.json";
import spawnsJson from "./generated/spawns.json";
import mapsJson from "./generated/maps.json";
import markersJson from "./generated/markers.json";
import locationsJson from "./generated/locations.json";
import areasJson from "./generated/areas.json";
import collectionsJson from "./generated/collections.json";
import variantsJson from "./generated/family-variants.json";

export type Ranks = Record<"hp" | "spd" | "ea" | "pa" | "ed" | "pd", number>;
export type Family = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  elements: string[];
  rarity: string;
  baseRanks: Ranks;
  formIds: string[];
};
export type Form = {
  id: string;
  familyId: string;
  stage: number;
  name: string;
  assetKey: string;
};
export type Spawn = {
  id: string;
  familyId: string;
  locationId: string;
  areaId: string | null;
  acquisition: string;
  schedule: { weekdays: number[] | null };
  precision: string;
  markerIds: string[];
};
export type Marker = {
  id: string;
  mapId: string;
  familyId: string;
  x: number;
  y: number;
  areaId: string | null;
};
export type MapRecord = {
  id: string;
  locationId: string;
  image: string;
  width: number;
  height: number;
  quality: string;
};
export type Location = {
  id: string;
  name: string;
  kind: string;
  mapId: string | null;
};
export type Area = { id: string; locationId: string; name: string };
export type GameCollection = {
  id: string;
  name: string;
  sourceGroup: string;
  requirements: {
    familyId: string;
    sourceName: string;
    quantity: number;
    formId: string | null;
  }[];
  rewards: { name: string; quantity: number }[];
};
export type Ability = {
  id: string;
  name: string;
  kind: string;
  element: string;
  ap: number | null;
  accuracyPercent: number | null;
  hits: number | null;
  tags: string[];
  descriptionEn: string;
  enchantDescriptionEn: string | null;
  enchant: Record<string, unknown> | null;
  calculationSupport: string;
};
export type AbilityBinding = {
  familyId: string;
  abilityId: string;
  order: number;
  unlockLevel: number | null;
};

export const families = familiesJson as Family[];
export const forms = formsJson as Form[];
export const spawns = spawnsJson as Spawn[];
export const maps = mapsJson as MapRecord[];
export const markers = markersJson as Marker[];
export const locations = locationsJson as Location[];
export const areas = areasJson as Area[];
export const collections = collectionsJson as GameCollection[];
export const variants = variantsJson;
export const familyById = new Map(families.map((item) => [item.id, item]));
export const familyBySlug = new Map(families.map((item) => [item.slug, item]));
export const formById = new Map(forms.map((item) => [item.id, item]));
export const locationById = new Map(locations.map((item) => [item.id, item]));
export const areaById = new Map(areas.map((item) => [item.id, item]));
export const markerById = new Map(markers.map((item) => [item.id, item]));
export const spawnsByFamily = groupBy(spawns, (item) => item.familyId);
export const bindingsByFamilyPromise = () =>
  import("./generated/miscrit-abilities.json").then((module) =>
    groupBy(module.default as AbilityBinding[], (item) => item.familyId),
  );
export const abilitiesPromise = () =>
  import("./generated/abilities.json").then(
    (module) =>
      new Map((module.default as Ability[]).map((item) => [item.id, item])),
  );

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const list = grouped.get(id) || [];
    list.push(item);
    grouped.set(id, list);
  }
  return grouped;
}

export const catalogRepository = {
  async listFamilies(): Promise<Family[]> {
    return families;
  },
  async getFamily(id: string): Promise<Family | undefined> {
    return familyById.get(id);
  },
  async getAbilities(
    id: string,
  ): Promise<{ binding: AbilityBinding; ability: Ability }[]> {
    const [bindings, abilities] = await Promise.all([
      bindingsByFamilyPromise(),
      abilitiesPromise(),
    ]);
    return (bindings.get(id) || [])
      .sort((a, b) => a.order - b.order)
      .flatMap((binding) => {
        const ability = abilities.get(binding.abilityId);
        return ability ? [{ binding, ability }] : [];
      });
  },
};
