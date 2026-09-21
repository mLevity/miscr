import { useState } from "react";

const sections = [
  "Каталог",
  "Карта мира",
  "Коллекция",
  "Калькулятор урона",
  "Ребонус",
  "Другое",
];

export default function Feedback() {
  const [section, setSection] = useState(sections[0]);
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section, details, contact }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Ошибка отправки");
      setStatus("sent");
      setDetails("");
      setContact("");
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  };
  return (
    <div className="page feedback-page">
      <p className="eyebrow">Обратная связь</p>
      <h1>Баги и предложения</h1>
      <p>
        Рассматриваем все заявки. Удачные идеи внедряем в следующих обновлениях.
      </p>
      <form className="content-panel feedback-form" onSubmit={send}>
        <label className="field-label">
          Раздел
          <select
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            {sections.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Подробности
          <textarea
            required
            minLength={8}
            maxLength={2500}
            rows={7}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Что сломалось или что стоит добавить"
          />
        </label>
        <label className="field-label">
          Контакт
          <input
            value={contact}
            maxLength={200}
            onChange={(event) => setContact(event.target.value)}
            placeholder="Telegram, Discord или почта — по желанию"
          />
        </label>
        <button className="primary-button" disabled={status === "sending"}>
          {status === "sending" ? "Отправляем…" : "Отправить"}
        </button>
        {status === "sent" && <p role="status">Заявка ушла, спасибо.</p>}
        {status === "error" && <p role="alert">{error}</p>}
      </form>
    </div>
  );
}
