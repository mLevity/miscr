import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { type Family, formById } from "../data/static";
import { capturesOf, type CaptureQuality } from "../domain/collection/profile";
import { useProfile } from "../storage/profile";
import { assetsForName, assetManifest } from "./assets";
import { useT } from "../i18n/Language";

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
export function useDays() {
  const { t } = useT();
  return [0, 1, 2, 3, 4, 5, 6].map((index) => t(`day.${index}`));
}
export const rankNames = ["", "Weak", "Moderate", "Strong", "Max", "Elite"];
const navIcons: Record<string, { d: string; fill?: string }[]> = {
  book: [
    {
      fill: "currentColor",
      d: "M5.2 3.4h5.1c1.7 0 2.7.9 2.7 2.3v13.2c-1.2-.7-2.3-1-3.6-1H5.2c-.7 0-1.2-.5-1.2-1.1V4.5c0-.6.5-1.1 1.2-1.1Z",
    },
    {
      fill: "currentColor",
      d: "M13.7 3.4h5.1c.7 0 1.2.5 1.2 1.1v12.3c0 .6-.5 1.1-1.2 1.1h-4.2c-1.3 0-2.4.3-3.6 1V5.7c0-1.4 1-2.3 2.7-2.3Z",
    },
    { fill: "#11120f", d: "M8.2 7.2h2.1v1.3H8.2zm0 2.4h2.1v1.3H8.2z" },
  ],
  map: [
    {
      fill: "currentColor",
      d: "M4.2 5.1 9.3 3.4l5.4 1.8 5.1-1.7v14.4l-5.1 1.7-5.4-1.8-5.1 1.7V5.1Z",
    },
    {
      fill: "#11120f",
      d: "M9.3 5.2v12.3l5.4 1.5V6.7L9.3 5.2Zm6.2 3.6 1.6 2.4-1.6 2.8-1.6-2.8 1.6-2.4Z",
    },
  ],
  collection: [
    {
      fill: "currentColor",
      d: "M4 9.2 12 5.4 20 9.2v8.4L12 21.4 4 17.6V9.2Z",
    },
    {
      fill: "#11120f",
      d: "M12 8.1 7.2 10.3v5.2L12 17.7l4.8-2.2v-5.2L12 8.1Zm0 2.1 2.3 1.1v2.3L12 14.7l-2.3-1.1v-2.3L12 10.2Z",
    },
  ],
  tools: [
    {
      fill: "currentColor",
      d: "M7.2 3.6h3.1l.8 2.3 2.3.8v3.1l-2.2 1.6.6 2.4-2.4.6-1.6 2.2H4.7l-.8-2.3-2.3-.8V8.4l2.2-1.6L3.2 4.4l2.4-.6L7.2 3.6Z",
    },
    { fill: "#11120f", d: "M7.4 8.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" },
    {
      fill: "currentColor",
      d: "M13.4 13.1h2.4l6.4 6.4-2.4 2.4-6.4-6.4v-2.4Z",
    },
  ],
  download: [
    {
      fill: "currentColor",
      d: "M5 4.2h14v4.2l-2.2.8H7.2L5 8.4V4.2Zm2.4 6.6h9.2v4.4h2.4L12 21.2 4.9 15.2h2.5V10.8Z",
    },
  ],
};
export function Icon({ name }: { name: string }) {
  const shapes = navIcons[name];
  if (shapes)
    return (
      <svg
        className="icon nav-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {shapes.map((shape) => (
          <path key={shape.d} d={shape.d} fill={shape.fill || "currentColor"} />
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
  const { t } = useT();
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
      aria-label={t("art.missingNamed", { name })}
    >
      <span className="art-silhouette" aria-hidden="true" />
      <small>{t("art.missing")}</small>
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
  const { t } = useT();
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
          {t(`element.${item}`) === `element.${item}`
            ? elementNames[item] || item
            : t(`element.${item}`)}
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
  const { t } = useT();
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
        aria-label={t("catch.captures", { name: family.name })}
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
                  : t("catch.mark", { name: family.name })
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
                    {item === "any" ? t("catch.other") : qualityShort[item]}
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
            ? t("catch.favOff", { name: family.name })
            : t("catch.favOn", { name: family.name })
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
  const { t } = useT();
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
              {t("match.hit", { name: match.formName })}
              {match.formId
                ? ` — ${t("match.stage", { n: formById.get(match.formId)?.stage || "" })}`
                : ""}
            </small>
          )}
        </div>
      </Link>
      <CatchActions family={family} formId={match?.formId || first?.id} />
    </article>
  );
}
