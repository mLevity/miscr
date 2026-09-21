import React, { lazy, Suspense, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { ProfileProvider, useProfile } from "./storage/profile";
import { Icon } from "./ui/common";
import { LanguageProvider, useT } from "./i18n/Language";
import Catalog from "./features/Catalog";
import "./style.css";
import "./ui/improvements.css";
import "./ui/catalog.css";
import "./ui/detail.css";
const Detail = lazy(() => import("./features/Detail"));
const WorldMap = lazy(() => import("./features/WorldMap"));
const Collection = lazy(() => import("./features/Collection"));
const Tools = lazy(() => import("./features/Tools"));
const Feedback = lazy(() => import("./features/Feedback"));
const Roadmap = lazy(() => import("./features/Roadmap"));
function Navigation({ mobile = false }: { mobile?: boolean }) {
  const { t } = useT();
  const items = [
    { to: "/", label: t("nav.miscrits"), icon: "book" },
    { to: "/map", label: t("nav.map"), icon: "map" },
    { to: "/collection", label: t("nav.collection"), icon: "collection" },
    { to: "/tools", label: t("nav.tools"), icon: "tools" },
  ];
  return (
    <nav
      className={mobile ? "mobile-nav" : "desktop-nav"}
      aria-label={t("nav.main")}
    >
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
const scrollPositions = new Map<string, number>();
function ScrollPosition() {
  const location = useLocation();
  const navigation = useNavigationType();
  useLayoutEffect(() => {
    window.scrollTo(
      0,
      navigation === "POP" ? (scrollPositions.get(location.pathname) ?? 0) : 0,
    );
    const remember = () =>
      scrollPositions.set(location.pathname, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [location.pathname, navigation]);
  return null;
}
function Shell() {
  const { status, error } = useProfile();
  const { t, lang, setLang } = useT();
  return (
    <>
      <ScrollPosition />
      <a className="skip-link" href="#main-content">
        {t("nav.skip")}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            Miscrits Helper
          </Link>
          <Navigation />
          <div className="header-extra">
            <NavLink className="extra-link" to="/roadmap">
              {t("nav.plans")}
            </NavLink>
            <NavLink className="extra-link" to="/feedback">
              {t("nav.bugs")}
            </NavLink>
            <div className="lang-toggle" role="group" aria-label={t("lang.switch")}>
              <button
                type="button"
                className={lang === "ru" ? "active" : ""}
                onClick={() => setLang("ru")}
              >
                RU
              </button>
              <button
                type="button"
                className={lang === "en" ? "active" : ""}
                onClick={() => setLang("en")}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>
      {error && (
        <div className="storage-warning" role="alert">
          {error}
        </div>
      )}
      <main id="main-content">
        <Suspense
          fallback={
            <div className="page" role="status">
              {t("nav.loading")}
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/miscrits/:slug" element={<Detail />} />
            <Route path="/map" element={<WorldMap />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/tools/*" element={<Tools />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/settings" element={<Navigate to="/collection#data-backup" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>
      <Navigation mobile />
      <div className="sr-only" aria-live="polite">
        {status === "loading" ? t("nav.loadingCollection") : ""}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProfileProvider>
        <LanguageProvider>
          <Shell />
        </LanguageProvider>
      </ProfileProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
