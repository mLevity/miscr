import { useState } from "react";
import { Link } from "react-router-dom";
import { collections, familyById, families } from "../data/static";
import { isCaught } from "../domain/collection/profile";
import { useProfile } from "../storage/profile";
import { assetsForFormId } from "../ui/assets";
import { FamilyCard } from "../ui/common";

function questFace(familyId: string) {
  const family = familyById.get(familyId);
  const formId = family?.formIds[0];
  if (!formId) return "";
  return assetsForFormId(formId)?.avatarPath || assetsForFormId(formId)?.battlePath || "";
}

export default function Collection() {
  const { entries, claims, toggleQuest } = useProfile();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(24);
  const caught = families
    .filter((f) => isCaught(entries[f.id]))
    .sort((a, b) =>
      (entries[b.id]?.updatedAt || "").localeCompare(
        entries[a.id]?.updatedAt || "",
      ),
    );
  const doneCount = collections.filter((item) => claims[item.id]?.rewardClaimed).length;
  return (
    <div className="page collection-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Личный прогресс</p>
          <h1>Моя коллекция</h1>
          <Link to="/settings">Экспорт и импорт данных →</Link>
        </div>
        <div className="collection-progress">
          <strong>{caught.length}</strong>
          <span>из {families.length} семейств поймано</span>
          <div className="progress-bar">
            <i style={{ width: `${(caught.length / families.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <section className="collection-section">
        <h2>Пойманные семейства</h2>
        {caught.length ? (
          <>
            <div className="family-grid">
              {caught.slice(0, visible).map((f) => (
                <FamilyCard family={f} key={f.id} />
              ))}
            </div>
            {visible < caught.length && (
              <button className="load-more" onClick={() => setVisible(visible + 24)}>
                Показать ещё
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p>Пока нет отметок поимки.</p>
            <Link className="primary-button" to="/">
              Найти мискрита
            </Link>
          </div>
        )}
      </section>
      <section className="collection-section">
        <h2>
          Коллекционер · {doneCount} / {collections.length}
        </h2>
        <label className="field-label">
          Поиск квеста
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="set-grid">
          {collections
            .filter((c) =>
              `${c.name} ${c.sourceGroup}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((c) => {
              const done = !!claims[c.id]?.rewardClaimed;
              return (
                <article
                  className={`quest-card ${done ? "done" : ""}`}
                  key={c.id}
                >
                  <div className="quest-card-top">
                    <div>
                      <strong>{c.name}</strong>
                      <span>
                        {c.sourceGroup}
                        {c.rewards.length
                          ? ` · ${c.rewards.map((item) => `${item.quantity}× ${item.name}`).join(", ")}`
                          : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`quest-toggle ${done ? "is-done" : ""}`}
                      aria-pressed={done}
                      onClick={() => toggleQuest(c.id)}
                    >
                      {done ? "Выполнен" : "Не выполнен"}
                    </button>
                  </div>
                  <div className="quest-faces" aria-label="Участники квеста">
                    {c.requirements.map((req, index) => {
                      const family = familyById.get(req.familyId);
                      const face = questFace(req.familyId);
                      return face ? (
                        <Link
                          key={`${req.familyId}-${index}`}
                          to={`/miscrits/${family?.slug || ""}`}
                          title={req.sourceName}
                        >
                          <img src={face} alt={req.sourceName} />
                        </Link>
                      ) : (
                        <span
                          key={`${req.familyId}-${index}`}
                          className="quest-face-empty"
                          title={req.sourceName}
                        />
                      );
                    })}
                  </div>
                </article>
              );
            })}
        </div>
      </section>
    </div>
  );
}
