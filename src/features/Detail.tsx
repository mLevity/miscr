import { Checkbox } from "../ui/controls";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  areaById,
  catalogRepository,
  collections,
  familyBySlug,
  formById,
  locationById,
  spawnsByFamily,
  type Ability,
  type AbilityBinding,
} from "../data/static";
import {
  Art,
  CatchActions,
  Elements,
  Icon,
  rarityNames,
  useDays,
} from "../ui/common";
import { Stats } from "../ui/Stats";
import { AbilityTile } from "../ui/AbilityTile";
import { useT } from "../i18n/Language";

export default function Detail() {
  const { t } = useT();
  const dayNames = useDays();
  const { slug } = useParams();
  const family = familyBySlug.get(slug || "");
  const [abilities, setAbilities] = useState<
    { binding: AbilityBinding; ability: Ability }[] | null
  >(null);
  const [enchanted, setEnchanted] = useState(false);
  useEffect(() => {
    if (!family) return;
    let active = true;
    setAbilities(null);
    catalogRepository.getAbilities(family.id).then((items) => {
      if (active) setAbilities(items);
    });
    return () => {
      active = false;
    };
  }, [family?.id]);
  if (!family)
    return (
      <div className="page empty-state">
        <h1>{t("detail.missing")}</h1>
        <Link to="/">{t("detail.backCatalog")}</Link>
      </div>
    );
  const selected = family.formIds[0];
  const spawns = spawnsByFamily.get(family.id) || [];
  const sets = collections.filter((item) =>
    item.requirements.some((req) => req.familyId === family.id),
  );
  return (
    <div className="page detail-page">
      <Link className="back-link" to="/">
        {t("detail.back")}
      </Link>
      <div className="detail-top">
        <div>
          <p className="eyebrow">{t("detail.eyebrow")}</p>
          <h1 className="latin-title">{family.name}</h1>
          <Elements items={family.elements} />
          <p className={`rarity rarity-${family.rarity}`}>
            {t(`rarity.${family.rarity}`) === `rarity.${family.rarity}` ? rarityNames[family.rarity] : t(`rarity.${family.rarity}`)}
          </p>
        </div>
        <div className="detail-actions">
          <CatchActions family={family} formId={selected} />
          <Link
            className="secondary-button"
            to={`/tools/damage?attacker=${encodeURIComponent(family.id)}`}
          >
            <Icon name="tools" />
            {t("detail.damage")}
          </Link>
          <Link
            className="secondary-button"
            to={`/tools/rebonus?family=${encodeURIComponent(family.id)}`}
          >
            {t("detail.rebonus")}
          </Link>
        </div>
      </div>
      <div className="detail-layout">
        <section
          className="detail-art-panel evolution-gallery"
          aria-label={t("detail.forms")}
        >
          {family.formIds.map((id, index) => {
            const form = formById.get(id);
            return (
              <figure
                key={id}
                className={index === 0 ? "first-evolution" : "next-evolution"}
              >
                <Art name={form?.name || family.name} compact={index > 0} />
                <figcaption>
                  <small>{t("detail.formN", { n: index + 1 })}</small>
                  <strong>{form?.name}</strong>
                </figcaption>
              </figure>
            );
          })}
        </section>
        <div className="detail-content">
          <div className="stats-and-abilities">
            <section className="content-panel stats-panel">
              <h2>{t("detail.stats")}</h2>
              <Stats ranks={family.baseRanks} />
            </section>
            <section className="content-panel abilities-panel">
              <div className="section-heading">
                <h2>{t("detail.abilities")}</h2>
                <label className="checkbox-line">
                  <Checkbox
                    checked={enchanted}
                    onChange={(event) => setEnchanted(event.target.checked)}
                  />
                  {t("detail.enchant")}
                </label>
              </div>
              {abilities === null ? (
                <p role="status">{t("detail.loadingAbilities")}</p>
              ) : (
                <div className="ability-grid">
                  {abilities.map(({ binding, ability }) => (
                    <AbilityTile
                      key={binding.abilityId}
                      ability={ability}
                      enchanted={enchanted}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
          <section className="content-panel">
            <h2>{t("detail.where")}</h2>
            {spawns.length ? (
              <div className="spawn-list">
                {spawns.map((spawn) => (
                  <article key={spawn.id}>
                    <strong>
                      {locationById.get(spawn.locationId)?.name ||
                        spawn.locationId}
                    </strong>
                    <span>
                      {areaById.get(spawn.areaId || "")?.name ||
                        t("map.unknownArea")}{" "}
                      ·{" "}
                      {spawn.acquisition === "shop"
                        ? t("catalog.shop")
                        : t("catalog.wild")}
                    </span>
                    <span>
                      {t("detail.days")}{" "}
                      {spawn.schedule.weekdays?.length
                        ? spawn.schedule.weekdays
                            .map((day) => dayNames[day - 1])
                            .join(", ")
                        : t("detail.unknownDays")}
                    </span>
                    {spawn.markerIds.length > 0 && (
                      <Link
                        to={`/map?location=${encodeURIComponent(spawn.locationId)}&family=${encodeURIComponent(family.id)}`}
                      >
                        {t("detail.onMap")}
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p>
                {t("detail.noPlace")}
              </p>
            )}
          </section>
          <section className="content-panel">
            <h2>{t("detail.collector")}</h2>
            {sets.length ? (
              <ul className="plain-list">
                {sets.map((set) => (
                  <li key={set.id}>
                    <Link to="/collection">{set.name}</Link> · {set.sourceGroup}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {t("detail.noSets")}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
