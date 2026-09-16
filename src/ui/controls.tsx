import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

export function Popover({
  label,
  children,
  className = "",
  active = false,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [maxHeight, setMaxHeight] = useState(420);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const place = () =>
      setMaxHeight(
        Math.max(
          120,
          window.innerHeight -
            (trigger.current?.getBoundingClientRect().bottom || 0) -
            (window.innerWidth <= 900 ? 88 : 20),
        ),
      );
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return (
    <div
      ref={ref}
      className={`filter-popover ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`filter-trigger ${active ? "has-value" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {label}
        <span className="chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div id={id} className="filter-dropdown" style={{ maxHeight }}>
          {children}
        </div>
      )}
    </div>
  );
}

type SelectProps = {
  value: string | number;
  children: ReactNode;
  onChange: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};
export function Select({
  value,
  children,
  onChange,
  disabled,
  className = "",
  id,
  "aria-label": label,
}: SelectProps) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as {
        value: string | number;
        children: ReactNode;
        disabled?: boolean;
      };
      return { ...props, value: String(props.value) };
    });
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 200,
    maxHeight: 260,
  });
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const choose = (i: number) => {
    if (!options[i] || options[i].disabled) return;
    onChange({ target: { value: options[i].value } });
    setOpen(false);
    button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !list.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const place = () => {
      const box = button.current!.getBoundingClientRect();
      const below = window.innerHeight - box.bottom - 12;
      const maxHeight = Math.min(260, Math.max(below, box.top - 12));
      const width = Math.min(Math.max(box.width, 220), window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
        top:
          below >= maxHeight
            ? box.bottom + 5
            : Math.max(8, box.top - maxHeight - 5),
        width,
        maxHeight,
      });
    };
    place();
    const move = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) place();
    };
    window.addEventListener("scroll", move, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", move, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${index}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, index, listId]);
  return (
    <span
      ref={ref}
      className={`custom-select ${className}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        id={id}
        ref={button}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${index}` : undefined}
        disabled={disabled}
        onClick={() => {
          setIndex(
            Math.max(
              0,
              options.findIndex((o) => o.value === String(value)),
            ),
          );
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
            setIndex((i) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? options.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        options.length - 1,
                        (open
                          ? i
                          : options.findIndex(
                              (o) => o.value === String(value),
                            )) + (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
            );
          } else if (open && ["Enter", " "].includes(e.key)) {
            e.preventDefault();
            choose(index);
          } else if (e.key.length === 1 && e.key !== " ") {
            const found = options.findIndex((o) =>
              String(o.children).toLowerCase().startsWith(e.key.toLowerCase()),
            );
            if (found >= 0) {
              setOpen(true);
              setIndex(found);
            }
          }
        }}
      >
        <span>
          {options.find((o) => o.value === String(value))?.children || "—"}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open &&
        createPortal(
          <span
            ref={list}
            id={listId}
            role="listbox"
            aria-label={label}
            className="custom-options"
            style={{ ...position, position: "fixed", minWidth: 0 }}
          >
            {options.map((o, i) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={`${listId}-${i}`}
                key={o.value}
                aria-selected={o.value === String(value)}
                disabled={o.disabled}
                className={i === index ? "highlighted" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  choose(i);
                }}
              >
                {o.children}
              </button>
            ))}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function Checkbox({
  checked,
  onChange,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onChange: (event: { target: { checked: boolean } }) => void;
}) {
  return (
    <button
      {...props}
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="custom-checkbox"
      onClick={() => onChange({ target: { checked: !checked } })}
    >
      <span aria-hidden="true">{checked ? "✓" : ""}</span>
    </button>
  );
}
