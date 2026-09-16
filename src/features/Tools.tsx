import { Link, Route, Routes } from "react-router-dom";
import Damage from "./tools/Damage";
import Rebonus from "./tools/Rebonus";
export default function Tools() {
  return (
    <div className="page">
      <Routes>
        <Route
          index
          element={
            <>
              <p className="eyebrow">Расчёты и планирование</p>
              <h1>Инструменты</h1>
              <div className="damage-layout">
                <Link className="content-panel" to="damage">
                  <h2>Калькулятор урона</h2>
                  <p>
                    Два профиля, навыки, зачарование и реликвии. Диапазон
                    прямого урона при попадании.
                  </p>
                  <span>Рассчитать урон →</span>
                </Link>
                <Link className="content-panel" to="rebonus">
                  <h2>Симулятор ребонуса</h2>
                  <p>
                    Сравните новую попытку с текущими бонусами или оцените цель
                    в серии независимых попыток.
                  </p>
                  <span>Открыть симулятор →</span>
                </Link>
              </div>
            </>
          }
        />
        <Route path="damage" element={<Damage />} />
        <Route path="rebonus" element={<Rebonus />} />
        <Route
          path="*"
          element={<Link to="/tools">Вернуться к инструментам</Link>}
        />
      </Routes>
    </div>
  );
}
