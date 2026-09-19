import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { type Family, formById } from "../data/static";
import { capturesOf, type CaptureQuality } from "../domain/collection/profile";
import { useProfile } from "../storage/profile";
import { assetsForName, assetManifest } from "./assets";

export const elementNames: Record<string, string> = {
  fire: "Огонь",
  water: "Вода",
  nature: "Природа",
  earth: "Земля",
  lightning: "Молния",
  wind: "Ветер",
  physical: "Физический",
  firelightning: "Огонь / Молния",
  firewind: "Огонь / Ветер",
  fireearth: "Огонь / Земля",
  waterlightning: "Вода / Молния",
  waterwind: "Вода / Ветер",
  waterearth: "Вода / Земля",
  naturelightning: "Природа / Молния",
  naturewind: "Природа / Ветер",
  natureearth: "Природа / Земля",
};
export const rarityNames: Record<string, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  exotic: "Экзотический",
  legendary: "Легендарный",
};
export const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const rankNames = ["", "Weak", "Moderate", "Strong", "Max", "Elite"];
const navIcons: Record<string, string[]> = {
  book: [
    "M12 7v14",
    "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
  ],
  map: [
    "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
    "M15 5.76v15",
    "M9 3.24v15",
  ],
  collection: [
    "M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
    "M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
    "M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5",
    "M8 10h8",
  ],
  tools: [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  ],
  download: [
    "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3Z",
    "M21 10v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7",
    "M7 15h.01M17 15h.01",
  ],
};
export function Icon({ name }: { name: string }) {
  const paths = navIcons[name];
  if (paths)
    return (
      <svg
        className="icon nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  return (
    <img
      className="icon"
      src={`/assets/ui/${name}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}
export function Art({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  const record = assetsForName(name);
  const asset = record?.battlePath || record?.avatarPath;
  const [failed, setFailed] = useState("");
  if (asset && failed !== asset)
    return (
      <div className={`creature-art ${compact ? "compact" : ""}`}>
        <img
          src={asset}
          width={240}
          height={240}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(asset)}
        />
      </div>
    );
  return (
    <div
      className={`art-placeholder ${compact ? "compact" : ""}`}
      aria-label={`Изображение ${name} не предоставлено`}
    >
      <span className="art-silhouette" aria-hidden="true" />
      <small>Арт не предоставлен</small>
    </div>
  );
}
const dualIconKeys = (items: string[]) => {
  if (items.length < 2) return items[0] ? [items[0]] : [];
  const [a, b] = items;
  return [`${a}${b}`, `${a}_${b}`, `${b}${a}`, `${b}_${a}`, a];
};
export function elementIconSrc(items: string[]) {
  const key = dualIconKeys(items)[0];
  return key
    ? `/assets/filters/elements/${key}.png`
    : "/assets/filters/elements/empty.png";
}
export function Elements({ items }: { items: string[] }) {
  return (
    <div className="element-list">
      {items.map((item) => (
        <span className={`element element-${item}`} key={item}>
          {assetManifest.elements[item] && (
            <img
              src={assetManifest.elements[item]}
              alt=""
              width={18}
              height={18}
            />
          )}{" "}
          {elementNames[item] || item}
        </span>
      ))}
    </div>
  );
}
const qualityShort: Record<CaptureQuality, string> = {
  splus: "S+",
  rs: "RS",
  any: "Др.",
};
export function CatchActions({
  family,
  formId,
}: {
  family: Family;
  formId?: string;
}) {
  const { entries, patch } = useProfile();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [pop, setPop] = useState({ top: 0, left: 0 });
  const board = useRef<HTMLDivElement>(null);
  const entry = entries[family.id];
  const slots = capturesOf(entry);
  const favorite = !!entry?.favorite;
  const marks: Array<CaptureQuality | null> =
    slots.length >= 2 ? slots : [...slots, null];
  useEffect(() => {
    if (open === null) return;
    const close = (event: PointerEvent) => {
      if (!board.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const update = async (change: Parameters<typeof patch>[1]) => {
    setBusy(true);
    try {
      await patch(family.id, change);
    } finally {
      setBusy(false);
    }
  };
  const saveSlots = (next: CaptureQuality[]) => {
    const captures = next.slice(0, 2);
    update({
      captures,
      everCaught: captures.length > 0,
      obtainedFormIds:
        captures.length && formId
          ? Array.from(new Set([...(entry?.obtainedFormIds || []), formId]))
          : entry?.obtainedFormIds || [],
    });
  };
  const setSlot = (index: number, quality: CaptureQuality) => {
    const next = [...slots];
    if (next[index] === quality) next.splice(index, 1);
    else next[index] = quality;
    saveSlots(next.filter(Boolean));
    setOpen(null);
  };
  return (
    <div className="catch-actions">
      <div
        ref={board}
        className="capture-board"
        aria-label={`Поимки ${family.name}`}
      >
        {marks.map((quality, index) => (
          <div className="capture-mark-wrap" key={index}>
            <button
              type="button"
              disabled={busy}
              className={`capture-mark ${quality ? `quality-${quality}` : "empty"}`}
              aria-haspopup="true"
              aria-expanded={open === index}
              aria-label={
                quality
                  ? `${family.name}: ${qualityShort[quality]}`
                  : `Отметить поимку ${family.name}`
              }
              onClick={(event) => {
                if (open === index) {
                  setOpen(null);
                  return;
                }
                const box = event.currentTarget.getBoundingClientRect();
                const width = 148;
                const height = 40;
                setPop({
                  top:
                    box.bottom + height + 8 > window.innerHeight
                      ? box.top - height - 6
                      : box.bottom + 6,
                  left: Math.min(
                    window.innerWidth - width - 8,
                    Math.max(8, box.right - width),
                  ),
                });
                setOpen(index);
              }}
            >
              <Icon name="check" />
            </button>
            {open === index && (
              <div
                className="capture-pop"
                role="menu"
                style={{ top: pop.top, left: pop.left }}
              >
                {(["splus", "rs", "any"] as CaptureQuality[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="menuitem"
                    className={`capture-pop-item quality-${item} ${quality === item ? "active" : ""}`}
                    onClick={() => setSlot(index, item)}
                  >
                    {qualityShort[item]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`icon-button ${favorite ? "is-favorite" : ""}`}
        disabled={busy}
        aria-label={
          favorite
            ? `Убрать ${family.name} из избранного`
            : `Добавить ${family.name} в избранное`
        }
        onClick={() => update({ favorite: !favorite })}
      >
        <Icon name="favorite" />
      </button>
    </div>
  );
}
export function FamilyCard({
  family,
  match,
}: {
  family: Family;
  match?: { formName?: string; formId?: string };
}) {
  const first = formById.get(family.formIds[0]);
  return (
    <article className="family-card">
      <Link
        className="family-link"
        to={`/miscrits/${family.slug}${match?.formId ? `?form=${encodeURIComponent(match.formId)}` : ""}`}
      >
        <div
          className={`card-portrait rarity-${family.rarity}`}
          title={rarityNames[family.rarity] || family.rarity}
        >
          <Art name={first?.name || family.name} compact />
          <img
            className="element-badge"
            src={elementIconSrc(family.elements)}
            alt={family.elements.map((item) => elementNames[item] || item).join(" / ")}
            title={family.elements.map((item) => elementNames[item] || item).join(" / ")}
          />
        </div>
        <div className="family-card-body">
          <strong>{family.name}</strong>
          {match?.formName && (
            <small className="match-note">
              Совпадение: {match.formName}
              {match.formId
                ? ` — ${formById.get(match.formId)?.stage}-я форма`
                : ""}
            </small>
          )}
        </div>
      </Link>
      <CatchActions family={family} formId={match?.formId || first?.id} />
    </article>
  );
}
