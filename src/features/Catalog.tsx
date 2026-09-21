import { statChunk } from "../ui/Stats";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { families, locations } from "../data/static";
import tags from "../data/generated/tags.json";
import {
  defaultFilter,
  elementCombos,
  filterFamilies,
  rankKeys,
  rarities,
  readFilter,
  writeFilter,
  type CatalogFilter,
} from "../domain/catalog/filter";
import { useProfile } from "../storage/profile";
import { elementNames, FamilyCard, Icon, useDays } from "../ui/common";
import { useT } from "../i18n/Language";
import { Popover, Select } from "../ui/controls";
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((x) => x !== value)
    : [...values, value];
const gameIcon = (name: string, kind = "elements") =>
  `/assets/filters/${kind}/${name}.png`;
export default function Catalog() {
  const { t } = useT();
  const dayNames = useDays();
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params);
  const { entries } = useProfile();
  const [visible, setVisible] = useState(48);
  const results = useMemo(
    () => filterFamilies(families, filter, entries),
    [params, entries],
  );
  const change = (update: Partial<CatalogFilter>) => {
    setVisible(48);
    setParams(writeFilter({ ...filter, ...update }), { replace: true });
  };
  const active = writeFilter({ ...filter, q: "", sort: "name-asc" }).size > 0;
  return (
    <div className="page catalog-page">
      <div className="catalog-heading">
        <p className="eyebrow">{t("catalog.eyebrow")}</p>
        <h1>{t("catalog.title")}</h1>
      </div>
      <div className="catalog-search-area">
        <label className="search-box">
          <Icon name="search" />
          <span className="sr-only">{t("catalog.search")}</span>
          <input
            type="search"
            placeholder={t("catalog.searchPlaceholder")}
            value={filter.q}
            onChange={(e) => change({ q: e.target.value.slice(0, 120) })}
          />
        </label>
        <div className="primary-filters">
          <Popover
            className="rarity-filter"
            active={!!filter.rarity.length}
            label={
              <>
                <span>
                  {t("catalog.rarity")}
                </span>
                {filter.rarity[0] && (
                  <i className={`rarity-dot rarity-${filter.rarity[0]}`} />
                )}
              </>
            }
          >
            <div className="dropdown-title">{t("catalog.rarity")}</div>
            {["", ...rarities].map((value) => (
              <button
                key={value}
                className={`filter-option rarity-${value || "all"}`}
                aria-pressed={value === (filter.rarity[0] || "")}
                onClick={() => change({ rarity: value ? [value] : [] })}
              >
                <span>
                  {value ? t(`rarity.${value}`) : t("catalog.all")}
                </span>
                <span aria-hidden="true">
                  {value === (filter.rarity[0] || "") ? "✓" : ""}
                </span>
              </button>
            ))}
          </Popover>
          <Popover
            className="stats-filter"
            active={!!Object.keys(filter.ranks).length}
            label={
              <span>
                {t("catalog.stats")}
              </span>
            }
          >
            <div className="dropdown-title">
              {t("catalog.baseRank")}{" "}
              <button
                className="text-button"
                onClick={() => change({ ranks: {} })}
              >
                {t("catalog.reset")}
              </button>
            </div>
            {rankKeys.map((key) => {
              const value = filter.ranks[key]?.[0] || 0;
              return (
                <div className="stat-filter-row" key={key}>
                  <img src={gameIcon(key, "stats")} alt="" />
                  <strong>{key.toUpperCase()}</strong>
                  <div
                    className="rank-segments game-rank-segments"
                    style={{
                      backgroundImage: `url(/assets/filters/chunks/${statChunk(key)}_chunktainer.png)`,
                    }}
                    role="group"
                    aria-label={t("catalog.exactRank", { stat: key.toUpperCase() })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        className={n <= value ? "filled" : ""}
                        style={{
                          backgroundImage:
                            n <= value
                              ? `url(/assets/filters/chunks/${statChunk(key)}_chunk.png)`
                              : undefined,
                        }}
                        aria-label={t("catalog.rankN", { stat: key.toUpperCase(), n })}
                        aria-pressed={value === n}
                        title={t("catalog.rankTitle", { n })}
                        onClick={() => {
                          const ranks = { ...filter.ranks };
                          if (value === n) delete ranks[key];
                          else ranks[key] = [n, n];
                          change({ ranks });
                        }}
                      />
                    ))}
                  </div>
                  <span className="rank-value">{value || "—"}</span>
                </div>
              );
            })}
            <p className="filter-help">
              {t("catalog.exactHint")}
            </p>
          </Popover>
          <Popover
            className="tags-filter"
            active={!!filter.tags.length}
            label={
              <>
                <span>
                  {t("catalog.tags")}
                </span>
                {!!filter.tags.length && (
                  <b className="filter-count">{filter.tags.length}</b>
                )}
              </>
            }
          >
            <div className="dropdown-title">
              {t("catalog.abilityEffects")}{" "}
              <button
                className="text-button"
                onClick={() => change({ tags: [] })}
              >
                {t("catalog.reset")}
              </button>
            </div>
            <p className="filter-help">
              {t("catalog.tagHint")}
            </p>
            <div className="tag-options">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className="filter-option tag-option"
                  aria-pressed={filter.tags.includes(tag.id)}
                  title={tag.description}
                  onClick={() => change({ tags: toggle(filter.tags, tag.id) })}
                >
                  <img src={gameIcon(tag.icon)} alt="" />
                  <span>
                    {tag.name}
                    <small>{tag.description}</small>
                  </span>
                  <span className="tag-count">{tag.count}</span>
                  <span className="tag-check" aria-hidden="true">
                    {filter.tags.includes(tag.id) ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>
          </Popover>
        </div>
        <div
          className="element-filters"
          role="group"
          aria-label={t("catalog.elements")}
        >
          {elementCombos.map((value) => (
            <button
              key={value}
              className={`element-toggle ${value.includes("/") || value.length > 10 ? "dual" : ""} ${filter.elements.includes(value) ? "selected" : ""}`}
              aria-label={t(`element.${value}`) === `element.${value}` ? (elementNames[value] || value) : t(`element.${value}`)}
              aria-pressed={filter.elements.includes(value)}
              title={t(`element.${value}`) === `element.${value}` ? (elementNames[value] || value) : t(`element.${value}`)}
              onClick={() =>
                change({ elements: toggle(filter.elements, value) })
              }
            >
              <img src={gameIcon(value)} alt="" />
            </button>
          ))}
        </div>
      </div>
      <details className="extra-filters">
        <summary>{t("catalog.habitat")}</summary>
        <div className="extra-filter-grid">
          <label>
            {t("catalog.collection")}
            <Select
              value={filter.caught}
              onChange={(e) =>
                change({ caught: e.target.value as CatalogFilter["caught"] })
              }
            >
              <option value="all">{t("catalog.allMiscrits")}</option>
              <option value="caught">{t("catalog.caught")}</option>
              <option value="missing">{t("catalog.missing")}</option>
            </Select>
          </label>
          <label>
            {t("catalog.dayUtc")}
            <Select
              value={filter.day ?? ""}
              onChange={(e) =>
                change({ day: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">{t("catalog.allDays")}</option>
              {dayNames.map((day, i) => (
                <option value={i + 1} key={day}>
                  {day}
                </option>
              ))}
            </Select>
          </label>
          <label>
            {t("catalog.place")}
            <Select
              value={filter.locations[0] || ""}
              onChange={(e) =>
                change({
                  locations: e.target.value ? [e.target.value] : [],
                  areas: [],
                })
              }
            >
              <option value="">{t("catalog.allPlaces")}</option>
              {locations
                .filter((l) => l.kind === "world")
                .map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            {t("catalog.acquisition")}
            <Select
              value={filter.acquisition[0] || ""}
              onChange={(e) =>
                change({ acquisition: e.target.value ? [e.target.value] : [] })
              }
            >
              <option value="">{t("catalog.allSources")}</option>
              <option value="wild">{t("catalog.wild")}</option>
              <option value="shop">{t("catalog.shop")}</option>
              <option value="unknown">{t("catalog.unknown")}</option>
            </Select>
          </label>
          <button
            aria-pressed={filter.favorite}
            onClick={() => change({ favorite: !filter.favorite })}
          >
            <Icon name="favorite" /> {t("catalog.favorites")}
          </button>
        </div>
      </details>
      <section className="catalog-results" aria-label={t("catalog.searchResults")}>
        <div className="results-head">
          <strong aria-live="polite">{t("catalog.found", { count: results.length })}</strong>
          <div className="results-actions">
            {active && (
              <button
                className="text-button"
                onClick={() => change({ ...defaultFilter, q: filter.q })}
              >
                {t("catalog.resetFilters")}
              </button>
            )}
            <Select
              aria-label={t("catalog.sort")}
              value={filter.sort}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="name-asc">{t("catalog.sortNameAsc")}</option>
              <option value="name-desc">{t("catalog.sortNameDesc")}</option>
              <option value="rarity-asc">{t("catalog.sortRarityAsc")}</option>
              <option value="rarity-desc">{t("catalog.sortRarityDesc")}</option>
              <option value="id">{t("catalog.sortId")}</option>
              {rankKeys.map((key) => (
                <option key={key} value={`stat-${key}`}>
                  {key.toUpperCase()} ↓
                </option>
              ))}
            </Select>
          </div>
        </div>
        {results.length ? (
          <>
            <div className="family-grid">
              {results.slice(0, visible).map(({ family, match }) => (
                <FamilyCard key={family.id} family={family} match={match} />
              ))}
            </div>
            {results.length > visible && (
              <button
                className="load-more secondary-button"
                onClick={() => setVisible(visible + 48)}
              >
                {t("catalog.showMore", { count: results.length - visible })}
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h2>{t("catalog.empty")}</h2>
            <p>{t("catalog.emptyHint")}</p>
            <button onClick={() => change(defaultFilter)}>{t("catalog.resetAll")}</button>
          </div>
        )}
      </section>
    </div>
  );
}
