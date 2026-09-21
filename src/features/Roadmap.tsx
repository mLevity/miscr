import { useT } from "../i18n/Language";

const keys = [1, 2, 3, 4, 5] as const;

export default function Roadmap() {
  const { t } = useT();
  return (
    <div className="page roadmap-page">
      <p className="eyebrow">{t("roadmap.eyebrow")}</p>
      <h1>{t("roadmap.title")}</h1>
      <p>{t("roadmap.intro")}</p>
      <ol className="roadmap-list">
        {keys.map((item) => (
          <li key={item} className="content-panel">
            <strong>{t(`roadmap.${item}.title`)}</strong>
            <p>{t(`roadmap.${item}.text`)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
