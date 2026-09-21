import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { messages, type Lang } from "./messages";

const STORAGE = "miscr.lang";

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  const code = (navigator.language || "en").toLowerCase();
  return code.startsWith("ru") || code.startsWith("uk") || code.startsWith("be")
    ? "ru"
    : "en";
}

function fill(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
) {
  const table = messages[lang] || messages.ru;
  return fill(table[key] || messages.ru[key] || key, vars);
}

type Ctx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx>({
  lang: "ru",
  setLang: () => {},
  t: (key, vars) => translate("ru", key, vars),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    typeof navigator === "undefined" ? "ru" : detectLang(),
  );
  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE, next);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang],
  );
  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}
