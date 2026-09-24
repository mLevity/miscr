import { useEffect, useMemo, useRef, useState } from "react";
import { families, familyById } from "../../data/static";
import { searchMatch } from "../../domain/catalog/filter";
import { assetsForFormId } from "../../ui/assets";
import { useT } from "../../i18n/Language";

function face(familyId: string) {
  const family = familyById.get(familyId);
  const formId = family?.formIds[0];
  return formId
    ? assetsForFormId(formId)?.avatarPath ||
        assetsForFormId(formId)?.battlePath ||
        ""
    : "";
}

export function FamilySearch({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const { t } = useT();
  const selected = familyById.get(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.name || "");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) setQuery(familyById.get(value)?.name || "");
  }, [value, open]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const results = useMemo(() => {
    const q = query.trim();
    return families
      .map((family) => {
        const hit = searchMatch(family, q);
        return hit ? { family, hit } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.hit.score - b!.hit.score || a!.family.name.localeCompare(b!.family.name))
      .slice(0, 12) as {
      family: (typeof families)[number];
      hit: NonNullable<ReturnType<typeof searchMatch>>;
    }[];
  }, [query]);
  const pick = (id: string) => {
    onChange(id);
    setQuery(familyById.get(id)?.name || "");
    setOpen(false);
  };
  const art = face(value);
  return (
    <div className="family-search" ref={box}>
      <label className="family-search-field">
        {art ? <img src={art} alt="" /> : <span className="family-search-dot" />}
        <input
          value={query}
          disabled={disabled}
          placeholder={t("tools.searchMiscrit")}
          aria-label={t("tools.searchMiscrit")}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              pick(results[0].family.id);
            }
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {open && !disabled && (
        <ul className="family-search-list" role="listbox">
          {results.length ? (
            results.map(({ family, hit }) => {
              const src = face(family.id);
              return (
                <li key={family.id}>
                  <button
                    type="button"
                    className={family.id === value ? "active" : ""}
                    onClick={() => pick(family.id)}
                  >
                    {src ? <img src={src} alt="" /> : <span />}
                    <span>
                      <strong>{family.name}</strong>
                      {hit.formName && hit.formName !== family.name && (
                        <small>{hit.formName}</small>
                      )}
                    </span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="family-search-empty">{t("catalog.empty")}</li>
          )}
        </ul>
      )}
    </div>
  );
}
