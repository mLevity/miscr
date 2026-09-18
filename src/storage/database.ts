import {
  blankClaim,
  blankEntry,
  mergeEntry,
  type Claim,
  type Entry,
  type Snapshot,
  type Preview,
  type ExportProfile,
  type Quarantine,
} from "../domain/collection/profile.ts";
const DB_NAME = "miscrits-local-profile";
const stores = [
  "profiles",
  "collectionEntries",
  "presets",
  "collectionClaims",
  "quarantine",
  "settings",
  "rebonusSessions",
  "migrationJournal",
];
let connection: Promise<IDBDatabase> | null = null;
export function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      for (const name of stores)
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, {
            keyPath:
              name === "collectionEntries"
                ? "familyId"
                : name === "collectionClaims"
                  ? "collectionId"
                  : "id",
          });
    };
    request.onblocked = () =>
      reject(
        Error("Закройте старые вкладки приложения для обновления хранилища"),
      );
    request.onerror = () => {
      connection = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = null;
      };
      resolve(db);
    };
  });
  return connection;
}
export async function readSnapshot(): Promise<Snapshot> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readonly");
    const requests = [
      "profiles",
      "collectionEntries",
      "collectionClaims",
      "presets",
      "quarantine",
    ].map((name) => tx.objectStore(name).getAll());
    const revision = tx.objectStore("settings").get("revision");
    tx.oncomplete = () =>
      resolve({
        profile: requests[0].result[0] ?? null,
        entries: requests[1].result,
        claims: requests[2].result,
        presets: requests[3].result,
        quarantine: requests[4].result,
        revision: revision.result?.value ?? 0,
      });
    tx.onerror = () => reject(tx.error);
  });
}
function ensureProfile(tx: IDBTransaction) {
  const request = tx.objectStore("profiles").getAll();
  request.onsuccess = () => {
    if (!request.result.length)
      tx.objectStore("profiles").put({
        id: crypto.randomUUID(),
        name: "Локальная коллекция",
      });
  };
}
function bumpRevision(tx: IDBTransaction) {
  const request = tx.objectStore("settings").get("revision");
  request.onsuccess = () =>
    tx
      .objectStore("settings")
      .put({ id: "revision", value: (request.result?.value ?? 0) + 1 });
}
export async function patchClaim(
  id: string,
  change: Partial<Claim>,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["collectionClaims", "profiles", "settings"],
      "readwrite",
    );
    const store = tx.objectStore("collectionClaims");
    const request = store.get(id);
    request.onsuccess = () => {
      const old: Claim = request.result ?? blankClaim(id);
      store.put({
        ...old,
        ...change,
        collectionId: id,
        updatedAt: new Date().toISOString(),
      });
    };
    ensureProfile(tx);
    bumpRevision(tx);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function patchEntry(
  id: string,
  change: Partial<Entry>,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["collectionEntries", "profiles", "settings"],
      "readwrite",
    );
    const store = tx.objectStore("collectionEntries");
    const request = store.get(id);
    request.onsuccess = () => {
      const old: Entry = request.result ?? blankEntry(id);
      store.put({
        ...old,
        ...change,
        familyId: id,
        updatedAt: new Date().toISOString(),
        localRevision: Math.min(old.localRevision + 1, 100000),
      });
    };
    ensureProfile(tx);
    bumpRevision(tx);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function commitImport(
  preview: Preview,
  mode: "merge" | "replace",
  prefer: "local" | "incoming",
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    let reason = "Не удалось импортировать профиль";
    const rev = tx.objectStore("settings").get("revision");
    rev.onsuccess = () => {
      if ((rev.result?.value ?? 0) !== preview.revision) {
        reason =
          "Коллекция изменилась в другой вкладке. Откройте предпросмотр заново.";
        tx.abort();
        return;
      }
      if (mode === "replace") {
        for (const name of [
          "collectionEntries",
          "collectionClaims",
          "presets",
          "quarantine",
        ])
          tx.objectStore(name).clear();
      }
      for (const entry of preview.entries) {
        const store = tx.objectStore("collectionEntries");
        if (mode === "replace") store.put({ ...entry, localRevision: 1 });
        else {
          const read = store.get(entry.familyId);
          read.onsuccess = () =>
            store.put(
              read.result
                ? mergeEntry(read.result, entry, prefer)
                : { ...entry, localRevision: 1 },
            );
        }
      }
      for (const claim of preview.claims) {
        const store = tx.objectStore("collectionClaims");
        const read = store.get(claim.collectionId);
        read.onsuccess = () =>
          store.put(
            mode === "merge" && read.result
              ? {
                  ...claim,
                  rewardClaimed:
                    read.result.rewardClaimed || claim.rewardClaimed,
                }
              : claim,
          );
      }
      for (const preset of preview.presets)
        tx.objectStore("presets").put(
          mode === "replace" ? preset : { ...preset, id: crypto.randomUUID() },
        );
      for (const record of preview.quarantine) {
        const store = tx.objectStore("quarantine");
        const read = store.get(record.id);
        read.onsuccess = () => {
          const previous = read.result as Quarantine | undefined;
          if (
            previous &&
            JSON.stringify(previous.value) !== JSON.stringify(record.value)
          ) {
            // Preserve both conflicting unknown records until an explicit mapping exists.
            reason =
              "Неизвестная запись конфликтует с ранее сохранённой. Импорт отклонён; исходный файл остаётся у вас.";
            tx.abort();
          } else store.put(record);
        };
      }
      ensureProfile(tx);
      tx.objectStore("settings").put({
        id: "revision",
        value: preview.revision + 1,
      });
      tx.objectStore("migrationJournal").put({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: "profile-import",
        mode,
        exportId: preview.payload.exportId,
      });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? Error(reason));
    tx.onabort = () => reject(Error(reason));
  });
}
export function makeExport(snapshot: Snapshot): ExportProfile {
  return {
    schemaVersion: 1,
    exportId: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    sourceDatasetVersion: "2026-09-15.1",
    profile: snapshot.profile ?? {
      id: crypto.randomUUID(),
      name: "Локальная коллекция",
    },
    entries: combine(
      snapshot.entries,
      snapshot.quarantine
        .filter((q) => q.kind === "entry")
        .map((q) => q.value as Entry),
      (item) => item.familyId,
    ),
    collectionClaims: combine(
      snapshot.claims,
      snapshot.quarantine
        .filter((q) => q.kind === "claim")
        .map((q) => q.value as ExportProfile["collectionClaims"][number]),
      (item) => item.collectionId,
    ),
    presets: combine(
      snapshot.presets,
      snapshot.quarantine
        .filter((q) => q.kind === "preset")
        .map((q) => q.value as ExportProfile["presets"][number]),
      (item) => item.id,
    ),
  };
}
function combine<T>(known: T[], unknown: T[], key: (value: T) => string) {
  return [
    ...known.filter(
      (value) => !unknown.some((item) => key(item) === key(value)),
    ),
    ...unknown,
  ];
}
