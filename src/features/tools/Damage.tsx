import { Select, Checkbox } from '../../ui/controls';
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  catalogRepository,
  families,
  familyById,
  type Ability,
  type AbilityBinding,
} from "../../data/static";
import relicData from "../../data/generated/relics.json";
import {
  KEYS,
  abilityDamage,
  resolveAbility,
  statRecord,
  totalStats,
  type Colors,
  type Color,
  type Stats,
} from "../../domain/calculations/core";
import { Elements } from "../../ui/common";
type Build = {
  familyId: string;
  level: number;
  colors: Colors;
  bonuses: Stats;
  relicIds: string[];
  overrides: Partial<Stats>;
};
const relics = relicData as {
  id: string;
  name: string;
  requiredSlotLevel: number;
  statModifiers: Partial<Stats>;
  specialEffectsText: string[];
  image: string;
}[];
const slots = [10, 20, 30, 35];
const makeBuild = (id: string): Build => ({
  familyId: familyById.has(id) ? id : "miscrit:1",
  level: 35,
  colors: statRecord<Color>("green"),
  bonuses: statRecord(0),
  relicIds: ["", "", "", ""],
  overrides: {},
});
function statsFor(build: Build) {
  const family = familyById.get(build.familyId)!;
  const equipped = build.relicIds.flatMap((id, index) => {
    if (!id) return [];
    const relic = relics.find((item) => item.id === id);
    if (
      !relic ||
      build.level < slots[index] ||
      relic.requiredSlotLevel !== slots[index]
    )
      throw Error("Реликвия не соответствует открытому слоту");
    return [relic];
  });
  const stats = totalStats(
    family.baseRanks,
    build.level,
    build.colors,
    build.bonuses,
    equipped,
  );
  for (const key of KEYS) {
    const manual = build.overrides[key];
    if (manual !== undefined) {
      if (!Number.isFinite(manual) || manual < 1 || manual > 100000)
        throw Error(`Ручное значение ${key.toUpperCase()}: от 1 до 100000`);
      stats[key] = manual;
    }
  }
  return stats;
}
function ProfileEditor({
  title,
  build,
  onChange,
}: {
  title: string;
  build: Build;
  onChange: (value: Build) => void;
}) {
  let computed: Stats | null = null,
    error = "";
  try {
    computed = statsFor(build);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <section className="content-panel">
      <h2>{title}</h2>
      <label className="field-label">
        Мискрит
        <Select
          value={build.familyId}
          onChange={(event) =>
            onChange({ ...build, familyId: event.target.value })
          }
        >
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </label>
      <Elements items={familyById.get(build.familyId)!.elements} />
      <div className="action-row">
        <label>
          Уровень{" "}
          <input
            aria-label={`${title}: уровень`}
            type="number"
            min={1}
            max={35}
            value={Number.isNaN(build.level) ? "" : build.level}
            onChange={(event) => {
              const level = event.target.valueAsNumber;
              onChange({
                ...build,
                level,
                relicIds: build.relicIds.map((id, i) =>
                  level < slots[i] ? "" : id,
                ),
              });
            }}
          />
        </label>
        <button
          onClick={() =>
            onChange({ ...build, colors: statRecord<Color>("green") })
          }
        >
          S+
        </button>
        <button
          onClick={() =>
            onChange({
              ...build,
              colors: { ...statRecord<Color>("green"), spd: "red" },
            })
          }
        >
          RS
        </button>
      </div>
      <p className="muted">Нулевые бонусы — сравнение базовых статов.</p>
      <div className="table-scroll">
        <table className="profile-table">
          <thead>
            <tr>
              <th>Стат</th>
              <th>Цвет</th>
              <th>Бонус</th>
              <th>Итог</th>
            </tr>
          </thead>
          <tbody>
            {KEYS.map((key) => (
              <tr key={key}>
                <th>{key.toUpperCase()}</th>
                <td>
                  <Select
                    aria-label={`${title}: ${key} цвет`}
                    value={build.colors[key]}
                    onChange={(event) =>
                      onChange({
                        ...build,
                        colors: {
                          ...build.colors,
                          [key]: event.target.value as Color,
                        },
                      })
                    }
                  >
                    <option value="green">Зелёный</option>
                    <option value="white">Белый</option>
                    <option value="red">Красный</option>
                  </Select>
                </td>
                <td>
                  <input
                    aria-label={`${title}: ${key} бонус`}
                    type="number"
                    min={0}
                    max={136}
                    value={
                      Number.isNaN(build.bonuses[key]) ? "" : build.bonuses[key]
                    }
                    onChange={(event) =>
                      onChange({
                        ...build,
                        bonuses: {
                          ...build.bonuses,
                          [key]: event.target.valueAsNumber,
                        },
                      })
                    }
                  />
                </td>
                <td>{computed?.[key] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Реликвии и ручные значения</summary>
        {slots.map((slot, index) => (
          <label className="field-label" key={slot}>
            Слот уровня {slot}
            <Select
              disabled={build.level < slot || !Number.isFinite(build.level)}
              value={build.relicIds[index]}
              onChange={(event) =>
                onChange({
                  ...build,
                  relicIds: build.relicIds.map((id, i) =>
                    i === index ? event.target.value : id,
                  ),
                })
              }
            >
              <option value="">Без реликвии</option>
              {relics
                .filter((item) => item.requiredSlotLevel === slot)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </label>
        ))}
        <div className="equipped-relics">
          {build.relicIds.flatMap((id) => {
            const relic = relics.find((item) => item.id === id);
            return relic
              ? [
                  <figure key={id}>
                    <img
                      src={`/${relic.image}`}
                      alt={relic.name}
                      width={48}
                      height={48}
                    />
                    <figcaption>{relic.name}</figcaption>
                  </figure>,
                ]
              : [];
          })}
        </div>
        <p className="muted">
          Ручное значение заменяет итог только выбранного стата. Пустое поле
          возвращает автоматический расчёт.
        </p>
        <div className="tool-grid">
          {KEYS.map((key) => (
            <label key={key}>
              {key.toUpperCase()}{" "}
              {build.overrides[key] !== undefined ? "· вручную" : ""}
              <input
                aria-label={`${title}: ${key} вручную`}
                type="number"
                min={1}
                max={100000}
                value={build.overrides[key] ?? ""}
                onChange={(event) => {
                  const overrides = { ...build.overrides };
                  if (event.target.value === "") delete overrides[key];
                  else overrides[key] = event.target.valueAsNumber;
                  onChange({ ...build, overrides });
                }}
              />
            </label>
          ))}
        </div>
        <button onClick={() => onChange({ ...build, overrides: {} })}>
          Сбросить ручные значения
        </button>
      </details>
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
    </section>
  );
}
export default function Damage() {
  const [params] = useSearchParams();
  const [attacker, setAttacker] = useState(() =>
    makeBuild(params.get("attacker") || "miscrit:1"),
  );
  const [defender, setDefender] = useState(() => makeBuild("miscrit:1"));
  const [bindings, setBindings] = useState<
    { binding: AbilityBinding; ability: Ability }[]
  >([]);
  const [abilityId, setAbilityId] = useState("");
  const [enchanted, setEnchanted] = useState(false);
  const [negate, setNegate] = useState(false);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    setBindings([]);
    setAbilityId("");
    setLoadError("");
    catalogRepository
      .getAbilities(attacker.familyId)
      .then((items) => {
        if (active) {
          setBindings(items);
          setAbilityId(
            (
              items.find((item) => item.ability.name === "Mighty Bash") ||
              items.find(
                (item) => item.ability.calculationSupport === "direct",
              ) ||
              items[0]
            )?.ability.id || "",
          );
        }
      })
      .catch(() => {
        if (active)
          setLoadError("Не удалось загрузить навыки. Обновите страницу.");
      });
    return () => {
      active = false;
    };
  }, [attacker.familyId]);
  const ability = bindings.find(
    (item) => item.ability.id === abilityId,
  )?.ability;
  let result: ReturnType<typeof abilityDamage> | null = null,
    error = "";
  try {
    if (ability)
      result = abilityDamage(
        ability,
        statsFor(attacker),
        statsFor(defender),
        familyById.get(defender.familyId)!.elements,
        enchanted,
        negate,
      );
  } catch (e) {
    error = (e as Error).message;
  }
  const resolved = ability ? resolveAbility(ability, enchanted) : null;
  return (
    <div className="tool-page">
      <div className="tool-heading">
        <div>
          <Link to="/tools">← Инструменты</Link>
          <h1>Калькулятор урона</h1>
          <p className="muted">
            Модель Hub Direct v1 · версия правил snapshot-2026-09-15
          </p>
        </div>
        <button
          onClick={() => {
            setAttacker(defender);
            setDefender(attacker);
            setAbilityId("");
          }}
        >
          Поменять стороны
        </button>
      </div>
      <div className="damage-layout">
        <ProfileEditor
          title="Кто атакует"
          build={attacker}
          onChange={setAttacker}
        />
        <ProfileEditor
          title="Кого атакует"
          build={defender}
          onChange={setDefender}
        />
      </div>
      <section className="content-panel damage-skill">
        <h2>Навык</h2>
        <Select
          aria-label="Навык атакующего"
          value={abilityId}
          onChange={(event) => setAbilityId(event.target.value)}
        >
          {bindings.length === 0 && <option value="">Загрузка…</option>}
          {bindings.map(({ ability, binding }) => (
            <option value={ability.id} key={ability.id}>
              {ability.name} · ур. {binding.unlockLevel ?? "?"}
            </option>
          ))}
        </Select>
        <label className="checkbox-line">
          <Checkbox
            checked={enchanted}
            onChange={(event) => setEnchanted(event.target.checked)}
          />
          Зачарование
        </label>
        <label className="checkbox-line">
          <Checkbox
            checked={negate}
            onChange={(event) => setNegate(event.target.checked)}
          />
          Negate · ×1
        </label>
      </section>
      {resolved && (
        <p className="muted">
          AP {resolved.ap ?? "не указан"} · {resolved.hits ?? "?"} удар(ов) ·
          точность{" "}
          {resolved.accuracyPercent === null
            ? "не указана"
            : `${resolved.accuracyPercent}%`}
          . {ability?.descriptionEn}{" "}
          {enchanted ? ability?.enchantDescriptionEn : ""}
        </p>
      )}
      {(loadError || error) && (
        <p className="content-panel danger-text" role="alert">
          {loadError || error}
        </p>
      )}
      {result && (
        <section className="damage-result" aria-live="polite">
          <p className="eyebrow">Прямой урон при попадании</p>
          <strong>
            {result.min}–{result.max} урона
          </strong>
          <p>
            Середина диапазона: {result.midpoint} (не математическое ожидание).
            Множитель стихий: ×{result.multiplier}.
          </p>
          <p>
            Применений навыка до KO: от {result.koMinHits ?? "не определено"} до{" "}
            {result.koGuaranteedHits ?? "не гарантировано"}.
          </p>
          {result.partial && (
            <p className="danger-text">
              Посчитан только прямой удар. Дополнительные эффекты навыка,
              включая лечение, не учтены.
            </p>
          )}
          {[...attacker.relicIds, ...defender.relicIds].some(
            (id) =>
              relics.find((item) => item.id === id)?.specialEffectsText.length,
          ) && <p>Специальные эффекты выбранных реликвий не учтены.</p>}
          <small>
            Все удары попали; без критов, щитов, ответных действий и лечения.
          </small>
        </section>
      )}
    </div>
  );
}
