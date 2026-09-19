import { Checkbox } from "../ui/controls";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  areaById,
  areas,
  familyById,
  locationById,
  locations,
  maps,
  markerById,
  spawns,
  type Family,
  type Marker,
  type Spawn,
} from "../data/static";
import { CatchActions, dayNames, elementNames, Icon, rarityNames } from "../ui/common";
import { isCaught } from "../domain/collection/profile";
import { assetsForFormId } from "../ui/assets";
import { useProfile } from "../storage/profile";
import {
  elementCombos,
  matchesElementFilter,
  normalize,
  rarities,
  searchMatch,
} from "../domain/catalog/filter";

const todayUTC = () => ((new Date().getUTCDay() + 6) % 7) + 1;
const worldLocations = locations.filter((item) => item.mapId);
const MIN_SCALE = 1;
const MAX_SCALE = 3.2;

function formatDays(weekdays: number[] | null | undefined) {
  if (!weekdays?.length) return "Дни неизвестны";
  const unique = [...new Set(weekdays)].sort((a, b) => a - b);
  if (unique.length === 7) return "Все дни";
  return unique.map((value) => dayNames[value - 1]).join(", ");
}
function spawnPlace(item: Spawn) {
  const area = item.areaId ? areaById.get(item.areaId)?.name : "";
  return [area || "Зона не указана", formatDays(item.schedule.weekdays)]
    .filter(Boolean)
    .join(" · ");
}
function familyAvatar(family?: Family) {
  const formId = family?.formIds[0];
  if (!formId) return "";
  return (
    assetsForFormId(formId)?.avatarPath ||
    assetsForFormId(formId)?.battlePath ||
    ""
  );
}

function clusterMarkers(
  items: Marker[],
  width: number,
  height: number,
  scale: number,
  gap = 40,
) {
  const groups: { x: number; y: number; items: Marker[] }[] = [];
  const limit = gap / Math.max(scale, 0.001);
  for (const marker of items) {
    const px = marker.x * width;
    const py = marker.y * height;
    const hit = groups.find((group) => {
      const dx = group.x * width - px;
      const dy = group.y * height - py;
      return Math.hypot(dx, dy) <= limit;
    });
    if (hit) hit.items.push(marker);
    else groups.push({ x: marker.x, y: marker.y, items: [marker] });
  }
  return groups.map((group) => ({
    ...group,
    x: group.items.reduce((sum, item) => sum + item.x, 0) / group.items.length,
    y: group.items.reduce((sum, item) => sum + item.y, 0) / group.items.length,
  }));
}

