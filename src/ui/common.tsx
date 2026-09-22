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
const navIcons: Record<string, string[]> = {
  book: ["M232,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H24a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h72a8,8,0,0,0,8-8V56A8,8,0,0,0,232,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z"],
  map: ["M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.52,99.58,32.84a8,8,0,0,0-5.52-.6l-64,16A8,8,0,0,0,24,56V200a8,8,0,0,0,9.94,7.76l61.13-15.28,61.35,30.68A8.15,8.15,0,0,0,160,224a8,8,0,0,0,1.94-.24l64-16A8,8,0,0,0,232,200V56A8,8,0,0,0,228.92,49.69ZM104,52.94l48,24V203.06l-48-24ZM40,62.25l48-12v127.5l-48,12Zm176,131.5-48,12V78.25l48-12Z"],
  collection: ["M184,72H40A16,16,0,0,0,24,88V200a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V88A16,16,0,0,0,184,72Zm0,128H40V88H184V200ZM232,56V176a8,8,0,0,1-16,0V56H64a8,8,0,0,1,0-16H216A16,16,0,0,1,232,56Z"],
  tools: ["M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z"],
  search: ["M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"],
  check: ["M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"],
  favorite: ["M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z"],
  plus: ["M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"],
  minus: ["M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z"],
  chevron: ["M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"],
  close: ["M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"],
  filters: ["M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM40,56h0Zm106.18,74.58A8,8,0,0,0,144,136v58.66L112,216V136a8,8,0,0,0-2.16-5.47L40,56H216Z"],
  download: ["M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"],
};
export function Icon({ name }: { name: string }) {
  const paths = navIcons[name];
  if (!paths) return null;
  return (
    <svg className="icon nav-icon" viewBox="0 0 256 256" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
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
