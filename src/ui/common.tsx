import { Link } from "react-router-dom";
import { useState } from "react";
import { type Family, formById } from "../data/static";
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
export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    book: "M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4zm8 2v15M7 8h2m6 0h2M7 12h2m6 0h2",
    map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15",
    collection: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm13 0v6m-3-3h6",
    tools: "m14 4 3 3 4-3a6 6 0 0 1-8 8l-8 8-3-3 8-8a6 6 0 0 1 4-5z",
  };
  if (paths[name])
    return (
      <svg
        className="icon nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={paths[name]} />
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
export function CatchActions({
  family,
  formId,
}: {
  family: Family;
  formId?: string;
}) {
  const { entries, patch } = useProfile();
  const [busy, setBusy] = useState(false);
  const entry = entries[family.id];
  const caught = !!entry?.everCaught;
  const favorite = !!entry?.favorite;
  const update = async (change: {
    everCaught?: boolean;
    favorite?: boolean;
    obtainedFormIds?: string[];
  }) => {
    setBusy(true);
    try {
      await patch(family.id, change);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="catch-actions">
      <button
        type="button"
        disabled={busy}
        className={`catch-button ${caught ? "is-caught" : ""}`}
        onClick={() =>
          update({
            everCaught: !caught,
            obtainedFormIds:
              !caught && formId
                ? Array.from(
                    new Set([...(entry?.obtainedFormIds || []), formId]),
                  )
                : entry?.obtainedFormIds || [],
          })
        }
      >
        <Icon name="check" />
        {caught ? "Пойман" : "Пойман?"}
      </button>
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
        <div className="card-portrait">
          <Art name={first?.name || family.name} compact />
          <img
            className="rarity-overlay"
            src={`/assets/filters/rarity/${family.rarity}.png`}
            alt={rarityNames[family.rarity] || family.rarity}
            title={rarityNames[family.rarity] || family.rarity}
          />
        </div>
        <div className="family-card-body">
          <strong>{family.name}</strong>
          <Elements items={family.elements} />
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
