const SECTIONS = new Set([
  "Каталог",
  "Карта мира",
  "Коллекция",
  "Калькулятор урона",
  "Ребонус",
  "Другое",
  "Catalog",
  "World Map",
  "Collection",
  "Damage calculator",
  "Rebonus",
  "Other",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается" });
    return;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chat = process.env.TELEGRAM_CHAT_ID || "";
  if (!token || !chat) {
    res.status(503).json({ error: "Приём заявок пока не настроен" });
    return;
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const section = String(body.section || "").trim();
  const details = String(body.details || "").trim();
  const contact = String(body.contact || "").trim();
  if (!SECTIONS.has(section) || details.length < 8 || details.length > 2500) {
    res.status(400).json({ error: "Проверьте раздел и текст заявки" });
    return;
  }
  if (contact.length > 200) {
    res.status(400).json({ error: "Контакт слишком длинный" });
    return;
  }
  const text = [
    "Новая заявка с miscr.vercel.app",
    `Раздел: ${section}`,
    contact ? `Контакт: ${contact}` : "Контакт: не указан",
    "",
    details,
  ].join("\n");
  const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
  });
  if (!telegram.ok) {
    res.status(502).json({ error: "Не удалось отправить заявку" });
    return;
  }
  res.status(200).json({ ok: true });
}
