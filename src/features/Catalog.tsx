import { statChunk } from "../ui/Stats";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { families, locations } from "../data/static";
import tags from "../data/generated/tags.json";
import {
  defaultFilter,
  elements,
  filterFamilies,
  rankKeys,
  rarities,
  readFilter,
  writeFilter,
  type CatalogFilter,
} from "../domain/catalog/filter";
import { useProfile } from "../storage/profile";
import { dayNames, elementNames, FamilyCard, Icon } from "../ui/common";
import { Popover, Select } from "../ui/controls";
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((x) => x !== value)
    : [...values, value];
const gameIcon = (name: string, kind = "elements") =>
  `/assets/filters/${kind}/${name}.png`;
export default function Catalog() {
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
        <p className="eyebrow">Найди своего мискрита</p>
        <h1>Мискриты</h1>
        <p className="muted">420 семейств · 1 680 эволюций · одна коллекция</p>
      </div>
      <div className="catalog-search-area">
        <label className="search-box">
          <Icon name="search" />
          <span className="sr-only">Поиск по мискритам и эволюциям</span>
          <input
            type="search"
            placeholder="Имя мискрита или эволюции"
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
                  Rarity <small>Редкость</small>
                </span>
                {filter.rarity[0] && (
                  <i className={`rarity-dot rarity-${filter.rarity[0]}`} />
                )}
              </>
            }
          >
            <div className="dropdown-title">Редкость</div>
            {["", ...rarities].map((value) => (
              <button
                key={value}
                className={`filter-option rarity-${value || "all"}`}
                aria-pressed={value === (filter.rarity[0] || "")}
                onClick={() => change({ rarity: value ? [value] : [] })}
              >
                <span>
                  {value ? value[0].toUpperCase() + value.slice(1) : "Все"}
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
                Stats <small>Статы</small>
              </span>
            }
          >
            <div className="dropdown-title">
              Базовый ранг{" "}
              <button
                className="text-button"
                onClick={() => change({ ranks: {} })}
              >
                Сбросить
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
                    aria-label={`${key.toUpperCase()}: точный ранг`}
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
                        aria-label={`${key.toUpperCase()}: ранг ${n}`}
                        aria-pressed={value === n}
                        title={`Ранг ${n}`}
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
              Точный ранг · повторное нажатие снимает выбор.
            </p>
          </Popover>
          <Popover
            className="tags-filter"
            active={!!filter.tags.length}
            label={
              <>
                <span>
                  Tags <small>Теги</small>
                </span>
                {!!filter.tags.length && (
                  <b className="filter-count">{filter.tags.length}</b>
                )}
              </>
            }
          >
            <div className="dropdown-title">
              Эффекты способностей{" "}
              <button
                className="text-button"
                onClick={() => change({ tags: [] })}
              >
                Сбросить
              </button>
            </div>
            <p className="filter-help">
              Включая зачарования. Все выбранные теги должны присутствовать.
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
          aria-label="Стихии: все выбранные одновременно"
        >
          {elements.map((value) => (
            <button
              key={value}
              className={`element-toggle ${filter.elements.includes(value) ? "selected" : ""}`}
              aria-label={elementNames[value]}
              aria-pressed={filter.elements.includes(value)}
              title={elementNames[value]}
              onClick={() =>
                change({ elements: toggle(filter.elements, value) })
              }
            >
              <img src={gameIcon(value)} alt="" />
            </button>
          ))}
        </div>
        <p className="element-help">
          {filter.elements.length
            ? filter.elements.map((x) => elementNames[x]).join(" + ")
            : "Выберите стихии"}{" "}
          · сочетание по «И»
        </p>
      </div>
      <details className="extra-filters">
        <summary>Коллекция и места обитания</summary>
        <div className="extra-filter-grid">
          <label>
            Коллекция
            <Select
              value={filter.caught}
              onChange={(e) =>
                change({ caught: e.target.value as CatalogFilter["caught"] })
              }
            >
              <option value="all">Все мискриты</option>
              <option value="caught">Пойманы</option>
              <option value="missing">Не пойманы</option>
            </Select>
          </label>
          <label>
            День · UTC
            <Select
              value={filter.day ?? ""}
              onChange={(e) =>
                change({ day: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">Все дни</option>
              {dayNames.map((day, i) => (
                <option value={i + 1} key={day}>
                  {day}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Место
            <Select
              value={filter.locations[0] || ""}
              onChange={(e) =>
                change({
                  locations: e.target.value ? [e.target.value] : [],
                  areas: [],
                })
              }
            >
              <option value="">Все места</option>
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
            Получение
            <Select
              value={filter.acquisition[0] || ""}
              onChange={(e) =>
                change({ acquisition: e.target.value ? [e.target.value] : [] })
              }
            >
              <option value="">Все способы</option>
              <option value="wild">Дикая природа</option>
              <option value="shop">Магазин</option>
              <option value="unknown">Неизвестно</option>
            </Select>
          </label>
          <button
            aria-pressed={filter.favorite}
            onClick={() => change({ favorite: !filter.favorite })}
          >
            <Icon name="favorite" /> Только избранные
          </button>
        </div>
      </details>
      <section className="catalog-results" aria-label="Результаты поиска">
        <div className="results-head">
          <strong aria-live="polite">Найдено: {results.length}</strong>
          <div className="results-actions">
            {active && (
              <button
                className="text-button"
                onClick={() => change({ ...defaultFilter, q: filter.q })}
              >
                Сбросить фильтры
              </button>
            )}
            <Select
              aria-label="Сортировка"
              value={filter.sort}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="name-asc">Имя A–Z</option>
              <option value="name-desc">Имя Z–A</option>
              <option value="rarity-asc">Редкость ↑</option>
              <option value="rarity-desc">Редкость ↓</option>
              <option value="id">Исходный ID</option>
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
                Показать ещё · {results.length - visible}
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h2>Ничего не найдено</h2>
            <p>Измените запрос или снимите часть условий.</p>
            <button onClick={() => change(defaultFilter)}>Сбросить всё</button>
          </div>
        )}
      </section>
    </div>
  );
}
