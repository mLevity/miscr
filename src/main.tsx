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
const nav = [
  { to: "/", label: "Мискриты", icon: "book" },
  { to: "/map", label: "Карта мира", icon: "map" },
  { to: "/collection", label: "Моя коллекция", icon: "collection" },
  { to: "/tools", label: "Инструменты", icon: "tools" },
];
const extra = [
  { to: "/roadmap", label: "Планы" },
  { to: "/feedback", label: "Баги" },
];
function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      className={mobile ? "mobile-nav" : "desktop-nav"}
      aria-label="Основная навигация"
    >
      {nav.map((item) => (
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
  return (
    <>
      <ScrollPosition />
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            Miscrits Helper
          </Link>
          <Navigation />
          <div className="header-extra">
            {extra.map((item) => (
              <NavLink key={item.to} className="extra-link" to={item.to}>
                {item.label}
              </NavLink>
            ))}
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
              Загружаем раздел…
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
        {status === "loading" ? "Загружается коллекция" : ""}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProfileProvider>
        <Shell />
      </ProfileProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
