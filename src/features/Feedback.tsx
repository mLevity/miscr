import { useState } from "react";
import { useT } from "../i18n/Language";

const sectionKeys = [
  "catalog",
  "map",
  "collection",
  "damage",
  "rebonus",
  "other",
] as const;

export default function Feedback() {
  const { t } = useT();
  const [section, setSection] = useState<(typeof sectionKeys)[number]>("catalog");
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
        body: JSON.stringify({
          section: t(`feedback.${section}`),
          details,
          contact,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t("feedback.error"));
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
      <p className="eyebrow">{t("feedback.eyebrow")}</p>
      <h1>{t("feedback.title")}</h1>
      <p>{t("feedback.intro")}</p>
      <form className="content-panel feedback-form" onSubmit={send}>
        <label className="field-label">
          {t("feedback.section")}
          <select
            value={section}
            onChange={(event) =>
              setSection(event.target.value as (typeof sectionKeys)[number])
            }
          >
            {sectionKeys.map((item) => (
              <option key={item} value={item}>
                {t(`feedback.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          {t("feedback.details")}
          <textarea
            required
            minLength={8}
            maxLength={2500}
            rows={7}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={t("feedback.detailsPh")}
          />
        </label>
        <label className="field-label">
          {t("feedback.contact")}
          <input
            value={contact}
            maxLength={200}
            onChange={(event) => setContact(event.target.value)}
            placeholder={t("feedback.contactPh")}
          />
        </label>
        <button className="primary-button" disabled={status === "sending"}>
          {status === "sending" ? t("feedback.sending") : t("feedback.send")}
        </button>
        {status === "sent" && <p role="status">{t("feedback.sent")}</p>}
        {status === "error" && <p role="alert">{error}</p>}
      </form>
    </div>
  );
}
