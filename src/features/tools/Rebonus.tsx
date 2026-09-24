import { Select, Checkbox } from '../../ui/controls';
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useT } from "../../i18n/Language";
import { Disclaimer } from "./Disclaimer";
import { FamilySearch } from "./FamilySearch";
import { familyById } from "../../data/static";
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
  const { t, lang } = useT();
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
    setBatchStatus(t("rebonus.batchCancel"));
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
            setBatchStatus(t("rebonus.batchDone"));
          } else
            setBatchStatus(
              response.message?.startsWith("rebonus.badGoal:")
                ? t("rebonus.badGoal", {
                    stat: response.message.split(":")[1],
                  })
                : response.message?.startsWith("rebonus.")
                  ? t(response.message)
                  : response.message,
            );
          instance.terminate();
          worker.current = null;
        }
      };
      instance.onerror = () => {
        setBatchStatus(t("rebonus.batchFail"));
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
      <h1>{t("rebonus.title")}</h1>
      <Disclaimer>{t("rebonus.disclaimer")}</Disclaimer>
      <section className="content-panel">
        <label className="field-label">
          {t("rebonus.miscrit")}
          <FamilySearch
            value={familyId}
            disabled={!!candidate || progress !== null}
            onChange={setFamilyId}
          />
        </label>
        <p>{t("rebonus.startHint")}</p>
        <p>{t("rebonus.deprioHint")}</p>
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
            {t("rebonus.roll")}
          </button>
        </div>
        <p aria-live="polite">
          {t("rebonus.session", { n: session.attempts, spent: session.spent, price: price ?? "—" })}
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
              <th>{t("rebonus.stat")}</th>
              <th>{t("rebonus.current")}</th>
              <th>{t("rebonus.next")}</th>
              <th>{t("rebonus.delta")}</th>
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
                      aria-label={t("rebonus.currentAria", { stat: key.toUpperCase() })}
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
              <th>{t("rebonus.sum")}</th>
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
            {t("rebonus.accept")}
          </button>
          <button
            className="secondary-button"
            onClick={() => setSession(decide(session, false))}
          >
            {t("rebonus.keep")}
          </button>
        </div>
      )}
      {session.history.length > 0 && (
        <details className="content-panel">
          <summary>
            {t("rebonus.history", { n: session.history.length })}
          </summary>
          <ol>
            {session.history.map((item) => (
              <li key={item.number}>
                №{item.number}:{" "}
                {item.decision === "accepted" ? t("rebonus.accepted") : t("rebonus.rejected")} ·{" "}
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
        <summary>{t("rebonus.batch")}</summary>
        <p>{t("rebonus.batchHint")}</p>
        <div className="tool-grid">
          {KEYS.map((key) => (
            <label key={key}>
              {t("rebonus.range", { stat: key.toUpperCase() })}
              <div className="goal-range">
                <input
                  aria-label={t("rebonus.minAria", { stat: key })}
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
                  aria-label={t("rebonus.maxAria", { stat: key })}
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
            {t("rebonus.tries")}
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
                  {n.toLocaleString(lang === "ru" ? "ru-RU" : "en-US")}
                </option>
              ))}
            </Select>
          </label>
          {progress === null ? (
            <button className="primary-button" onClick={runBatch}>
              {t("rebonus.run")}
            </button>
          ) : (
            <button onClick={cancel}>{t("rebonus.cancel")}</button>
          )}
        </div>
        <p role="status">
          {progress !== null
            ? t("rebonus.progress", { done: progress, total: count })
            : batchStatus}
        </p>
        {batch && (
          <>
            <h2>
              {t("rebonus.of", { ok: batch.successes, total: batch.count })} ·{" "}
              {(batch.interval.p * 100).toFixed(2)}%
            </h2>
            <p>
              {t("rebonus.wilson", {
                low: (batch.interval.low * 100).toFixed(2),
                high: (batch.interval.high * 100).toFixed(2),
              })}{" "}
              {batch.successes === 0
                ? t("rebonus.zero")
                : t("rebonus.eta", {
                    n: (1 / batch.interval.p).toFixed(1),
                  })}
            </p>


            <div className="tool-grid">
              {KEYS.map((key) => (
                <details key={key}>
                  <summary>
                    {t("rebonus.mean", {
                      stat: key.toUpperCase(),
                      n: batch.means[key].toFixed(2),
                    })}
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