export default function WorldMap() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [day, setDay] = useState<number | "always" | null>(() => {
    const raw = params.get("day");
    if (raw === "any" || raw === "all") return null;
    if (raw === "always") return "always";
    if (raw && Number(raw) >= 1 && Number(raw) <= 7) return Number(raw);
    return todayUTC();
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [caught, setCaught] = useState<"all" | "caught" | "missing">(
    (params.get("caught") as "all" | "caught" | "missing") || "all",
  );
  const [elementFilter, setElementFilter] = useState<string[]>(() =>
    (params.get("element") || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => elementCombos.includes(item)),
  );
  const [rarityFilter, setRarityFilter] = useState(params.get("rarity") || "");
  const [areaFilter, setAreaFilter] = useState(params.get("area") || "");
  const [selected, setSelected] = useState(params.get("family") || "");
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const { entries, patch } = useProfile();
  const rawLocation = params.get("location") || "";
  const allLocations = rawLocation === "all";
  const [mapFocus, setMapFocus] = useState("location:forest");
  const locationId = locationById.has(rawLocation)
    ? rawLocation
    : allLocations
      ? mapFocus
      : "location:forest";
  const location = locationById.get(locationId)!;
  const map = maps.find((item) => item.locationId === locationId);
  const locationAreas = useMemo(
    () =>
      allLocations ? [] : areas.filter((item) => item.locationId === locationId),
    [locationId, allLocations],
  );
  const filtered = useMemo(() => {
    const needle = normalize(query);
    return spawns.filter((item) => {
      if (!allLocations && item.locationId !== locationId) return false;
      if (areaFilter && item.areaId !== areaFilter) return false;
      if (day === "always") {
        if ([...new Set(item.schedule.weekdays || [])].length !== 7)
          return false;
      } else if (day !== null && !item.schedule.weekdays?.includes(day))
        return false;
      const family = familyById.get(item.familyId);
      if (!family) return false;
      if (!matchesElementFilter(family.elements, elementFilter)) return false;
      if (rarityFilter && family.rarity !== rarityFilter) return false;
      if (caught === "missing" && isCaught(entries[item.familyId]))
        return false;
      if (caught === "caught" && !isCaught(entries[item.familyId]))
        return false;
      if (needle && !searchMatch(family, query)) return false;
      return true;
    });
  }, [locationId, allLocations, areaFilter, day, caught, elementFilter, rarityFilter, query, entries]);
  const visibleMarkers = useMemo(
    () =>
      Array.from(new Set(filtered.flatMap((item) => item.markerIds)))
        .map((id) => markerById.get(id))
        .filter(
          (item): item is Marker => !!item && item.mapId === map?.id,
        ),
    [filtered, map?.id],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, Spawn[]>();
    for (const item of filtered) {
      const key = item.areaId || "unknown";
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return groups;
  }, [filtered]);
  const writeParams = (next: {
    location?: string;
    family?: string;
    area?: string;
    day?: number | "always" | null;
    caught?: string;
    element?: string[];
    rarity?: string;
    q?: string;
  }) => {
    const search = new URLSearchParams();
    search.set(
      "location",
      next.location ?? (allLocations ? "all" : locationId),
    );
    const family = next.family ?? selected;
    if (family) search.set("family", family);
    const area = next.area ?? areaFilter;
    if (area) search.set("area", area);
    const nextDay = next.day === undefined ? day : next.day;
    if (nextDay === null) search.set("day", "any");
    else if (nextDay === "always") search.set("day", "always");
    else if (nextDay) search.set("day", String(nextDay));
    const nextCaught = next.caught ?? caught;
    if (nextCaught !== "all") search.set("caught", nextCaught);
    const nextElement = next.element === undefined ? elementFilter : next.element;
    if (nextElement.length) search.set("element", nextElement.join(","));
    const nextRarity = next.rarity === undefined ? rarityFilter : next.rarity;
    if (nextRarity) search.set("rarity", nextRarity);
    const nextQuery = next.q === undefined ? query : next.q;
    if (nextQuery) search.set("q", nextQuery);
    setParams(search, { replace: true });
  };
  const changeLocation = (id: string) => {
    setSelected("");
    setAreaFilter("");
    setOpenCluster(null);
    if (id !== "all") setMapFocus(id);
    writeParams({ location: id, family: "", area: "" });
  };
  const selectFamily = (id: string, spawnLocation?: string) => {
    setSelected(id);
    setOpenCluster(null);
    if (allLocations && spawnLocation) setMapFocus(spawnLocation);
    writeParams({ family: id });
  };
  const selectedSpawns = filtered.filter((item) => item.familyId === selected);
  return (
    <div className="page map-page">
      <div className="map-heading">
        <div>
          <p className="eyebrow">Мир мискритов</p>
          <h1>Карта мира</h1>
        </div>
      </div>
      <div className="map-filters">
        <div className="map-filter-bar">
          <label className="search-box map-search">
            <Icon name="search" />
            <span className="sr-only">Поиск на карте</span>
            <input
              type="search"
              placeholder="Имя мискрита"
              value={query}
              onChange={(event) => {
                const value = event.target.value.slice(0, 120);
                setQuery(value);
                writeParams({ q: value });
              }}
            />
          </label>
          <button
            type="button"
            className={`map-filter-toggle ${filtersOpen ? "open" : ""}`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Фильтры
          </button>
        </div>
        {filtersOpen && (
          <div className="map-filter-panel">
            <div className="map-chip-row" role="listbox" aria-label="Локация">
              <button
                type="button"
                className={`map-chip ${allLocations ? "active" : ""}`}
                aria-pressed={allLocations}
                onClick={() => changeLocation("all")}
              >
                Все локации
              </button>
              {worldLocations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`map-chip ${!allLocations && item.id === locationId ? "active" : ""}`}
                  aria-pressed={!allLocations && item.id === locationId}
                  onClick={() => changeLocation(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            {locationAreas.length > 1 && (
              <div className="map-chip-row" aria-label="Зона">
                <button
                  type="button"
                  className={`map-chip ${areaFilter === "" ? "active" : ""}`}
                  onClick={() => {
                    setAreaFilter("");
                    writeParams({ area: "" });
                  }}
                >
                  Все зоны
                </button>
                {locationAreas.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`map-chip ${areaFilter === item.id ? "active" : ""}`}
                    onClick={() => {
                      setAreaFilter(item.id);
                      writeParams({ area: item.id });
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            <div className="map-chip-row" aria-label="День недели UTC">
              <button
                type="button"
                className={`map-chip ${day === null ? "active" : ""}`}
                onClick={() => {
                  setDay(null);
                  writeParams({ day: null });
                }}
              >
                Любой день
              </button>
              <button
                type="button"
                className={`map-chip ${day === "always" ? "active" : ""}`}
                onClick={() => {
                  setDay("always");
                  writeParams({ day: "always" });
                }}
              >
                Все дни
              </button>
              {dayNames.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  className={`map-chip ${day === index + 1 ? "active" : ""}`}
                  onClick={() => {
                    setDay(index + 1);
                    writeParams({ day: index + 1 });
                  }}
                >
                  {name}
                  {index + 1 === todayUTC() ? " · сегодня" : ""}
                </button>
              ))}
            </div>
            <div className="map-chip-row">
              {(
                [
                  ["all", "Все"],
                  ["missing", "Не пойманы"],
                  ["caught", "Пойманы"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`map-chip ${caught === value ? "active" : ""}`}
                  onClick={() => {
                    setCaught(value);
                    writeParams({ caught: value });
                  }}
                >
                  {label}
                </button>
              ))}
              {rarities.map((rarity) => (
                <button
                  key={rarity}
                  type="button"
                  className={`map-chip rarity-${rarity} ${rarityFilter === rarity ? "active" : ""}`}
                  onClick={() => {
                    const next = rarityFilter === rarity ? "" : rarity;
                    setRarityFilter(next);
                    writeParams({ rarity: next });
                  }}
                >
                  {rarityNames[rarity] || rarity}
                </button>
              ))}
            </div>
            <div className="map-chip-row" aria-label="Стихии">
              {elementCombos.map((element) => (
                <button
                  key={element}
                  type="button"
                  className={`map-chip map-chip-element ${elementFilter.includes(element) ? "active" : ""}`}
                  title={elementNames[element] || element}
                  aria-label={elementNames[element] || element}
                  aria-pressed={elementFilter.includes(element)}
                  onClick={() => {
                    const next = elementFilter.includes(element)
                      ? elementFilter.filter((item) => item !== element)
                      : [...elementFilter, element];
                    setElementFilter(next);
                    writeParams({ element: next });
                  }}
                >
                  <img src={`/assets/filters/elements/${element}.png`} alt="" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="map-workspace">
        <div className={`map-results ${showList ? "" : "collapsed"}`}>
          <div className="map-list-heading">
            <h2>{allLocations ? "Все локации" : location.name}</h2>
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
                    <h3>
                      {allLocations
                        ? [
                            locationById.get(items[0]?.locationId || "")?.name,
                            areaById.get(areaId)?.name,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Зона не указана"
                        : areaById.get(areaId)?.name || "Зона не указана"}
                    </h3>
                    {items.map((item) => {
                      const family = familyById.get(item.familyId);
                      if (!family) return null;
                      const avatar = familyAvatar(family);
                      return (
                        <article
                          className={`map-result ${selected === family.id ? "selected" : ""}`}
                          key={item.id}
                        >
                          <button
                            className="map-result-name"
                            onClick={() => selectFamily(family.id, item.locationId)}
                          >
                            {avatar ? (
                              <img src={avatar} alt="" className="map-list-avatar" />
                            ) : (
                              <span className="map-list-avatar fallback" />
                            )}
                            <span>
                              <strong>{family.name}</strong>
                              <small>{spawnPlace(item)}</small>
                            </span>
                          </button>
                          <CatchActions family={family} />
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
        <MapStage
          map={map}
          locationName={location.name}
          markers={visibleMarkers}
          selected={selected}
          openCluster={openCluster}
          onOpenCluster={setOpenCluster}
          onSelect={selectFamily}
          onCaught={(id) =>
            patch(id, { everCaught: !entries[id]?.everCaught })
          }
          caughtIds={entries}
          selectedSpawns={selectedSpawns}
        />
      </div>
    </div>
  );
}

function MapStage({
  map,
  locationName,
  markers,
  selected,
  openCluster,
  onOpenCluster,
  onSelect,
  onCaught,
  caughtIds,
  selectedSpawns,
}: {
  map: { image: string; width: number; height: number } | undefined;
  locationName: string;
  markers: Marker[];
  selected: string;
  openCluster: string | null;
  onOpenCluster: (id: string | null) => void;
  onSelect: (id: string) => void;
  onCaught: (id: string) => void;
  caughtIds: Record<string, { everCaught?: boolean } | undefined>;
  selectedSpawns: Spawn[];
}) {
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({
    scale: 1,
    panX: 0,
    panY: 0,
    baseW: 0,
    baseH: 0,
  });
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const panned = useRef(false);
  const fit = () => {
    if (!map || !stage.current) return;
    const availW = Math.max(160, stage.current.clientWidth);
    const availH = Math.max(
      220,
      Math.min(Math.round(window.innerHeight * 0.68), 760),
    );
    const ratio = Math.min(availW / map.width, availH / map.height);
    const baseW = Math.max(1, map.width * ratio);
    const baseH = Math.max(1, map.height * ratio);
    setView({
      scale: 1,
      panX: 0,
      panY: 0,
      baseW,
      baseH,
    });
  };
  useEffect(() => {
    fit();
    const host = stage.current;
    if (!host) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(host);
    window.addEventListener("resize", fit);
    const wheel = (event: WheelEvent) => {
      const frame = viewport.current;
      if (!frame) return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.11;
      const rect = frame.getBoundingClientRect();
      setView((current) => {
        const scale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, current.scale * factor),
        );
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const worldX = (x - current.panX) / current.scale;
        const worldY = (y - current.panY) / current.scale;
        const edge = 80;
        const w = current.baseW * scale;
        const h = current.baseH * scale;
        const minX = edge - w;
        const maxX = frame.clientWidth - edge;
        const minY = edge - h;
        const maxY = frame.clientHeight - edge;
        return {
          ...current,
          scale,
          panX: Math.min(maxX, Math.max(minX, x - worldX * scale)),
          panY: Math.min(maxY, Math.max(minY, y - worldY * scale)),
        };
      });
    };
    viewport.current?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      viewport.current?.removeEventListener("wheel", wheel);
    };
  }, [map?.image, map?.width, map?.height]);
  const clampPan = (
    scale: number,
    panX: number,
    panY: number,
    baseW = view.baseW,
    baseH = view.baseH,
  ) => {
    const box = viewport.current;
    if (!box) return { panX, panY };
    const edge = 80;
    const w = baseW * scale;
    const h = baseH * scale;
    return {
      panX: Math.min(box.clientWidth - edge, Math.max(edge - w, panX)),
      panY: Math.min(box.clientHeight - edge, Math.max(edge - h, panY)),
    };
  };
  const zoomAt = (clientX: number, clientY: number, nextScale: number) => {
    const box = viewport.current;
    if (!box) return;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    const rect = box.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const worldX = (x - view.panX) / view.scale;
    const worldY = (y - view.panY) / view.scale;
    const pan = clampPan(scale, x - worldX * scale, y - worldY * scale);
    setView((current) => ({ ...current, scale, ...pan }));
  };
  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    panned.current = false;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: view.panX,
      panY: view.panY,
      moved: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (Math.hypot(dx, dy) > 3) {
      active.moved = true;
      panned.current = true;
    }
    if (!active.moved) return;
    event.preventDefault();
    const pan = clampPan(view.scale, active.panX + dx, active.panY + dy);
    setView((current) => ({ ...current, ...pan }));
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const active = drag.current;
    if (active && !active.moved) onOpenCluster(null);
    drag.current = null;
    const node = event.currentTarget as HTMLElement;
    if (node.hasPointerCapture(event.pointerId))
      node.releasePointerCapture(event.pointerId);
  };
  const clusters = useMemo(
    () =>
      view.baseW
        ? clusterMarkers(markers, view.baseW, view.baseH, view.scale)
        : [],
    [markers, view.baseW, view.baseH, view.scale],
  );
  const selectedFamily = familyById.get(selected);
  const selectedCount = markers.filter((item) => item.familyId === selected)
    .length;
  const focusSelected = () => {
    if (!selectedFamily || !view.baseW) return;
    const point = markers.find((item) => item.familyId === selected);
    if (!point || !viewport.current) return;
    const scale = Math.min(MAX_SCALE, Math.max(1.6, view.scale));
    const x = point.x * view.baseW * scale;
    const y = point.y * view.baseH * scale;
    const pan = clampPan(
      scale,
      viewport.current.clientWidth / 2 - x,
      viewport.current.clientHeight / 2 - y,
    );
    setView((current) => ({ ...current, scale, ...pan }));
  };
  return (
    <div className="map-stage" ref={stage}>
      <div className="map-stage-toolbar">
        <span>
          {map
            ? `${locationName} · ${map.width}×${map.height}`
            : "Карта не приложена"}
        </span>
        <div>
          <button
            className="icon-button"
            onClick={() => {
              const box = viewport.current?.getBoundingClientRect();
              if (!box) return;
              zoomAt(box.left + box.width / 2, box.top + box.height / 2, view.scale / 1.2);
            }}
            aria-label="Уменьшить карту"
          >
            <Icon name="minus" />
          </button>
          <span>{Math.round(view.scale * 100)}%</span>
          <button
            className="icon-button"
            onClick={() => {
              const box = viewport.current?.getBoundingClientRect();
              if (!box) return;
              zoomAt(box.left + box.width / 2, box.top + box.height / 2, view.scale * 1.2);
            }}
            aria-label="Увеличить карту"
          >
            <Icon name="plus" />
          </button>
          <button className="text-button" onClick={fit}>
            Вписать
          </button>
          {selected && (
            <button className="text-button" onClick={focusSelected}>
              К выбранному
            </button>
          )}
        </div>
      </div>
      {map ? (
        <div
          className="map-viewport"
          ref={viewport}
          style={{ width: view.baseW, height: view.baseH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="map-world"
            style={{
              width: view.baseW,
              height: view.baseH,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})`,
            }}
          >
            <img
              src={`/${map.image}`}
              alt={`Карта ${locationName}`}
              className="map-image"
              width={map.width}
              height={map.height}
              draggable={false}
            />
          </div>
          {markers.map((marker, index) => {
            const family = familyById.get(marker.familyId);
            const avatar = familyAvatar(family);
            const twins = markers.filter(
              (item) =>
                Math.abs(item.x - marker.x) < 0.004 &&
                Math.abs(item.y - marker.y) < 0.004,
            );
            const offset = twins.findIndex((item) => item.id === marker.id);
            const shift = twins.length > 1 ? (offset - (twins.length - 1) / 2) * 10 : 0;
            const rarity = family?.rarity || "common";
            const left = view.panX + marker.x * view.baseW * view.scale + shift;
            const top = view.panY + marker.y * view.baseH * view.scale;
            return (
              <button
                key={marker.id}
                type="button"
                className={`map-pin rarity-${rarity} ${selected === marker.familyId ? "selected" : ""}`}
                style={{
                  left,
                  top,
                  zIndex: selected === marker.familyId ? 20 : 2 + index,
                }}
                aria-label={`${family?.name || marker.familyId}, точка на карте`}
                title={family?.name}
                onClick={(event) => {
                  event.stopPropagation();
                  if (panned.current) return;
                  onSelect(marker.familyId);
                }}
              >
                <span className="marker-icon">
                  {avatar ? (
                    <img src={avatar} alt="" className="marker-avatar" />
                  ) : (
                    <span className="map-pin-fallback" />
                  )}
                </span>
                <span className="marker-pointer" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">Изображение карты не предоставлено</div>
      )}
      {selectedFamily && (
        <div className="map-selected">
          {familyAvatar(selectedFamily) && (
            <img src={familyAvatar(selectedFamily)} alt="" />
          )}
          <strong>{selectedFamily.name}</strong>
          <span>
            {selectedSpawns.length
              ? selectedSpawns.map((item) => spawnPlace(item)).join(" · ")
              : selectedCount
                ? `${selectedCount} точек на этой карте`
                : "Место появления в этой локации не указано"}
          </span>
          <CatchActions family={selectedFamily} />
          <Link to={`/miscrits/${selectedFamily.slug}`}>Карточка →</Link>
        </div>
      )}
    </div>
  );
}
