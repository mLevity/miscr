// Canonical, reproducible ability tags; no inference from free-text descriptions.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "data", name + ".json"), "utf8"));
const definitions = {
  attack: ["Attack", "Атака", "physical"],
  heal: ["Heal", "Лечение", "heal"],
  buff: ["Buff", "Усиление", "buff"],
  debuff: ["Debuff", "Ослабление", "debuff"],
  confuse: ["Confuse", "Замешательство", "confuse"],
  poison: ["Poison", "Яд", "poison"],
  negate: ["Negate", "Отмена эффекта", "negate"],
  sleep: ["Sleep", "Сон", "sleep"],
  hot: ["Heal over Time", "Периодическое лечение", "heal"],
  bleed: ["Bleed", "Кровотечение", "bleed"],
  lifesteal: ["Life Steal", "Кража здоровья", "lifesteal"],
  paralyze: ["Paralyze", "Паралич", "paralyze"],
  dot: ["Damage over Time", "Периодический урон", "poison"],
  statsteal: ["Stat Steal", "Кража статов", "buff"],
  ai: ["AI", "Иммунитет к Anti-heal", "antiheal"],
  bot: ["Buff over Time", "Изменение статов по ходам", "bot_buff"],
  antiheal: ["Anti-heal", "Запрет лечения", "antiheal"],
  switchcurse: ["Switch Curse", "Проклятие при смене", "switchcurse"],
  block: ["Block", "Блок", "block"],
  si: ["SI", "SI", "si"],
  ci: ["CI", "CI", "ci"],
  pi: ["PI", "PI", "pi"],
  barbed: ["Barbed", "Шипы", "barbed"],
  forceswitch: ["Force Switch", "Принудительная смена", "switchcurse"],
  cleanser: ["Cleanser", "Очищение", "cleanser"],
  surprise: ["Surprise", "Сюрприз", "special"],
  special: ["Special", "Особый эффект", "special"],
  purge: ["Purge", "Снятие эффектов", "purge"],
  ethereal: ["Ethereal", "Бесплотность", "ethereal"],
  disease: ["Disease", "Болезнь", "disease"],
  timebomb: ["Time Bomb", "Отложенный урон", "bomb_fire"],
  conditional: ["Conditional", "Условный эффект", "special"],
  truedamage: ["True Damage", "Чистый урон", "truedamage"],
};
const normalize = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[\s_-]/g, "");
function abilityTags(ability) {
  const tags = new Set((ability.tags || []).map(normalize));
  for (const effect of [
    ...(ability.rawEffects || []),
    ...(ability.enchant?.additional || []),
  ]) {
    const tag = normalize(effect.type);
    tags.add(tag === "buff" && effect.ap < 0 ? "debuff" : tag);
  }
  if (ability.trueDamage) tags.add("truedamage");
  for (const tag of tags)
    if (!definitions[tag]) throw new Error(`Unknown effect: ${tag}`);
  return [...tags].sort();
}
function build() {
  const abilities = new Map(
    read("abilities").map((a) => [a.id, abilityTags(a)]),
  );
  const familyTags = Object.fromEntries(
    read("miscrits").map((f) => [f.id, []]),
  );
  for (const binding of read("miscrit-abilities")) {
    familyTags[binding.familyId].push(...abilities.get(binding.abilityId));
  }
  for (const id of Object.keys(familyTags))
    familyTags[id] = [...new Set(familyTags[id])].sort();
  const tags = Object.entries(definitions)
    .map(([id, [name, description, icon]]) => ({
      id,
      name,
      description,
      icon,
      count: Object.values(familyTags).filter((values) => values.includes(id))
        .length,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const [name, value] of Object.entries({
    "family-tags": familyTags,
    tags: tags,
  })) {
    fs.writeFileSync(
      path.join(root, "src/data/generated", name + ".json"),
      JSON.stringify(value) + "\n",
    );
  }
  console.log(
    `Prepared ${tags.length} unified tags for ${Object.keys(familyTags).length} families`,
  );
}
module.exports = { abilityTags, build };
if (require.main === module) build();
