export type CaptureQuality = "any" | "splus" | "rs";
export const captureLabels: Record<CaptureQuality, string> = {
  any: "Любая",
  splus: "S+",
  rs: "RS",
};
export const captureQualities: CaptureQuality[] = ["any", "splus", "rs"];
export type Entry = {
  familyId: string;
  everCaught: boolean;
  captures: CaptureQuality[];
  obtainedFormIds: string[];
  currentOwnedCount: number | null;
  favorite: boolean;
  note: string;
  updatedAt: string;
  localRevision: number;
  deletedAt: string | null;
};
export function capturesOf(
  entry?: { everCaught?: boolean; captures?: CaptureQuality[] | null; deletedAt?: string | null } | null,
): CaptureQuality[] {
  if (!entry || entry.deletedAt) return [];
  if (entry.captures?.length)
    return entry.captures
      .filter((item): item is CaptureQuality =>
        captureQualities.includes(item as CaptureQuality),
      )
      .slice(0, 2);
  return entry.everCaught ? ["any"] : [];
}
export function isCaught(
  entry?: { everCaught?: boolean; captures?: CaptureQuality[] | null; deletedAt?: string | null } | null,
) {
  return capturesOf(entry).length > 0;
}
export type Claim = {
  collectionId: string;
  rewardClaimed: boolean;
  updatedAt: string;
};
export const blankClaim = (collectionId: string): Claim => ({
  collectionId,
  rewardClaimed: false,
  updatedAt: new Date().toISOString(),
});
export type Preset = {
  id: string;
  familyId: string;
  level: number;
  colors: Record<string, string>;
  bonuses: Record<string, number>;
  relicIds: (string | null)[];
  datasetVersion: string;
  rulesVersion: string;
  label: string;
};
export type ExportProfile = {
  schemaVersion: 1;
  exportId: string;
  exportedAt: string;
  sourceDatasetVersion: string;
  profile: { id: string; name: string };
  entries: Entry[];
  collectionClaims: Claim[];
  presets: Preset[];
};
export type Quarantine = {
  id: string;
  kind: "entry" | "claim" | "preset";
  reason: string;
  value: Entry | Claim | Preset;
};
export type Snapshot = {
  profile: ExportProfile["profile"] | null;
  entries: Entry[];
  claims: Claim[];
  presets: Preset[];
  quarantine: Quarantine[];
  revision: number;
};
export type Preview = {
  payload: ExportProfile;
  entries: Entry[];
  claims: Claim[];
  presets: Preset[];
  quarantine: Quarantine[];
  added: number;
  changed: number;
  conflicts: string[];
  revision: number;
};
export const blankEntry = (familyId: string): Entry => ({
  familyId,
  everCaught: false,
  captures: [],
  obtainedFormIds: [],
  currentOwnedCount: null,
  favorite: false,
  note: "",
  updatedAt: new Date().toISOString(),
  localRevision: 1,
  deletedAt: null,
});
export function mergeEntry(
  local: Entry,
  incoming: Entry,
  prefer: "local" | "incoming",
): Entry {
  const winner = prefer === "local" ? local : incoming;
  // Tombstones are conflicts: use the explicitly chosen side without silently resurrecting data.
  if (local.deletedAt || incoming.deletedAt)
    return {
      ...winner,
      localRevision: Math.min(local.localRevision + 1, 100000),
      updatedAt: new Date().toISOString(),
    };
  return {
    ...winner,
    everCaught: local.everCaught || incoming.everCaught,
    captures: Array.from(
      new Set([...capturesOf(local), ...capturesOf(incoming)]),
    ).slice(0, 2),
    favorite: local.favorite || incoming.favorite,
    obtainedFormIds: Array.from(
      new Set([...local.obtainedFormIds, ...incoming.obtainedFormIds]),
    ),
    localRevision: Math.min(local.localRevision + 1, 100000),
    updatedAt: new Date().toISOString(),
  };
}
export function prepareImport(
  payload: ExportProfile,
  snapshot: Snapshot,
  references: {
    families: Set<string>;
    forms: Map<string, string>;
    collections: Set<string>;
    relics: Set<string>;
  },
): Preview {
  const preview: Preview = {
    payload,
    entries: [],
    claims: [],
    presets: [],
    quarantine: [],
    added: 0,
    changed: 0,
    conflicts: [],
    revision: snapshot.revision,
  };
  const seen = new Set<string>();
  const local = new Map(
    snapshot.entries.map((entry) => [entry.familyId, entry]),
  );
  const quarantine = (
    kind: Quarantine["kind"],
    id: string,
    value: Quarantine["value"],
    reason: string,
  ) => preview.quarantine.push({ id: `${kind}:${id}`, kind, value, reason });
  for (const entry of payload.entries) {
    if (seen.has(`entry:${entry.familyId}`))
      throw Error("Повторяющийся ID записи");
    seen.add(`entry:${entry.familyId}`);
    if (
      !references.families.has(entry.familyId) ||
      entry.obtainedFormIds.some(
        (id) => references.forms.get(id) !== entry.familyId,
      )
    ) {
      quarantine(
        "entry",
        entry.familyId,
        entry,
        "Неизвестное семейство или форма; исходная запись сохранена целиком",
      );
      continue;
    }
    preview.entries.push(entry);
    const existing = local.get(entry.familyId);
    if (!existing) preview.added++;
    else {
      preview.changed++;
      if (
        existing.everCaught !== entry.everCaught ||
        existing.favorite !== entry.favorite ||
        existing.deletedAt !== entry.deletedAt ||
        existing.note !== entry.note ||
        existing.currentOwnedCount !== entry.currentOwnedCount
      )
        preview.conflicts.push(entry.familyId);
    }
  }
  for (const claim of payload.collectionClaims) {
    if (seen.has(`claim:${claim.collectionId}`))
      throw Error("Повторяющийся ID коллекции");
    seen.add(`claim:${claim.collectionId}`);
    if (references.collections.has(claim.collectionId))
      preview.claims.push(claim);
    else
      quarantine(
        "claim",
        claim.collectionId,
        claim,
        "Неизвестная игровая коллекция",
      );
  }
  for (const preset of payload.presets) {
    if (seen.has(`preset:${preset.id}`))
      throw Error("Повторяющийся ID пресета");
    seen.add(`preset:${preset.id}`);
    const total = Object.values(preset.bonuses).reduce((sum, n) => sum + n, 0);
    if (total > 136) throw Error("Сумма бонусов пресета превышает 136");
    if (
      !references.families.has(preset.familyId) ||
      preset.relicIds.some((id) => id !== null && !references.relics.has(id))
    )
      quarantine(
        "preset",
        preset.id,
        preset,
        "Неизвестное семейство или реликвия",
      );
    else preview.presets.push(preset);
  }
  return preview;
}
