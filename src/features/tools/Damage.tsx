import { Select, Checkbox } from '../../ui/controls';
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { assetsForFormId } from "../../ui/assets";
import "../../ui/damage.css";
const colorLabels: { id: Color; name: string }[] = [
  { id: "green", name: "Зелёный" },
  { id: "white", name: "Белый" },
  { id: "red", name: "Красный" },
];
function fighterArt(familyId: string) {
  const family = familyById.get(familyId);
  const formId = family?.formIds[0];
  return formId
    ? assetsForFormId(formId)?.avatarPath ||
        assetsForFormId(formId)?.battlePath ||
        ""
    : "";
}
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
const colorOrder: Color[] = ["green", "white", "red"];
function nextColor(current: Color): Color {
  return colorOrder[(colorOrder.indexOf(current) + 1) % colorOrder.length];
}
function RelicMods({ mods }: { mods: Partial<Stats> }) {
  const items = KEYS.filter((key) => mods[key]);
  if (!items.length) return null;
  return (
    <span className="relic-mods">
      {items.map((key) => (
        <span
          key={key}
          className={`relic-mod ${(mods[key] || 0) < 0 ? "neg" : "pos"}`}
        >
          {key.toUpperCase()} {(mods[key] || 0) > 0 ? "+" : ""}
          {mods[key]}
        </span>
      ))}
    </span>
  );
}
function RelicPicker({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  options: typeof relics;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360 });
  const selected = options.find((item) => item.id === value);
  useEffect(() => {
    if (!open || !button.current) return;
    const box = button.current.getBoundingClientRect();
    const width = Math.min(380, Math.max(280, window.innerWidth - 24));
    const left = Math.min(Math.max(12, box.left), window.innerWidth - width - 12);
    const below = box.bottom + 8;
    const height = Math.min(420, window.innerHeight - 24);
    const top =
      below + height < window.innerHeight - 12
        ? below
        : Math.max(12, box.top - height - 8);
    setPos({ left, top, width });
    const close = (event: PointerEvent) => {
      if (
        !wrap.current?.contains(event.target as Node) &&
        !list.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="relic-picker" ref={wrap}>
      <span className="relic-slot-label">{label}</span>
      <button
        ref={button}
        type="button"
        className={`relic-trigger ${open ? "open" : ""} ${selected ? "filled" : ""}`}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <img src={`/${selected.image}`} alt="" />
        ) : (
          <span className="relic-empty-icon" aria-hidden="true">
            +
          </span>
        )}
        <span className="relic-trigger-copy">
          <strong>{selected ? selected.name : "Пустой слот"}</strong>
          {selected ? (
            <RelicMods mods={selected.statModifiers} />
          ) : (
            <em>Выбрать реликвию</em>
          )}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            className="relic-menu"
            role="listbox"
            aria-label={label}
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            <button
              type="button"
              role="option"
              className={`relic-option empty ${value === "" ? "active" : ""}`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <span className="relic-empty-icon">–</span>
              <span className="relic-option-copy">
                <strong>Без реликвии</strong>
                <em>Слот свободен</em>
              </span>
            </button>
            {options.map((item) => (
              <button
                type="button"
                role="option"
                key={item.id}
                className={`relic-option ${item.id === value ? "active" : ""}`}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                <img src={`/${item.image}`} alt="" />
                <span className="relic-option-copy">
                  <strong>{item.name}</strong>
                  <RelicMods mods={item.statModifiers} />
                  {item.specialEffectsText[0] && (
                    <em className="relic-special">{item.specialEffectsText[0]}</em>
                  )}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
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
  const art = fighterArt(build.familyId);
  return (
    <section className="fighter-card">
      <div className="fighter-head">
        {art ? <img className="fighter-avatar" src={art} alt="" /> : <span className="fighter-avatar" />}
        <div>
          <h2>{title}</h2>
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
          <Elements items={familyById.get(build.familyId)!.elements} />
        </div>
      </div>
      <div className="fighter-meta">
        <label>
          Уровень
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
          type="button"
          className="preset-btn"
          onClick={() =>
            onChange({ ...build, colors: statRecord<Color>("green") })
          }
        >
          S+
        </button>
        <button
          type="button"
          className="preset-btn"
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
      <div className="stat-rows">
        {KEYS.map((key) => (
          <div className="stat-row" key={key}>
            <button
              type="button"
              className={`stat-row-key color-${build.colors[key]}`}
              title={`${colorLabels.find((item) => item.id === build.colors[key])?.name}. Нажмите, чтобы сменить цвет`}
              aria-label={`${title}: ${key} цвет ${build.colors[key]}`}
              onClick={() =>
                onChange({
                  ...build,
                  colors: {
                    ...build.colors,
                    [key]: nextColor(build.colors[key]),
                  },
                })
              }
            >
              <img src={`/assets/filters/stats/${key}.png`} alt="" />
              {key.toUpperCase()}
            </button>
            <input
              aria-label={`${title}: ${key} бонус`}
              type="number"
              min={0}
              max={136}
              value={Number.isNaN(build.bonuses[key]) ? "" : build.bonuses[key]}
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
            <span className="stat-total">{computed?.[key] ?? "—"}</span>
          </div>
        ))}
      </div>
      <div className="relic-slots">
        {slots.map((slot, index) => (
          <RelicPicker
            key={slot}
            label={`Слот ${slot}`}
            disabled={build.level < slot || !Number.isFinite(build.level)}
            value={build.relicIds[index]}
            options={relics.filter((item) => item.requiredSlotLevel === slot)}
            onChange={(id) =>
              onChange({
                ...build,
                relicIds: build.relicIds.map((current, i) =>
                  i === index ? id : current,
                ),
              })
            }
          />
        ))}
      </div>
      <details className="manual-block">
        <summary>Ручные значения</summary>
        <div className="manual-grid">
          {KEYS.map((key) => (
            <label key={key}>
              {key.toUpperCase()}
              {build.overrides[key] !== undefined ? " · вручную" : ""}
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
        <button type="button" className="preset-btn" onClick={() => onChange({ ...build, overrides: {} })}>
          Сбросить
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
    <div className="page tool-page damage-page">
      <div className="tool-heading">
        <div>
          <Link to="/tools">← Инструменты</Link>
          <h1>Калькулятор урона</h1>
        </div>
        <button
          type="button"
          className="damage-swap"
          onClick={() => {
            setAttacker(defender);
            setDefender(attacker);
            setAbilityId("");
          }}
        >
          Поменять стороны
        </button>
      </div>
      <div className="damage-arena">
        <ProfileEditor
          title="Атакует"
          build={attacker}
          onChange={setAttacker}
        />
        <section className="damage-center">
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
          <div className="skill-toggles">
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
          </div>
          {resolved && (
            <p className="skill-meta">
              AP {resolved.ap ?? "не указан"} · {resolved.hits ?? "?"} удар(ов) ·
              точность{" "}
              {resolved.accuracyPercent === null
                ? "не указана"
                : `${resolved.accuracyPercent}%`}
              {ability?.descriptionEn ? `. ${ability.descriptionEn}` : ""}
              {enchanted && ability?.enchantDescriptionEn
                ? ` ${ability.enchantDescriptionEn}`
                : ""}
            </p>
          )}
          {(loadError || error) && (
            <p className="danger-text" role="alert">
              {loadError || error}
            </p>
          )}
          {result && (
            <section className="damage-result-card" aria-live="polite">
              <p className="eyebrow">Прямой урон</p>
              <strong>
                {result.min}–{result.max}
              </strong>
              <p>
                Середина {result.midpoint} · стихии ×{result.multiplier}
              </p>
              <p>
                До KO: {result.koMinHits ?? "—"}–{result.koGuaranteedHits ?? "—"}{" "}
                приёмов
              </p>
              {result.partial && (
                <p className="danger-text">
                  Посчитан только прямой удар. Доп. эффекты не учтены.
                </p>
              )}
              {[...attacker.relicIds, ...defender.relicIds].some(
                (id) =>
                  relics.find((item) => item.id === id)?.specialEffectsText
                    .length,
              ) && <p>Спецэффекты реликвий не учтены.</p>}
              <small>Без промахов, критов, щитов и лечения</small>
            </section>
          )}
        </section>
        <ProfileEditor
          title="Цель"
          build={defender}
          onChange={setDefender}
        />
      </div>
    </div>
  );
}
