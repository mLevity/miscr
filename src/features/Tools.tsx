import { Link, Route, Routes } from "react-router-dom";
import Damage from "./tools/Damage";
import Rebonus from "./tools/Rebonus";
import { useT } from "../i18n/Language";
export default function Tools() {
  const { t } = useT();
  return (
    <div className="page">
      <Routes>
        <Route
          index
          element={
            <>
              <p className="eyebrow">{t("tools.eyebrow")}</p>
              <h1>{t("tools.title")}</h1>
              <div className="damage-layout">
                <Link className="content-panel" to="damage">
                  <h2>{t("tools.damageTitle")}</h2>
                  <p>{t("tools.damageText")}</p>
                  <span>{t("tools.damageCta")}</span>
                </Link>
                <Link className="content-panel" to="rebonus">
                  <h2>{t("tools.rebonusTitle")}</h2>
                  <p>{t("tools.rebonusText")}</p>
                  <span>{t("tools.rebonusCta")}</span>
                </Link>
              </div>
            </>
          }
        />
        <Route path="damage" element={<Damage />} />
        <Route path="rebonus" element={<Rebonus />} />
        <Route
          path="*"
          element={<Link to="/tools">{t("tools.return")}</Link>}
        />
      </Routes>
    </div>
  );
}
