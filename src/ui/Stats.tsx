import type { Family } from "../data/static";
import { rankKeys } from "../domain/catalog/filter";

export function statChunk(key: string) {
  return key === "ea" || key === "ed"
    ? "e"
    : key === "pa" || key === "pd"
      ? "p"
      : key;
}
export function Stats({ ranks }: { ranks: Family["baseRanks"] }) {
  return (
    <div className="species-stats">
      {rankKeys.map((key) => (
        <div className="species-stat" key={key}>
          <img
            className="stat-symbol"
            src={`/assets/filters/stats/${key}.png`}
            alt=""
          />
          <strong>{key.toUpperCase()}</strong>
          <div
            className="game-stat-bar"
            role="img"
            aria-label={`${key.toUpperCase()}: ${ranks[key]} из 5`}
            style={{
              backgroundImage: `url(/assets/filters/chunks/${statChunk(key)}_chunktainer.png)`,
            }}
          >
            {Array.from({ length: ranks[key] }, (_, i) => (
              <img
                key={i}
                alt=""
                src={`/assets/filters/chunks/${statChunk(key)}_chunk.png`}
                style={{ left: `${i * 19.402985}%` }}
              />
            ))}
          </div>
          <span className="stat-number" aria-hidden="true">
            {ranks[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
