const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { buildSync } = require("esbuild");
const compiled = buildSync({
  entryPoints: ["src/domain/catalog/filter.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
}).outputFiles[0].text;
const moduleUnderTest = new Module(__filename);
moduleUnderTest._compile(compiled, __filename);
const { filterFamilies, defaultFilter, readFilter, writeFilter } =
  moduleUnderTest.exports;
const families = require("../data/miscrits.json");
const familyTags = require("../src/data/generated/family-tags.json");
const { abilityTags } = require("../tools/build_tags.cjs");

test("fire + lightning requires both, including old any-mode links", () => {
  const filter = readFilter(
    new URLSearchParams("elements=fire,lightning&elementMode=any"),
  );
  const result = filterFamilies(families, filter, {});
  const expected = families.filter(
    (f) => f.elements.includes("fire") && f.elements.includes("lightning"),
  );
  assert.ok(expected.length > 0);
  assert.equal(result.length, expected.length);
  assert.deepEqual(
    new Set(result.map((r) => r.family.id)),
    new Set(expected.map((f) => f.id)),
  );
});
test("rarity single selection, rank and tag URL state round trip", () => {
  const filter = readFilter(
    new URLSearchParams(
      "rarity=rare,epic&hp=4-4&tags=switchcurse,invalid&elements=fire",
    ),
  );
  assert.deepEqual(filter.rarity, ["rare"]);
  assert.deepEqual(filter.tags, ["switchcurse"]);
  assert.deepEqual(readFilter(writeFilter(filter)), filter);
});
test("tags intersect with ranks and rarity, reset returns all families", () => {
  const filter = { ...defaultFilter, tags: ["switchcurse", "heal"] };
  const result = filterFamilies(families, filter, {});
  const expected = families.filter(
    (f) =>
      familyTags[f.id].includes("switchcurse") &&
      familyTags[f.id].includes("heal"),
  );
  assert.ok(expected.length > 0);
  assert.equal(result.length, expected.length);
  const sample = result[0].family;
  const narrowed = filterFamilies(
    families,
    {
      ...filter,
      rarity: [sample.rarity],
      ranks: { hp: [sample.baseRanks.hp, sample.baseRanks.hp] },
    },
    {},
  );
  assert.ok(narrowed.length > 0);
  assert.ok(
    narrowed.every(
      (r) =>
        r.family.rarity === sample.rarity &&
        r.family.baseRanks.hp === sample.baseRanks.hp,
    ),
  );
  assert.equal(filterFamilies(families, defaultFilter, {}).length, 420);
});
test("tag derivation includes enchant effects and unifies spellings", () => {
  assert.deepEqual(
    abilityTags({
      tags: ["Switch Curse"],
      rawEffects: [{ type: "SwitchCurse" }],
      enchant: { additional: [{ type: "Heal" }, { type: "Buff", ap: -5 }] },
    }),
    ["debuff", "heal", "switchcurse"],
  );
  assert.throws(
    () => abilityTags({ tags: ["new_unknown_effect"] }),
    /Unknown effect/,
  );
});
