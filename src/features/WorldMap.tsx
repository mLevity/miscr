import { Select, Checkbox } from '../ui/controls';
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  areaById,
  familyById,
  locationById,
  locations,
  maps,
  markerById,
  spawns,
} from "../data/static";
import { dayNames, Icon } from "../ui/common";
import { useProfile } from "../storage/profile";

const todayUTC = () => ((new Date().getUTCDay() + 6) % 7) + 1;
export default function WorldMap() {
  const [params, setParams] = useSearchParams();
  const [day, setDay] = useState<number | null>(todayUTC());
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selected, setSelected] = useState(params.get("family") || "");
  const [zoom, setZoom] = useState(1);
  const [showList, setShowList] = useState(true);
  const { entries, patch } = useProfile();
  const locationId = locationById.has(params.get("location") || "")
    ? params.get("location")!
    : "location:forest";
  const location = locationById.get(locationId)!;
  const map = maps.find((item) => item.locationId === locationId);
  const filtered = useMemo(
    () =>
      spawns.filter(
        (item) =>
          item.locationId === locationId &&
          (day === null || item.schedule.weekdays?.includes(day)) &&
          (!onlyMissing || !entries[item.familyId]?.everCaught),
      ),
    [locationId, day, onlyMissing, entries],
  );
  const visibleMarkers = useMemo(
    () =>
      Array.from(new Set(filtered.flatMap((item) => item.markerIds)))
        .map((id) => markerById.get(id))
        .filter(
          (item): item is NonNullable<typeof item> =>
            !!item && item.mapId === map?.id,
        ),
    [filtered, map?.id],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const key = item.areaId || "unknown";
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return groups;
  }, [filtered]);
  const changeLocation = (id: string) => {
    setParams(new URLSearchParams({ location: id }));
    setSelected("");
    setZoom(1);
  };
  const selectFamily = (id: string) => {
    setSelected(id);
    const next = new URLSearchParams(params);
    next.set("location", locationId);
    next.set("family", id);
    setParams(next, { replace: true });
  };
  const familiesCount = new Set(filtered.map((item) => item.familyId)).size;
  return (
    <div className="page map-page">
      <div className="map-heading">
        <div>
          <p className="eyebrow">Мир мискритов</p>
          <h1>Карта мира</h1>
          <p className="muted">
            {familiesCount} мискритов · {filtered.length} мест появления ·
            расписание UTC
          </p>
        </div>
        <div className="map-controls">
          <label>
            Локация
            <Select
              value={locationId}
              onChange={(event) => changeLocation(event.target.value)}
            >
              {locations
                .filter((item) => item.mapId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            День
            <Select
              value={day ?? ""}
              onChange={(event) =>
                setDay(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Все дни</option>
              {dayNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                  {index + 1 === todayUTC() ? " · сегодня" : ""}
                </option>
              ))}
            </Select>
          </label>
          <label className="checkbox-line">
            <Checkbox
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
            />
            Не пойманы
          </label>
        </div>
      </div>
      <div className="map-workspace">
        <div className={`map-results ${showList ? "" : "collapsed"}`}>
          <div className="map-list-heading">
            <h2>{location.name}</h2>
            <button
              className="icon-button"
              aria-label={showList ? "Свернуть список" : "Открыть список"}
              onClick={() => setShowList(!showList)}
            >
              <Icon name="chevron" />
            </button>
          </div>
          {showList && (
            <div className="map-result-scroll">
              {filtered.length === 0 ? (
                <p className="muted">По выбранным условиям нет записей.</p>
              ) : (
                Array.from(grouped.entries()).map(([areaId, items]) => (
                  <section key={areaId}>
                    <h3>{areaById.get(areaId)?.name || "Зона не указана"}</h3>
                    {items.map((item) => {
                      const family = familyById.get(item.familyId);
                      if (!family) return null;
                      return (
                        <article
                          className={`map-result ${selected === family.id ? "selected" : ""}`}
                          key={item.id}
                        >
                          <button
                            className="map-result-name"
                            onClick={() => selectFamily(family.id)}
                          >
                            <strong>{family.name}</strong>
                            <small>
                              {item.markerIds.length
                                ? `${item.markerIds.length} точек`
                                : "Точная точка не указана"}
                            </small>
                          </button>
                          <button
                            className="small-catch"
                            onClick={() =>
                              patch(family.id, {
                                everCaught: !entries[family.id]?.everCaught,
                              })
                            }
                          >
                            {entries[family.id]?.everCaught
                              ? "✓ Пойман"
                              : "Пойман?"}
                          </button>
                          <Link
                            to={`/miscrits/${family.slug}`}
                            aria-label={`Карточка ${family.name}`}
                          >
                            →
                          </Link>
                        </article>
                      );
                    })}
                  </section>
                ))
              )}
            </div>
          )}
        </div>
        <div className="map-stage">
          <div className="map-stage-toolbar">
            <span>Карта: обзорная копия</span>
            <div>
              <button
                className="icon-button"
                onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                aria-label="Уменьшить карту"
              >
                <Icon name="minus" />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                className="icon-button"
                onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                aria-label="Увеличить карту"
              >
                <Icon name="plus" />
              </button>
              <button className="text-button" onClick={() => setZoom(1)}>
                Сброс
              </button>
            </div>
          </div>
          {map ? (
            <div className="map-scroll">
              <div
                className="map-image-wrap"
                style={{
                  width: `${zoom * 100}%`,
                  aspectRatio: `${map.width}/${map.height}`,
                }}
              >
                <img
                  src={`/${map.image}`}
                  alt={`Карта ${location.name}`}
                  className="map-image"
                />
                {visibleMarkers.map((marker) => {
                  const family = familyById.get(marker.familyId);
                  return (
                    <button
                      key={marker.id}
                      className={`map-marker ${selected === marker.familyId ? "selected" : ""}`}
                      style={{
                        left: `${marker.x * 100}%`,
                        top: `${marker.y * 100}%`,
                      }}
                      aria-label={`${family?.name || marker.familyId}, точка на карте`}
                      title={family?.name}
                      onClick={() => selectFamily(marker.familyId)}
                    >
                      <span />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Изображение карты не предоставлено
            </div>
          )}
          {selected && familyById.get(selected) && (
            <div className="map-selected">
              <strong>{familyById.get(selected)?.name}</strong>
              <span>
                {
                  visibleMarkers.filter(
                    (marker) => marker.familyId === selected,
                  ).length
                }{" "}
                точек на этой карте
              </span>
              <Link to={`/miscrits/${familyById.get(selected)?.slug}`}>
                Открыть карточку →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
