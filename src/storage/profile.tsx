import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { families, forms, collections } from "../data/static";
import relics from "../data/generated/relics.json";
import {
  prepareImport,
  blankEntry,
  type Entry,
  type Snapshot,
  type Preview,
  type ExportProfile,
} from "../domain/collection/profile";
import { commitImport, makeExport, patchEntry, readSnapshot } from "./database";
export type { Entry } from "../domain/collection/profile";
type State = {
  entries: Record<string, Entry>;
  status: "loading" | "ready" | "memory";
  error: string | null;
  quarantineCount: number;
  patch: (id: string, change: Partial<Entry>) => Promise<void>;
  exportProfile: () => Promise<void>;
  previewImport: (file: File) => Promise<Preview>;
  applyImport: (
    preview: Preview,
    mode: "merge" | "replace",
    prefer: "local" | "incoming",
  ) => Promise<void>;
};
const Context = createContext<State | null>(null);
const empty = (): Snapshot => ({
  profile: null,
  entries: [],
  claims: [],
  presets: [],
  quarantine: [],
  revision: 0,
});
const references = {
  families: new Set(families.map((f) => f.id)),
  forms: new Map(forms.map((form) => [form.id, form.familyId])),
  collections: new Set(collections.map((c) => c.id)),
  relics: new Set(relics.map((r) => r.id)),
};
let validationPromise: Promise<(data: unknown) => boolean> | undefined;
function validator() {
  return (validationPromise ??= (async () => {
    const [{ default: Ajv }, { default: addFormats }, { default: schema }] =
      await Promise.all([
        import("ajv/dist/2020"),
        import("ajv-formats"),
        import("../../schemas/profile-export.schema.json"),
      ]);
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    return ajv.compile(schema);
  })());
}
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [status, setStatus] = useState<State["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    readSnapshot()
      .then((value) => {
        if (active) {
          setSnapshot(value);
          setStatus("ready");
        }
      })
      .catch((e) => {
        if (active) {
          setStatus("memory");
          setError(
            `${e instanceof Error ? e.message : "Хранилище недоступно"}. Изменения не сохраняются после закрытия страницы.`,
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("miscrits-local-profile");
    channel.onmessage = () =>
      readSnapshot()
        .then(setSnapshot)
        .catch(() =>
          setError("Не удалось обновить коллекцию из другой вкладки"),
        );
    return () => channel.close();
  }, []);
  const announce = () => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("miscrits-local-profile");
      channel.postMessage("updated");
      channel.close();
    }
  };
  const patch = async (id: string, change: Partial<Entry>) => {
    if (!references.families.has(id)) {
      setError("Неизвестное семейство");
      return;
    }
    try {
      if (status === "memory") {
        setSnapshot((previous) => {
          const entries = new Map(
            previous.entries.map((entry) => [entry.familyId, entry]),
          );
          entries.set(id, {
            ...(entries.get(id) ?? blankEntry(id)),
            ...change,
            familyId: id,
          });
          return { ...previous, entries: [...entries.values()] };
        });
        return;
      }
      await patchEntry(id, change);
      setSnapshot(await readSnapshot());
      announce();
      setError(null);
    } catch {
      setError(
        "Не удалось сохранить изменение. Экспортируйте коллекцию и проверьте свободное место.",
      );
    }
  };
  const exportProfile = async () => {
    try {
      const latest = status === "memory" ? snapshot : await readSnapshot();
      const payload = makeExport(latest);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `miscrits-collection-${payload.exportedAt.slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Не удалось экспортировать коллекцию");
    }
  };
  const previewImport = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) throw Error("Файл превышает 5 МиБ");
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      throw Error("Не удалось прочитать JSON");
    }
    const validate = await validator();
    if (!validate(payload))
      throw Error(
        "Файл не соответствует схеме профиля: проверьте версию, обязательные поля и ограничения значений.",
      );
    const latest = status === "memory" ? snapshot : await readSnapshot();
    return prepareImport(payload as ExportProfile, latest, references);
  };
  const applyImport = async (
    preview: Preview,
    mode: "merge" | "replace",
    prefer: "local" | "incoming",
  ) => {
    if (status === "memory")
      throw Error(
        "Импорт недоступен без надёжного хранилища. Исходный файл не изменён.",
      );
    await commitImport(preview, mode, prefer);
    setSnapshot(await readSnapshot());
    announce();
  };
  return (
    <Context.Provider
      value={{
        entries: Object.fromEntries(
          snapshot.entries.map((entry) => [entry.familyId, entry]),
        ),
        status,
        error,
        quarantineCount: snapshot.quarantine.length,
        patch,
        exportProfile,
        previewImport,
        applyImport,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProfile() {
  const value = useContext(Context);
  if (!value) throw Error("ProfileProvider required");
  return value;
}
