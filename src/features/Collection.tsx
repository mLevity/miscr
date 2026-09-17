import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collections, familyById, formById, families } from "../data/static";
import { useProfile } from "../storage/profile";
import { Art, FamilyCard } from "../ui/common";
export default function Collection() {
  const { entries, patch } = useProfile();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(24);
  const caught = families
    .filter((f) => entries[f.id]?.everCaught && !entries[f.id]?.deletedAt)
    .sort((a, b) =>
      (entries[b.id]?.updatedAt || "").localeCompare(
        entries[a.id]?.updatedAt || "",
      ),
    );
  const activeSet = collections.find((c) => c.id === params.get("set"));
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
            <i
              style={{ width: `${(caught.length / families.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
      {activeSet ? (
        <div className="set-detail">
          <Link to="/collection">← Все коллекции</Link>
          <h2>{activeSet.name}</h2>
          <p>
            {
              activeSet.requirements.filter(
                (req) => entries[req.familyId]?.everCaught,
              ).length
            }{" "}
            / {activeSet.requirements.length} семейств поймано ·{" "}
            {activeSet.sourceGroup}
          </p>
          <div className="requirement-list">
            {activeSet.requirements.map((req, index) => {
              const family = familyById.get(req.familyId);
              if (!family)
                return (
                  <p key={index}>Неизвестный участник: {req.sourceName}</p>
                );
              const obtained = !!entries[family.id]?.everCaught;
              return (
                <article
                  className={`requirement ${obtained ? "caught" : ""}`}
                  key={`${req.familyId}-${index}`}
                >
                  <Art name={family.name} compact />
                  <div>
                    <Link to={`/miscrits/${family.slug}`}>
                      <strong>{req.sourceName}</strong>
                    </Link>
                    <span>
                      {req.formId
                        ? formById.get(req.formId)?.name
                        : "Любая форма"}{" "}
                      · требуется {req.quantity}
                    </span>
                  </div>
                  <button
                    onClick={() => patch(family.id, { everCaught: !obtained })}
                  >
                    {obtained ? "✓ Пойман" : "Пойман?"}
                  </button>
                </article>
              );
            })}
          </div>
          <section className="content-panel">
            <h2>Награда</h2>
            {activeSet.rewards.map((reward, index) => (
              <p key={index}>
                {reward.quantity} × {reward.name}
              </p>
            ))}
          </section>
        </div>
      ) : (
        <>
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
                  <button
                    className="load-more"
                    onClick={() => setVisible(visible + 24)}
                  >
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
            <h2>Игровые коллекции · {collections.length}</h2>
            <label className="field-label">
              Поиск игрового набора
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
                  const complete = c.requirements.filter(
                    (req) => entries[req.familyId]?.everCaught,
                  ).length;
                  return (
                    <Link
                      className="set-card"
                      key={c.id}
                      to={`/collection?set=${encodeURIComponent(c.id)}`}
                    >
                      <strong>{c.name}</strong>
                      <span>
                        {c.sourceGroup} · {complete} / {c.requirements.length}{" "}
                        поймано
                      </span>
                      <div className="progress-bar">
                        <i
                          style={{
                            width: `${(complete / c.requirements.length) * 100}%`,
                          }}
                        />
                      </div>
                    </Link>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
