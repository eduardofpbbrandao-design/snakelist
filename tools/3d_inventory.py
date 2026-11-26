#!/usr/bin/env python3
"""3D inventory: for every species in species/3d/models.json, its body plan and modelling group, how far it has been
checked by hand, whether it takes the shared modelling improvements, and what it still needs. Writes
data/3d-inventory.json (one species per line) and prints a summary (docs/audit/3d.md quotes it).

The groups are worked out from the same tables species/3d/viewer.js uses (HF_GENUS, BUILD_GENUS, the realism pass's
genus lists), read straight from viewer.js so the two cannot drift apart.

Run: python3 tools/3d_inventory.py
"""
import json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import auto_models  # noqa: E402  (CURATED, HAND_FIXES, SPECIES_BODY: species looked at one by one)

VJS = open(os.path.join(ROOT, "species/3d/viewer.js"), encoding="utf-8").read()


def genus_table(block_name):
    """the `key: 'genus genus ...'` lists inside `for (const [k, l] of Object.entries({ ... }))` after block_name"""
    i = VJS.index(block_name)
    j = VJS.index("}))", i)
    out = {}
    for k, l in re.findall(r"(\w+): '([a-z ]+)'", VJS[i:j]):
        for g in l.split():
            out[g] = k
    return out


def word_list(const_name):
    m = re.search(r"const %s = '([a-z ]+)'" % const_name, VJS)
    return set(m.group(1).split()) if m else set()


HF_GENUS = genus_table("const HF_GENUS = {};")
BUILD_GENUS = genus_table("const BUILD_GENUS = {};")
HEAD_SET = set(re.findall(r"^([a-z]+-[a-z-]+) ", VJS[VJS.index("const HEAD_SET_SRC"):VJS.index("const HEAD_SET = {}")], re.M))
SPECIES_LOOK = set(re.findall(r"^  '([a-z]+-[a-z-]+)': \{", VJS[VJS.index("const SPECIES_LOOK"):VJS.index("function withLook")], re.M))
PREVIEW_LOOK = set(re.findall(r"^  '([a-z]+-[a-z-]+)': \{", VJS[VJS.index("const REAL_LOOK"):VJS.index("function realism")], re.M)) if "const REAL_LOOK" in VJS else set()
RACER = word_list("RACER_GENERA")
HOG = word_list("HOG_GENERA")
LONGSNOUT = word_list("LONGSNOUT_GENERA")
RATTLE = {"crotalus", "sistrurus"}
HOOD = set(auto_models.HOODED)

models = json.load(open(os.path.join(ROOT, "species/3d/models.json"), encoding="utf-8"))["species"]
audit = json.load(open(os.path.join(ROOT, "data/snake-model-audit.json"), encoding="utf-8"))["species"]
photo_cols = json.load(open(os.path.join(ROOT, "data/snake-model-colours.json"), encoding="utf-8"))
photo_pat = json.load(open(os.path.join(ROOT, "data/snake-model-photo.json"), encoding="utf-8"))


def group_of(sid, plan):
    """the realism pass's group (viewer.js realGroup) - keep the two in step"""
    g = sid.split("-")[0]
    hf = HF_GENUS.get(g)
    if plan == "blind":
        return "blind"
    if plan == "sea":
        return "sea"
    if plan in ("viper", "pitviper"):
        if g in RATTLE:
            return "rattlesnake"
        if hf == "colubrine":
            return "colubrine"
        return "pitviper" if plan == "pitviper" else "viper"
    if plan == "python":
        return hf if hf in ("boa", "sandboa") else "python"
    if plan == "elapid":
        if hf in ("cobra", "mamba", "deathadder", "burrow"):
            return hf
        return "elapid"
    # colubrids and anything else
    if g in HOG:
        return "hognose"
    if g in LONGSNOUT or hf == "vine":
        return "vine"
    if hf in ("broad", "burrow", "natricine"):
        return hf
    if g in RACER:
        return "racer"
    return "colubrine"


DESC = {
    "viper": "true viper: broad triangular head on a thin neck, heavy body, short abrupt tail",
    "pitviper": "pit viper: triangular head with loreal heat pits, heavy body, short tail",
    "rattlesnake": "rattlesnake: triangular head, loreal pits, heavy body, short tail ending in a rattle",
    "python": "python: long head, labial heat pits, heavy body, thick muscular tail",
    "boa": "boa: long head, heavy body, thick prehensile tail",
    "sandboa": "sand / rubber boa: blunt head barely wider than the neck, short blunt tail",
    "cobra": "cobra: narrow head about as wide as the neck, hood ribs",
    "mamba": "mamba: long coffin-shaped head, slender body, long whip tail",
    "deathadder": "death adder: broad viper-like head, stout body, thin lure tip",
    "elapid": "other elapid: narrow head little wider than the neck, smooth scales",
    "colubrine": "typical colubrid: oval head a little wider than the neck",
    "natricine": "water / garter snake: long narrow head, keeled scales",
    "racer": "racer / whipsnake / green snake: slender, big eyes, long whip tail",
    "vine": "vine snake: very slender, long pointed snout, long whip tail",
    "broad": "broad-headed colubrid (cat-eyed, tree, snail-eating snakes): broad head on a thin neck",
    "hognose": "hognose: stout body, upturned shovel snout",
    "burrow": "burrowing snake: blunt head no wider than the neck, small eyes, short tail",
    "blind": "blind / thread snake: blunt rounded head, tiny eye spots under the scales, uniform body, spine-tipped tail",
    "sea": "sea snake: small head, laterally flattened body, paddle tail",
}

