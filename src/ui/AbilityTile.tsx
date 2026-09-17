import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Ability } from "../data/static";
import tags from "../data/generated/tags.json";

export function abilityIcon(ability: Ability): string {
  if (ability.kind === "attack")
    return ability.element === "misc" ? "physical" : ability.element;
  if (ability.kind === "dot")
    return ability.element === "misc" ? "poison" : `${ability.element}_poison`;
  if (ability.kind === "timebomb")
    return `bomb_${["fire", "water", "nature", "earth", "wind", "lightning"].includes(ability.element) ? ability.element : "fire"}`;
  return tags.find((tag) => tag.id === ability.kind)?.icon || "special";
}
export function AbilityTile({
  ability,
  enchanted,
}: {
  ability: Ability;
  enchanted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const positionTip = () => {
      const box = button.current!.getBoundingClientRect();
      const width = Math.min(330, window.innerWidth - 24);
      const height = tooltip.current?.getBoundingClientRect().height || 250;
      const right = box.right + 10;
      const leftSide = box.left - width - 10;
      const left =
        right + width <= window.innerWidth - 12
          ? right
          : leftSide >= 12
            ? leftSide
            : Math.max(12, Math.min(box.left, window.innerWidth - width - 12));
      const top = Math.max(
        12,
        Math.min(box.top, window.innerHeight - height - 12),
      );
      setPosition({ left, top });
    };
    positionTip();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (
        !button.current?.contains(event.target as Node) &&
        !tooltip.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("resize", positionTip);
    window.addEventListener("scroll", positionTip, true);
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", positionTip);
      window.removeEventListener("scroll", positionTip, true);
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  const ap =
    ability.ap === null
      ? null
      : ability.ap +
        (enchanted && typeof ability.enchant?.ap === "number"
          ? ability.enchant.ap
          : 0);
  const accuracy =
    ability.accuracyPercent === null
      ? null
      : ability.accuracyPercent +
        (enchanted && typeof ability.enchant?.accuracy === "number"
          ? ability.enchant.accuracy
          : 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 140);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <>
      <button
        ref={button}
        className="ability-tile"
        aria-label={ability.name}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
      >
        <img
          src={`/assets/filters/elements/${abilityIcon(ability)}.png`}
          alt=""
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            role="tooltip"
            className="ability-tooltip"
            style={position}
          >
            <strong>{ability.name}</strong>
            <p>{ability.descriptionEn || "Описание не указано"}</p>
            <dl>
              <div>
                <dt>AP</dt>
                <dd>{ap ?? "—"}</dd>
              </div>
              <div>
                <dt>Точность</dt>
                <dd>{accuracy === null ? "Не указана" : `${accuracy}%`}</dd>
              </div>
              <div>
                <dt>Удары</dt>
                <dd>{ability.hits ?? "—"}</dd>
              </div>
            </dl>
            {ability.tags.length > 0 && (
              <p className="ability-effects">
                {ability.tags
                  .map((id) => tags.find((t) => t.id === id)?.name || id)
                  .join(" · ")}
              </p>
            )}
            {ability.enchantDescriptionEn && (
              <p
                className={enchanted ? "enchant-active" : "enchant-description"}
              >
                <b>Зачарование:</b> {ability.enchantDescriptionEn}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
