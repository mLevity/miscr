import { Select, Checkbox } from '../../ui/controls';
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useT } from "../../i18n/Language";
import { Disclaimer } from "./Disclaimer";
import { families, familyById } from "../../data/static";
import {
  KEYS,
  bonusTotal,
  rebonusPrice,
  rebonusProbabilities,
  seededRandom,
  type Stat,
} from "../../domain/calculations/core";
import {
  decide,
  generate,
  initialSession,
} from "../../domain/calculations/session";
import type { BatchRequest, BatchResult } from "../../workers/rebonus.worker";

export default function Rebonus() {
  const { t } = useT();
  const [params] = useSearchParams();
  const [familyId, setFamilyId] = useState(
    familyById.has(params.get("family") || "")
      ? params.get("family")!
      : "miscrit:1",
  );
  const [session, setSession] = useState(initialSession);
  const [deprioritized, setDeprioritized] = useState<Stat[]>([]);
  const [seed, setSeed] = useState(42);
  const [error, setError] = useState("");
  const [count, setCount] = useState(10000);
  const [goals, setGoals] = useState<BatchRequest["goals"]>(
    () =>
      Object.fromEntries(
        KEYS.map((key) => [key, { min: 1, max: 136 }]),
      ) as BatchRequest["goals"],
  );
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState("");
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  rebonusProbabilities(deprioritized);
  let price: number | null = null,
    inputError = "";
  try {
    price = rebonusPrice(session.current, deprioritized.length);
  } catch (e) {
    inputError = (e as Error).message;
  }
  const roll = () => {
    try {
      seededRandom(seed);
      setSession(
        generate(
          session,
          deprioritized,
          seededRandom((seed + session.attempts) >>> 0),
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const cancel = () => {
    worker.current?.terminate();
    worker.current = null;
    setProgress(null);
    setBatch(null);
    setBatchStatus(
      "Серия отменена. Частичный прогон не сохранён как завершённый.",
    );
  };
  const runBatch = () => {
    try {
      seededRandom(seed);
      worker.current?.terminate();
      const instance = new Worker(
        new URL("../../workers/rebonus.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = instance;
      setBatch(null);
      setProgress(0);
      setBatchStatus("");
      instance.onmessage = (event) => {
        if (worker.current !== instance) return;
        const response = event.data;
        if (response.kind === "progress") setProgress(response.completed);
        else {
          setProgress(null);
          if (response.kind === "complete") {
            setBatch(response);
            setBatchStatus("Серия завершена.");
          } else setBatchStatus(response.message);
          instance.terminate();
          worker.current = null;
        }
      };
      instance.onerror = () => {
        setBatchStatus("Не удалось выполнить серию.");
        setProgress(null);
        instance.terminate();
        worker.current = null;
      };
      instance.postMessage({
        count,
        seed,
        deprioritized,
        goals,
      } satisfies BatchRequest);
    } catch (e) {
      setBatchStatus((e as Error).message);
    }
  };
  const candidate = session.candidate;
  return (
    <div className="tool-page">
      <Link to="/tools">{t("tools.back")}</Link>
      <h1>Симулятор ребонуса</h1>
      <Disclaimer>{t("rebonus.disclaimer")}</Disclaimer>
      <section className="content-panel">
        <label className="field-label">
          Мискрит
          <Select
            value={familyId}
            disabled={!!candidate || progress !== null}
            onChange={(event) => setFamilyId(event.target.value)}
          >
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </label>
        <p>
          Пример начальных бонусов — 136 очков. Можно ввести свои значения,
          сумма не больше 136.
        </p>
        <p>
          Выберите до пяти статов с пониженной вероятностью. Хотя бы один стат
          должен остаться без понижения.
        </p>
        <div className="deprio-grid">
          {KEYS.map((key, index) => (
            <label key={key}>
              <Checkbox
                disabled={
                  !!candidate ||
                  progress !== null ||
                  (!deprioritized.includes(key) && deprioritized.length >= 5)
                }
                checked={deprioritized.includes(key)}
                onChange={() => {
                  setDeprioritized((current) =>
                    current.includes(key)
                      ? current.filter((item) => item !== key)
                      : [...current, key],
                  );
                  setBatch(null);
                }}
              />
              {key.toUpperCase()} ·{" "}
              {deprioritized.includes(key)
                ? t("rebonus.lower")
                : t("rebonus.normal")}
            </label>
          ))}
        </div>
        <small>
          {t("rebonus.weightHint")}
        </small>
        <div className="action-row">
          <label>
            Seed{" "}
            <input
              aria-label="Seed"
              type="number"
              min={0}
              max={4294967295}
              value={Number.isNaN(seed) ? "" : seed}
              disabled={!!candidate || progress !== null}
              onChange={(event) => setSeed(event.target.valueAsNumber)}
            />
          </label>
          <button
            className="primary-button"
            disabled={
              !!candidate ||
              !!inputError ||
              !Number.isInteger(seed) ||
              seed < 0 ||
              seed > 4294967295
            }
            onClick={roll}
          >
            Новая попытка
          </button>
        </div>
        <p aria-live="polite">
          Попыток: {session.attempts} · Потрачено в симуляции: {session.spent}{" "}
          platinum · Следующая стоимость: {price ?? "—"}.
        </p>
        {(error || inputError) && (
          <p className="danger-text" role="alert">
            {error || inputError}
          </p>
        )}
      </section>
      <div className="table-scroll content-panel">
        <table className="profile-table bonus-comparison">
          <thead>
            <tr>
              <th>Стат</th>
              <th>Текущее</th>
              <th>Новая попытка</th>
              <th>Разница</th>
            </tr>
          </thead>
          <tbody>
            {KEYS.map((key) => {
              const delta = candidate
                ? candidate.bonuses[key] - session.current[key]
                : null;
              return (
                <tr key={key}>
                  <th>{key.toUpperCase()}</th>
                  <td>
                    <input
                      aria-label={`Текущий бонус ${key.toUpperCase()}`}
                      type="number"
                      min={0}
                      max={136}
                      disabled={!!candidate}
                      value={
                        Number.isNaN(session.current[key])
                          ? ""
                          : session.current[key]
                      }
                      onChange={(event) =>
                        setSession({
                          ...session,
                          current: {
                            ...session.current,
                            [key]: event.target.valueAsNumber,
                          },
                        })
                      }
                    />
                  </td>
                  <td>{candidate?.bonuses[key] ?? "—"}</td>
                  <td>
                    {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Сумма</th>
              <td>
                {KEYS.reduce((sum, key) => sum + session.current[key], 0)}
              </td>
              <td>{candidate ? bonusTotal(candidate.bonuses) : "—"}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {candidate && (
        <div className="action-row">
          <button
            className="primary-button"
            onClick={() => setSession(decide(session, true))}
          >
            Принять
          </button>
          <button
            className="secondary-button"
            onClick={() => setSession(decide(session, false))}
          >
            Оставить текущее
          </button>
        </div>
      )}
      {session.history.length > 0 && (
        <details className="content-panel">
          <summary>
            История · последние {session.history.length} попыток
          </summary>
          <ol>
            {session.history.map((item) => (
              <li key={item.number}>
                №{item.number}:{" "}
                {item.decision === "accepted" ? "принята" : "отклонена"} ·{" "}
                {item.cost} platinum ·{" "}
                {KEYS.map(
                  (key) => `${key.toUpperCase()} ${item.bonuses[key]}`,
                ).join(" / ")}
              </li>
            ))}
          </ol>
        </details>
      )}
      <details className="content-panel batch-panel">
        <summary>Серия попыток и цель</summary>
        <p>
          Независимые попытки с постоянными правилами. Серия не меняет текущий
          профиль и расходы сессии.
        </p>
        <div className="tool-grid">
          {KEYS.map((key) => (
            <label key={key}>
              {key.toUpperCase()} · от / до
              <div className="goal-range">
                <input
                  aria-label={`${key} цель минимум`}
                  type="number"
                  min={1}
                  max={136}
                  disabled={progress !== null}
                  value={Number.isNaN(goals[key].min) ? "" : goals[key].min}
                  onChange={(event) => {
                    setGoals({
                      ...goals,
                      [key]: { ...goals[key], min: event.target.valueAsNumber },
                    });
                    setBatch(null);
                  }}
                />
                <input
                  aria-label={`${key} цель максимум`}
                  type="number"
                  min={1}
                  max={136}
                  disabled={progress !== null}
                  value={Number.isNaN(goals[key].max) ? "" : goals[key].max}
                  onChange={(event) => {
                    setGoals({
                      ...goals,
                      [key]: { ...goals[key], max: event.target.valueAsNumber },
                    });
                    setBatch(null);
                  }}
                />
              </div>
            </label>
          ))}
        </div>
        <div className="action-row">
          <label>
            Попытки
            <Select
              disabled={progress !== null}
              value={count}
              onChange={(event) => {
                setCount(Number(event.target.value));
                setBatch(null);
              }}
            >
              {[100, 1000, 10000, 100000].map((n) => (
                <option value={n} key={n}>
                  {n.toLocaleString("ru")}
                </option>
              ))}
            </Select>
          </label>
          {progress === null ? (
            <button className="primary-button" onClick={runBatch}>
              Запустить серию
            </button>
          ) : (
            <button onClick={cancel}>Отменить серию</button>
          )}
        </div>
        <p role="status">
          {progress !== null
            ? `Выполнено ${progress} из ${count}`
            : batchStatus}
        </p>
        {batch && (
          <>
            <h2>
              {batch.successes} из {batch.count} ·{" "}
              {(batch.interval.p * 100).toFixed(2)}%
            </h2>
            <p>
              95% интервал Уилсона: {(batch.interval.low * 100).toFixed(2)}–
              {(batch.interval.high * 100).toFixed(2)}%.{" "}
              {batch.successes === 0
                ? "Ноль наблюдений не означает невозможность цели."
                : `Оценка числа попыток до успеха: ${(1 / batch.interval.p).toFixed(1)}.`}
            </p>


            <div className="tool-grid">
              {KEYS.map((key) => (
                <details key={key}>
                  <summary>
                    {key.toUpperCase()} · среднее {batch.means[key].toFixed(2)}
                  </summary>
                  <div className="histogram">
                    {batch.histograms[key].map((frequency, value) =>
                      frequency ? (
                        <div
                          key={value}
                          style={{ gridTemplateColumns: "28px 1fr 55px" }}
                        >
                          <span>{value}</span>
                          <meter
                            min={0}
                            max={Math.max(...batch.histograms[key])}
                            value={frequency}
                          />
                          <span>{frequency}</span>
                        </div>
                      ) : null,
                    )}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </details>
    </div>
  );
}