rows = []
for sid in sorted(models):
    p = models[sid]
    a = p.get("auto") or {}
    x = a.get("x", "")
    plan = a.get("p") or p.get("plan") or "colubrid"
    g = sid.split("-")[0]
    grp = group_of(sid, plan)
    fossil = "f" in x
    has_photo = sid in photo_cols or sid in photo_pat
    checks = []
    if not a:
        checks.append("hand-made profile with cited references")
    if sid in auto_models.CURATED:
        checks.append("curated against photos (tools/auto_models.py CURATED)")
    if sid in HEAD_SET:
        checks.append("head shape set by hand (viewer.js HEAD_SET)")
    if sid in SPECIES_LOOK:
        checks.append("look rebuilt against photos (viewer.js SPECIES_LOOK)")
    if sid in PREVIEW_LOOK:
        checks.append("remodelled in the 3d preview (viewer.js REAL_LOOK)")
    if sid in getattr(auto_models, "SPECIES_BODY", {}):
        checks.append("body proportions set by hand")
    if sid in audit:
        checks.append("pattern/colour fixed in the v6.13 photo audit")
    elif has_photo:
        checks.append("colours read from its SnakeList photo; seen on a v6.13 audit contact sheet")
    individually = bool(not a or sid in auto_models.CURATED or sid in HEAD_SET or sid in SPECIES_LOOK or sid in PREVIEW_LOOK)
    if individually:
        status = "individually checked"
    elif has_photo:
        status = "photo-checked on contact sheets only"
    else:
        status = "not checked against a photo"
    needs = []
    if fossil:
        needs.append("fossil: no colours or soft anatomy known" + ("" if has_photo else "; the viewer shows '3D Reconstruction Unavailable'"))
    if "g" in x:
        needs.append("colours guessed (no usable photo)")
    if "l" in x and not fossil:
        needs.append("length is a typical value for its group")
    if not individually and not fossil:
        needs.append("head and body come from its group's shared shape only")
    if grp == "rattlesnake" and not individually:
        needs.append("rattle size not set per species")
    if g in HOOD and not individually:
        needs.append("hood shape is its genus's")
    rows.append({
        "id": sid, "name": p.get("name", ""), "plan": plan, "group": grp,
        "build": BUILD_GENUS.get(g) or "",
        "source": "generated" if a else "hand-made",
        "status": status,
        "checks": checks,
        "sharedImprovements": not (fossil and not has_photo),
        "needsCustomWork": needs,
    })

out = {
    "about": "3D inventory (tools/3d_inventory.py, read from species/3d/models.json and the tables in species/3d/viewer.js). "
             "group: the body plan group the shared modelling (and the '3d' preview's realism pass) uses. status: "
             "'individually checked' = a hand-made profile, or the species' head/look set by hand against photos; "
             "'photo-checked on contact sheets only' = its generated colours/pattern were read from and compared with its "
             "photo in bulk, its shape was never looked at on its own; 'not checked' = no photo. sharedImprovements: takes the "
             "shared group modelling (everything but fossils the viewer does not show). needsCustomWork: honest gaps.",
    "groups": DESC,
}
path = os.path.join(ROOT, "data/3d-inventory.json")
with open(path, "w", encoding="utf-8") as f:
    f.write("{\n")
    f.write('"about": ' + json.dumps(out["about"], ensure_ascii=False) + ",\n")
    f.write('"groups": ' + json.dumps(out["groups"], ensure_ascii=False) + ",\n")
    f.write('"species": [\n')
    f.write(",\n".join(json.dumps(r, ensure_ascii=False) for r in rows))
    f.write("\n]\n}\n")

c_group = collections.Counter(r["group"] for r in rows)
c_status = collections.Counter(r["status"] for r in rows)
gs = collections.defaultdict(collections.Counter)
for r in rows:
    gs[r["group"]][r["status"]] += 1
print("species", len(rows))
print("status", dict(c_status))
print("| group | species | individually checked | photo-checked only | not checked |")
print("|---|---:|---:|---:|---:|")
for k, n in c_group.most_common():
    s = gs[k]
    print("| %s | %d | %d | %d | %d |" % (k, n, s["individually checked"], s["photo-checked on contact sheets only"], s["not checked against a photo"]))
print("fossils", sum(1 for r in rows if not r["sharedImprovements"]), "not shown;", sum(1 for r in rows if "colours guessed" in " ".join(r["needsCustomWork"])), "colours guessed;",
      sum(1 for r in rows if "typical value" in " ".join(r["needsCustomWork"])), "typical lengths")
