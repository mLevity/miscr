#!/usr/bin/env python3
import hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SRC = Path("/home/workdir/attachments/Miscrits.json")

RANKS = {"Weak": 1, "Moderate": 2, "Strong": 3, "Max": 4, "Elite": 5}
UNLOCK = [1, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 30]
KIND = {
    "attack": "attack",
    "heal": "heal",
    "buff": "buff",
    "confuse": "confuse",
    "poison": "poison",
    "negate": "negate",
    "sleep": "sleep",
    "hot": "hot",
    "bot": "bot",
    "special": "special",
    "ethereal": "ethereal",
    "dot": "dot",
    "bleed": "bleed",
    "block": "block",
    "paralyze": "paralyze",
    "lifesteal": "lifesteal",
    "antiheal": "antiheal",
    "switchcurse": "switchcurse",
    "cleanser": "cleanser",
    "purge": "purge",
    "disease": "disease",
    "timebomb": "timebomb",
    "ci": "ci",
    "si": "si",
    "pi": "pi",
    "barbed": "barbed",
}


def load(name):
    return json.loads((DATA / name).read_text())


def save(name, value):
    (DATA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def split_element(value):
    parts = re.findall(r"Fire|Water|Nature|Earth|Lightning|Wind|Physical", value)
    return [p.lower() for p in parts] or [value.lower()]


def weekdays(raw):
    if not raw:
        return [1, 2, 3, 4, 5, 6, 7]
    out = []
    for day in raw:
        out.append(7 if day == 0 else int(day))
    return sorted(set(out))


def extra_tags(effect):
    t = str(effect.get("type") or "").lower().replace("_", "")
    if t == "buff" and (effect.get("ap") or 0) < 0:
        return "debuff"
    return t


def convert_ability(raw):
    typ = str(raw.get("type") or "Attack")
    kind = KIND.get(typ.lower(), typ.lower())
    ap = raw.get("ap")
    if kind == "buff" and ap is not None and ap < 0:
        kind = "debuff"
    keys = list(raw.get("keys") or [])
    additional = list((raw.get("enchant") or {}).get("additional") or raw.get("additional") or [])
    # incoming additional is on ability itself too
    if raw.get("additional"):
        additional = list(raw["additional"])
    tags = {kind}
    raw_effects = []
    for extra in additional:
        tag = extra_tags(extra)
        if tag and tag != "buff":
            tags.add(tag)
        raw_effects.append(extra)
    if kind == "attack":
        tags.add("attack")
    enchant = dict(raw.get("enchant") or {})
    if additional and "additional" not in enchant:
        # keep incoming enchant object as-is when already structured
        pass
    hits = raw.get("times") or 1
    cooldown = raw.get("cooldown")
    max_uses = raw.get("max_uses")
    if cooldown == -1:
        max_uses = max_uses or 1
        cooldown = None
    element = split_element(raw.get("element") or "Misc")[0]
    return {
        "sourceId": str(raw["id"]),
        "name": raw["name"],
        "kind": kind,
        "element": element,
        "ap": ap,
        "accuracyPercent": raw.get("accuracy"),
        "hits": hits,
        "turns": raw.get("turns"),
        "cooldown": cooldown,
        "maxUses": max_uses,
        "affectedStats": keys,
        "target": (raw.get("target") or "").lower() or None,
        "tags": sorted(tags),
        "descriptionEn": raw.get("desc") or "",
        "enchantDescriptionEn": raw.get("enchant_desc") or "",
        "enchant": enchant or None,
        "rawEffects": raw_effects,
        "trueDamage": False,
        "calculationSupport": "direct" if kind == "attack" and not raw_effects else "requires-effect-handler",
        "provenance": {
            "sourceId": "official-miscrits",
            "retrievedOn": "2026-09-20",
            "method": "public-json",
            "gameVerified": False,
        },
        "sourceTiming": {"turns": raw.get("turns"), "cooldown": cooldown, "maxUses": max_uses},
        "timingNotes": [],
    }


def new_ability_id(source_id, payload):
    digest = hashlib.sha1(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:10]
    return f"ability:{source_id}:{digest}"


def main():
    incoming = json.loads(SRC.read_text())
    snapshot = DATA / "source_snapshots" / "official-miscrits.json"
    snapshot.write_text(json.dumps(incoming, ensure_ascii=False) + "\n")

    families = load("miscrits.json")
    forms = load("forms.json")
    abilities = load("abilities.json")
    binds = load("miscrit-abilities.json")
    aliases = load("aliases.json")
    variants = load("family-variants.json")
    base_stats = load("base-stats.json")
    locations = load("locations.json")
    areas = load("areas.json")
    spawns = load("spawns.json")

    fam_by_num = {int(f["id"].split(":")[1]): f for f in families}
    form_by_family = {}
    for form in forms:
        form_by_family.setdefault(form["familyId"], []).append(form)
    abi_by_source = {}
    for abi in abilities:
        abi_by_source.setdefault(str(abi["sourceId"]), abi)
    loc_by_name = {item["name"].lower(): item for item in locations}
    area_by_key = {}
    for area in areas:
        m = re.search(r"(\d+)$", area["name"])
        if m:
            area_by_key[(area["locationId"], m.group(1))] = area
        area_by_key[(area["locationId"], area["name"].lower())] = area

    binds[:] = [row for row in binds if int(row["familyId"].split(":")[1]) in {item["id"] for item in incoming}]
    bind_index = {(row["familyId"], row["order"]): row for row in binds}
    alias_index = {(row["familyId"], row["query"]): row for row in aliases}
    variant_index = {row["familyId"]: row for row in variants}
    stats_index = {row["familyId"]: row for row in base_stats}

    next_spawn = max(int(row["id"].split(":")[1]) for row in spawns) + 1
    existing_spawn = {(row["familyId"], row["locationId"], row.get("areaId")) for row in spawns}

    for item in incoming:
        num = item["id"]
        family_id = f"miscrit:{num}"
        names = item["names"]
        elements = split_element(item["element"])
        rarity = item["rarity"].lower()
        ranks = {key: RANKS[item[key]] for key in ("hp", "spd", "ea", "pa", "ed", "pd")}
        family = fam_by_num.get(num)
        if not family:
            family = {
                "id": family_id,
                "sourceIds": {"official": str(num)},
                "slug": slugify(names[0]),
                "name": names[0],
                "aliases": names,
                "elements": elements,
                "rarity": rarity,
                "baseRanks": ranks,
                "formIds": [],
                "provenance": {
                    "sourceId": "official-miscrits",
                    "retrievedOn": "2026-09-20",
                    "method": "public-json",
                    "gameVerified": False,
                },
            }
            families.append(family)
            fam_by_num[num] = family
        else:
            family["name"] = names[0]
            family["aliases"] = names
            family["elements"] = elements
            family["rarity"] = rarity
            family["baseRanks"] = ranks

        current_forms = form_by_family.setdefault(family_id, [])
        if not current_forms:
            current_forms = []
            for stage, name in enumerate(names, start=1):
                form = {
                    "id": f"{family_id}:form:{stage}",
                    "familyId": family_id,
                    "stage": stage,
                    "name": name,
                    "assetKey": slugify(name),
                    "minimumLevel": None,
                    "provenance": family["provenance"],
                }
                forms.append(form)
                current_forms.append(form)
            form_by_family[family_id] = current_forms
        else:
            for form, name in zip(current_forms, names):
                form["name"] = name
        family["formIds"] = [form["id"] for form in current_forms]

        prefix = names[0].split(" ", 1)[0].lower()
        variant = "dark" if prefix == "dark" else "foil" if prefix == "foil" else "light" if prefix == "light" else "blighted" if prefix == "blighted" else "base"
        if family_id in variant_index:
            variant_index[family_id]["variant"] = variant
        else:
            row = {
                "familyId": family_id,
                "variant": variant,
                "classificationMethod": "canonical-name-prefix-snapshot",
                "note": "UI category only, not evolution or shared family identity",
            }
            variants.append(row)
            variant_index[family_id] = row

        if family_id in stats_index:
            stats_index[family_id]["ranks"] = ranks
        else:
            row = {"familyId": family_id, "ranks": ranks, "provenance": family["provenance"]}
            base_stats.append(row)
            stats_index[family_id] = row

        for name in names:
            key = (family_id, name)
            if key not in alias_index:
                row = {"query": name, "normalized": slugify(name).replace("-", ""), "familyId": family_id}
                aliases.append(row)
                alias_index[key] = row

        unique_abs = {}
        for raw in item["abilities"]:
            unique_abs[raw["id"]] = raw
        order = item.get("ability_order") or [raw["id"] for raw in item["abilities"]]
        for position, source in enumerate(order):
            raw = unique_abs.get(source)
            if not raw:
                continue
            converted = convert_ability(raw)
            existing = abi_by_source.get(str(source))
            if existing:
                keep = existing["id"]
                existing.update(converted)
                existing["id"] = keep
                ability_id = keep
            else:
                ability_id = new_ability_id(source, converted)
                converted["id"] = ability_id
                abilities.append(converted)
                abi_by_source[str(source)] = converted
            bind_key = (family_id, position)
            if bind_key in bind_index:
                bind_index[bind_key]["abilityId"] = ability_id
                bind_index[bind_key]["unlockLevel"] = UNLOCK[position] if position < len(UNLOCK) else 30
            else:
                row = {
                    "familyId": family_id,
                    "abilityId": ability_id,
                    "order": position,
                    "unlockLevel": UNLOCK[position] if position < len(UNLOCK) else 30,
                    "unlockLevelStatus": "simulator-rule-applied-to-official-order",
                }
                binds.append(row)
                bind_index[bind_key] = row

        for loc_name, zones in (item.get("locations") or {}).items():
            loc = loc_by_name.get(loc_name.lower())
            if not loc:
                continue
            for zone, days in zones.items():
                area = area_by_key.get((loc["id"], str(zone)))
                area_id = area["id"] if area else None
                key = (family_id, loc["id"], area_id)
                if key in existing_spawn:
                    continue
                spawn = {
                    "id": f"spawn:{next_spawn:04d}",
                    "familyId": family_id,
                    "sourceName": names[0],
                    "locationId": loc["id"],
                    "areaId": area_id,
                    "acquisition": "wild",
                    "schedule": {
                        "timezone": "UTC",
                        "weekdays": weekdays(days),
                        "rule": "weekly",
                        "validFrom": None,
                        "validUntil": None,
                        "observedOn": "2026-09-20",
                    },
                    "precision": "area",
                    "markerIds": [],
                    "sourceRarity": item["rarity"].lower(),
                    "sourceElement": item["element"],
                    "conditionsText": None,
                    "encounterProbability": None,
                    "provenance": {
                        "sourceId": "official-miscrits",
                        "retrievedOn": "2026-09-20",
                        "method": "public-json",
                        "gameVerified": False,
                    },
                }
                spawns.append(spawn)
                existing_spawn.add(key)
                next_spawn += 1

    families.sort(key=lambda row: int(row["id"].split(":")[1]))
    save("miscrits.json", families)
    save("forms.json", forms)
    save("abilities.json", abilities)
    save("miscrit-abilities.json", binds)
    save("aliases.json", aliases)
    save("family-variants.json", variants)
    save("base-stats.json", base_stats)
    save("spawns.json", spawns)
    print(
        f"families={len(families)} forms={len(forms)} abilities={len(abilities)} "
        f"binds={len(binds)} spawns={len(spawns)}"
    )


if __name__ == "__main__":
    main()
