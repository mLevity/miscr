import { Select, Checkbox } from '../ui/controls';
import { useRef, useState } from "react";
import { useProfile } from "../storage/profile";
import { useT } from "../i18n/Language";
import type { Preview } from "../domain/collection/profile";

export default function Settings() {
  const { t } = useT();
  const { status, exportProfile, previewImport, applyImport, quarantineCount } =
    useProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [prefer, setPrefer] = useState<"local" | "incoming">("local");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="content-panel data-backup">
        <h2>{t("backup.title")}</h2>
        <p>{t("backup.text")}</p>
        <p>
          {t("backup.state")}{" "}
          {status === "ready"
            ? t("backup.ready")
            : status === "loading"
              ? t("backup.loading")
              : t("backup.memory")}
          .
        </p>
        {quarantineCount > 0 && (
          <p>
            Нераспознанных записей: {quarantineCount}. Они сохранены целиком и
            включаются в экспорт.
          </p>
        )}
        <div className="action-row">
          <button
            className="primary-button"
            disabled={status === "loading" || busy}
            onClick={() => exportProfile()}
          >
            {t("backup.export")}
          </button>
          <button
            className="secondary-button"
            disabled={status !== "ready" || busy}
            onClick={() => fileInput.current?.click()}
          >
            {t("backup.import")}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setBusy(true);
            setPreview(null);
            setBackup(false);
            setMessage("");
            try {
              setPreview(await previewImport(file));
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        {preview && (
          <div className="import-preview">
            <h2>Предпросмотр импорта</h2>
            <p>
              Новых: {preview.added}. Существующих: {preview.changed}.
              Конфликтов: {preview.conflicts.length}. Нераспознанных:{" "}
              {preview.quarantine.length}.
            </p>
            <p>
              Пресетов: {preview.presets.length}; отметок наград:{" "}
              {preview.claims.length}.
            </p>
            {preview.quarantine.length > 0 && (
              <details>
                <summary>Нераспознанные записи сохранятся целиком</summary>
                <ul>
                  {preview.quarantine.map((item) => (
                    <li key={item.id}>
                      {item.id}: {item.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <label className="field-label">
              Способ импорта
              <Select
                value={mode}
                disabled={busy}
                onChange={(event) => setMode(event.target.value as typeof mode)}
              >
                <option value="merge">Объединить с локальной коллекцией</option>
                <option value="replace">Заменить локальную коллекцию</option>
              </Select>
            </label>
            {mode === "merge" && (
              <>
                <p className="muted">
                  Поимки, формы, избранное и отметки наград объединяются.
                  Пресеты добавляются с новыми ID.
                </p>
                <label className="field-label">
                  При конфликте заметок, количества и удаления
                  <Select
                    value={prefer}
                    disabled={busy}
                    onChange={(event) =>
                      setPrefer(event.target.value as typeof prefer)
                    }
                  >
                    <option value="local">Сохранить локальное значение</option>
                    <option value="incoming">
                      Использовать значение из файла
                    </option>
                  </Select>
                </label>
              </>
            )}
            {mode === "replace" && (
              <>
                <button onClick={() => exportProfile()}>
                  Скачать резервную копию
                </button>
                <label className="checkbox-line">
                  <Checkbox
                    checked={backup}
                    onChange={(event) => setBackup(event.target.checked)}
                  />
                  Я сохранил нужную резервную копию и хочу заменить данные
                </label>
              </>
            )}
            <div className="action-row">
              <button
                className="primary-button"
                disabled={busy || (mode === "replace" && !backup)}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await applyImport(preview, mode, prefer);
                    setMessage("Импорт завершён. Данные сохранены.");
                    setPreview(null);
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {mode === "merge" ? "Объединить" : "Заменить"}
              </button>
              <button disabled={busy} onClick={() => setPreview(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
        <p role="status">{busy ? "Обработка…" : message}</p>
    </section>
  );
}
