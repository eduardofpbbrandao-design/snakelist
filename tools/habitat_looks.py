#!/usr/bin/env python3
"""v5.93: which habitats each snake's 3D view can show (the Habitats button behind See more in the 3D view).

Writes species/3d/habitats.json: {"v": 1, "sp": {"<species id>": [{"k": scene kind, "l": label, "f": flavour?}, ...]}}
Only snakes with MORE than one habitat to choose from are listed (the first one is shown when the 3D view opens);
every other snake keeps the one habitat its model already has (models.json scene) and no Habitats button appears.

How a snake's habitats are worked out:
  1. its model's own scene (species/3d/models.json: from its species account's habitat text, or from the kind of
     snake and the habitats of the places it lives - tools/auto_models.py scene_of) is always the first choice;
  2. the habitats SnakeList lists it under (#habitat-data in snakelist-synced.html: worked out from where it is
     recorded and what kind of snake it is) and its species account's habitat text (data/species-info/<id>.json)
     add others. The habitat lists are broad (they come from the countries and states a snake is found in), so a
     second habitat is only offered when
       - it suits the snake's main one (a desert snake is never offered a rainforest: see FITS), and
       - enough of its habitats point to it (named regions like "Florida Everglades" count three times, the
         account's own words five times);
  3. hand-checked choices for well-known snakes (CURATED) come first.
Labels are plain (Grassland, Cypress swamp...): the habitat lists come from the countries a snake lives in, so a named
region (the Everglades, the Moon Plain) is only named for the hand-checked snakes.

Run: python3 tools/habitat_looks.py   (re-run after models.json, #habitat-data or the species accounts change)
"""
import base64, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# scene kinds viewer.js can draw (SCENES), with a plain label for each
LABEL = {
    "rainforest": "Rainforest", "forest": "Woodland", "litter": "Forest floor", "soil": "Soil and leaf litter",
    "grass": "Grassland", "heath": "Scrub and heath", "arid": "Rocky desert", "sand": "Sand dunes",
    "gibber": "Gibber plain", "clay": "Cracking-clay floodplain", "riverbank": "Riverbank", "swamp": "Swamp",
    "sea": "Warm shallow sea", "shore": "Rocky shore",
}
SWAMP = {"cypress": "Cypress swamp", "reed": "Reed swamp", "tropic": "Flooded forest", "mangrove": "Mangroves"}
# v6.02: kinds of woodland (the plain "forest" look is a northern broadleaf-and-spruce wood): open savanna woodland of
# Africa (flat-topped acacia-like trees in dry grass) and Australia's eucalypt woodland
WOOD = {"savanna": "Savanna woodland", "eucalypt": "Eucalypt woodland"}
# which other habitats suit a snake whose main one is the key
FITS = {
    "gibber": {"clay", "arid", "sand", "grass"},
    "clay": {"gibber", "grass", "arid"},
    "arid": {"sand", "grass", "heath", "forest"},
    "sand": {"arid", "grass", "heath"},
    "grass": {"heath", "arid", "forest", "riverbank", "swamp"},
    "heath": {"grass", "forest", "arid"},
    "forest": {"rainforest", "grass", "heath", "riverbank", "swamp", "litter"},
    "litter": {"forest", "rainforest", "riverbank", "swamp"},
    "rainforest": {"forest", "riverbank", "swamp", "litter"},
    "riverbank": {"swamp", "forest", "grass", "rainforest"},
    "swamp": {"riverbank", "forest"},
    "soil": {"litter", "forest"},
    "sea": {"shore", "swamp"},
    "shore": {"sea"},
}
GENERIC = [  # (kind, habitat names in #habitat-data)
    ("swamp", ["Swamps", "Freshwater Swamps", "Forested Swamps", "Flooded Forest", "Peat Swamp Forest", "Mangrove Swamps", "Mangrove Forest"]),
    ("riverbank", ["Rivers", "Streams", "Creeks", "Lakes", "Ponds", "Marshes", "Freshwater Marshes", "Wetlands", "Riverine Forest", "Gallery Forest", "Rice Paddies", "Irrigation Canals", "Springs", "Waterholes"]),
    ("sand", ["Sand Dunes", "Sandy Desert", "Coastal Dunes", "Sandy Soil"]),
    ("arid", ["Rocky Desert", "Rocky Hillsides", "Rocky Outcrops", "Cliffs", "Canyons", "Gorges", "Scree Slopes", "Semi-Desert", "Desert Scrub", "Gravel Desert"]),
    ("shore", ["Rocky Shores"]),
    ("sea", ["Coral Reefs", "Seagrass Beds", "Shallow Coastal Waters", "Open Ocean", "Pelagic Waters"]),
    ("grass", ["Savanna", "Tropical Savanna", "Dry Savanna", "Wet Savanna", "Grassland", "Tropical Grassland", "Temperate Grassland", "Prairie", "Steppe", "Meadow"]),
    ("heath", ["Shrubland", "Scrubland", "Mediterranean Shrubland", "Chaparral", "Heathland", "Fynbos"]),
    ("rainforest", ["Tropical Rainforest", "Tropical Moist Forest", "Tropical Lowland Forest", "Montane Rainforest", "Cloud Forest"]),
    ("forest", ["Temperate Deciduous Forest", "Temperate Mixed Forest", "Temperate Coniferous Forest", "Boreal Forest", "Broadleaf Forest", "Pine Forest", "Woodland", "Open Woodland", "Dry Woodland"]),
    ("litter", ["Leaf Litter", "Fallen Logs"]),
    ("soil", ["Underground Burrows", "Loose Soil"]),
    ("clay", ["Floodplains"]),
]
REGIONAL = {  # named places (count three times; their name is used as the label)
    "Florida Everglades": ("swamp", "cypress"), "Okavango Delta": ("swamp", "reed"), "Pantanal Wetlands": ("swamp", "reed"),
    "Mesopotamian Marshes": ("swamp", "reed"), "Amazon Flooded Forest": ("swamp", "tropic"), "Amazon Várzea Forest": ("swamp", "tropic"),
    "Amazon Igapó Forest": ("swamp", "tropic"), "Borneo Peat Swamp Forest": ("swamp", "tropic"), "Sumatra Peat Swamp Forest": ("swamp", "tropic"),
    "New Guinea Swamp Forest": ("swamp", "tropic"), "Sundarbans Mangrove Forest": ("swamp", "mangrove"), "Borneo Mangrove Forest": ("swamp", "mangrove"),
    "Caribbean Mangrove Forest": ("swamp", "mangrove"), "Madagascar Mangrove Forest": ("swamp", "mangrove"),
    "Sonoran Desert": ("arid", None), "Mojave Desert": ("sand", None), "Chihuahuan Desert": ("arid", None), "Great Basin Desert": ("arid", None),
    "Namib Desert": ("sand", None), "Sahara Desert": ("sand", None), "Arabian Desert": ("sand", None), "Kalahari Desert": ("sand", None),
    "Taklamakan Desert": ("sand", None), "Gobi Desert": ("arid", None), "Negev Desert": ("arid", None), "Syrian Desert": ("arid", None),
    "Australian Outback Desert": ("gibber", None), "Australian Spinifex Grassland": ("arid", None),
    "Serengeti Grassland": ("grass", None), "Sudanian Savanna": ("grass", None), "Cerrado Savanna": ("grass", None), "Llanos Grassland": ("grass", None),
    "Pampas Grassland": ("grass", None), "Great Plains Grassland": ("grass", None), "Australian Savanna": ("grass", None), "Longleaf Pine Savanna": ("grass", None),
    "Cape Fynbos": ("heath", None), "California Chaparral": ("heath", None), "Mediterranean Scrubland": ("heath", None), "Australian Coastal Heathland": ("heath", None),
    "Mediterranean Coastal Dunes": ("sand", None),
}
# words in a species account's habitat text
WORDS = [
    ("swamp", r"\b(swamps?|bayous?|cypress|mangroves?|everglades|flooded forest)\b"),
    ("riverbank", r"\b(rivers?|streams?|creeks?|lakes?|ponds?|marsh(es)?|wetlands?|canals?|ditches|paddies)\b"),
    ("sand", r"\b(dunes?|sandy (desert|flats|soil|plains?)|sand ridges)\b"),
    ("arid", r"\b(rocky (desert|slopes?|hillsides?|outcrops?)|boulders?|canyons?|scree|desert scrub)\b"),
    ("grass", r"\b(grasslands?|savannas?|prairies?|meadows?|steppe)\b"),
    ("heath", r"\b(heath(land)?|shrubland|scrub(land)?|chaparral|fynbos|moorland)\b"),
    ("rainforest", r"\b(rain ?forests?|cloud forests?)\b"),
    ("forest", r"\b(woodlands?|forests?)\b"),
    ("shore", r"\b(rocky shores?|intertidal|coastal rocks|limestone islets?)\b"),
    ("sea", r"\b(coral reefs?|reefs?|seagrass|open (sea|ocean))\b"),
    ("clay", r"\b(cracking[- ]clay|black[- ]soil|gilgai|floodplains?)\b"),
    ("gibber", r"\b(gibber|stony plains?)\b"),
]
# hand-checked (first = shown first)
CURATED = {
    # the inland taipan: the cracking-clay floodplains of the Channel Country (its main home: deep soil cracks to shelter in,
    # long-haired rats to eat) and the gibber (stony) plains round them, like the Moon Plain
    "oxyuranus-microlepidotus": [("clay", "Channel Country floodplain", None), ("gibber", "Gibber plain (Moon Plain)", None)],
    # cottonmouth: cypress swamps of the south-eastern USA (the Everglades), and the banks of slow rivers
    "agkistrodon-piscivorus": [("swamp", "Cypress swamp (Everglades)", "cypress"), ("riverbank", "Slow river bank", None)],
    "agkistrodon-conanti": [("swamp", "Cypress swamp (Everglades)", "cypress"), ("riverbank", "Slow river bank", None)],
    # sea kraits hunt over coral reefs and come ashore on rocky islets to digest, shed and lay eggs
    "laticauda-colubrina": [("sea", "Warm shallow sea", None), ("shore", "Rocky shore", None)],
    "laticauda-laticaudata": [("sea", "Warm shallow sea", None), ("shore", "Rocky shore", None)],
    "laticauda-saintgironsi": [("sea", "Warm shallow sea", None), ("shore", "Rocky shore", None)],
    # sidewinder: wind-blown sand dunes and sandy flats of the Mojave and Sonoran deserts
    "crotalus-cerastes": [("sand", "Mojave sand dunes", None), ("arid", "Sonoran desert flats", None)],
    # green anaconda: the flooded forests and swamps of the Amazon and the Llanos, and river banks
    "eunectes-murinus": [("swamp", "Amazon flooded forest", "tropic"), ("riverbank", "River bank", None)],
    "eunectes-notaeus": [("swamp", "Pantanal Wetlands", "reed"), ("riverbank", "River bank", None)],
    # v6.02 (Eduardo: "for each snake to have its own habitat depending on where it lives"), checked against the species
    # accounts and field guides:
    # twig snakes: savanna woodland and bush of eastern and southern Africa (Kirtland's twig snake: the forests of the Congo basin)
    "thelotornis-capensis": [("forest", "Savanna woodland", "savanna"), ("grass", "Savanna grassland", None)],
    "thelotornis-mossambicanus": [("forest", "Savanna woodland", "savanna"), ("grass", "Savanna grassland", None)],
    "thelotornis-usambaricus": [("forest", "Coastal bush and woodland", "savanna"), ("rainforest", "Coastal forest", None)],
    "thelotornis-kirtlandii": [("rainforest", "Congo rainforest", None), ("forest", "Forest edge woodland", "savanna")],
    # boomslang: savanna, bushveld and fynbos of sub-Saharan Africa
    "dispholidus-typus": [("forest", "Savanna woodland (bushveld)", "savanna"), ("grass", "Savanna grassland", None), ("heath", "Fynbos and karoo scrub", None)],
    # tree pythons and boas of the rainforest
    "morelia-viridis": [("rainforest", "New Guinea rainforest", None)],
    "corallus-caninus": [("rainforest", "Amazon rainforest", None)],
    "corallus-batesii": [("rainforest", "Amazon rainforest", None)],
    "tropidolaemus-wagleri": [("rainforest", "Rainforest", None), ("swamp", "Mangroves", "mangrove")],
    "trimeresurus-albolabris": [("rainforest", "Tropical forest", None), ("forest", "Woodland", None)],
    # African savanna snakes
    "dendroaspis-polylepis": [("grass", "Savanna", None), ("forest", "Savanna woodland", "savanna"), ("arid", "Rocky hills", None)],
    "dendroaspis-angusticeps": [("rainforest", "Coastal forest", None), ("forest", "Coastal bush", "savanna")],
    "python-sebae": [("forest", "Savanna woodland", "savanna"), ("grass", "Savanna grassland", None), ("riverbank", "River bank", None)],
    "naja-nigricollis": [("forest", "Savanna woodland", "savanna"), ("grass", "Savanna grassland", None)],
    "naja-haje": [("grass", "Dry savanna", None), ("arid", "Semi-desert", None), ("forest", "Savanna woodland", "savanna")],
    # big snakes of the Asian tropics: rainforest first
    "malayopython-reticulatus": [("rainforest", "Rainforest", None), ("riverbank", "River bank", None), ("swamp", "Flooded forest", "tropic")],
    "ophiophagus-hannah": [("rainforest", "Rainforest", None), ("forest", "Woodland", None), ("swamp", "Flooded forest", "tropic")],
}
# v6.09: every habitat on the map's Habitats list gets a matching 3D scene ("See snakes here in 3D" from the 3D map opens a
# snake in its look). MAP_EXTRA first, then REGIONAL and GENERIC above, then words in the habitat's name (map_look).
MAP_EXTRA = {
    "Tropical Montane Forest": ("rainforest", None), "Temperate Rainforest": ("forest", None),
    "Tropical Dry Forest": ("forest", "savanna"), "Tropical Seasonal Forest": ("rainforest", None), "Subtropical Forest": ("rainforest", None),
    "Subtropical Dry Forest": ("forest", "savanna"), "Evergreen Forest": ("forest", None), "Bamboo Forest": ("rainforest", None),
    "Eucalyptus Forest": ("forest", "eucalypt"), "Coastal Forest": ("rainforest", None), "Flooded Forest": ("swamp", "tropic"),
    "Peat Swamp Forest": ("swamp", "tropic"), "Mangrove Forest": ("swamp", "mangrove"), "Scrub Forest": ("heath", None),
    "Thorn Forest": ("forest", "savanna"), "Montane Woodland": ("forest", None), "Mountain Forest": ("forest", None),
    "Subalpine Forest": ("forest", None), "Secondary Forest": ("forest", None), "Regenerating Forest": ("forest", None),
    "Forest Edges": ("forest", None), "Forest Clearings": ("grass", None), "Alpine Meadow": ("grass", None), "Alpine Grassland": ("grass", None),
    "Alpine Shrubland": ("heath", None), "Desert": ("sand", None), "Hot Desert": ("sand", None), "Cold Desert": ("arid", None),
    "Coastal Desert": ("sand", None), "Mountain Slopes": ("arid", None), "Highlands": ("grass", None), "Plateaus": ("arid", None),
    "Valleys": ("grass", None), "Caves": ("arid", None), "Rock Crevices": ("arid", None), "Termite Mounds": ("grass", None),
    "Salt Marshes": ("swamp", "reed"), "Bogs": ("swamp", "reed"), "Fens": ("swamp", "reed"), "Peatlands": ("swamp", "reed"),
    "Seasonal Wetlands": ("swamp", "reed"), "Reservoirs": ("riverbank", None), "Estuaries": ("riverbank", None),
    "Brackish Wetlands": ("swamp", "mangrove"), "Mangrove Swamps": ("swamp", "mangrove"), "Coastal Lagoons": ("shore", None),
    "Beaches": ("sand", None), "Sandy Shores": ("sand", None), "Coastal Scrub": ("heath", None),
    "Agricultural Land": ("grass", None), "Farmland": ("grass", None), "Plantations": ("forest", None), "Orchards": ("forest", None),
    "Gardens": ("grass", None), "Parks": ("grass", None), "Urban Areas": ("grass", None), "Suburban Areas": ("grass", None),
    "Rural Settlements": ("grass", None), "Abandoned Buildings": ("litter", None), "Roadsides": ("grass", None), "Disturbed Habitats": ("grass", None),
    "Freshwater Swamps": ("swamp", "tropic"), "Forested Swamps": ("swamp", "cypress"), "Swamps": ("swamp", "reed"),
    "Madagascar Limestone Karst Forest": ("forest", "savanna"), "Borneo Heath Forest": ("rainforest", None), "Borneo Limestone Forest": ("rainforest", None),
    "Rocky Mountain Foothills": ("arid", None), "Ethiopian Highlands": ("grass", None), "Sahel Shrubland": ("grass", None),
    "Coastal Restinga": ("heath", None), "Himalayan Montane Forest": ("forest", None), "Himalayan Foothill Forest": ("forest", None),
    "Chinese Subtropical Forest": ("rainforest", None), "Balkan Rocky Grassland": ("grass", None), "Arabian Mountain Shrubland": ("heath", None),
    "Mediterranean Levant Woodland": ("heath", None), "Zagros Mountain Woodland": ("forest", None), "Iranian Plateau Steppe": ("grass", None),
    "Australian Monsoon Forest": ("rainforest", None), "Florida Everglades": ("swamp", "cypress"), "Okavango Delta": ("swamp", "reed"),
    "Gran Chaco Woodland": ("forest", "savanna"), "Caatinga Dry Forest": ("forest", "savanna"), "Madagascar Spiny Forest": ("arid", None),
    "Madagascar Spiny Thicket": ("arid", None), "Madagascar Succulent Woodland": ("arid", None), "Madagascar Montane Shrubland": ("heath", None),
    "Australian Mulga Woodland": ("forest", "eucalypt"), "Australian Brigalow Woodland": ("forest", "eucalypt"),
    "Australian Eucalyptus Woodland": ("forest", "eucalypt"), "Miombo Woodland": ("forest", "savanna"), "Mopane Woodland": ("forest", "savanna"),
}
MAP_WORDS = [  # (regex on the name, kind, flavour) - the first that matches
    (r"mangrove", "swamp", "mangrove"), (r"peat swamp|swamp forest|flooded|v.rzea|igap", "swamp", "tropic"),
    (r"marsh|wetland|delta|everglades", "swamp", "reed"),
    (r"rain ?forest|cloud forest|wet tropics|yungas|terra firme|dipterocarp|humid|moist|tropical forest|montane forest", "rainforest", None),
    (r"\bdry\b|spiny|succulent|thicket", "forest", "savanna"),
    (r"desert", "arid", None), (r"steppe|grassland|savanna|llanos|pampas|meadow|highlands", "grass", None),
    (r"shrubland|fynbos|chaparral|heath|scrub", "heath", None), (r"dunes", "sand", None), (r"forest|woodland", "forest", None),
]


def map_look(name):
    """the 3D scene {k, f?, l} for one habitat on the map's Habitats list"""
    gen = {n: k for k, ns in GENERIC for n in ns}
    k = f = None
    if name in MAP_EXTRA:
        k, f = MAP_EXTRA[name]
    elif name in REGIONAL:
        k, f = REGIONAL[name]
    elif name in gen:
        k = gen[name]
    else:
        for rx, kk, ff in MAP_WORDS:
            if re.search(rx, name.lower()):
                k, f = kk, ff
                break
    if not k:
        k = "forest"
    if k == "swamp" and not f:
        f = "tropic"
    o = {"k": k, "l": name}
    if f:
        o["f"] = f
    return o
KIND_SECTIONS = 11  # the first 11 sections of #habitat-data are kinds of habitat; the rest are named regions


def main():
    html = open(os.path.join(ROOT, "snakelist-synced.html"), encoding="utf-8").read()
    m = re.search(r'<script type="application/json" id="habitat-data">(.*?)</script>', html, re.S)
    H = json.loads(m.group(1))
    ids = re.findall(r'<div class="card" data-id="([^"]+)"', html)
    if len(ids) != H["n"]:
        sys.exit("card count %d does not match habitat-data n %d" % (len(ids), H["n"]))
    countries = dict(re.findall(r'<div class="card" data-id="([^"]+)"[^>]*?data-countries="([^"]*)"', html))
    bits = []
    for sec in H["sections"]:
        for h in sec[1]:
            bits.append((h[0], base64.b64decode(h[1])))
    models = json.load(open(os.path.join(ROOT, "species/3d/models.json"), encoding="utf-8"))["species"]
    gen = {n: k for k, ns in GENERIC for n in ns}
    out = {}
    for i, sid in enumerate(ids):
        mdl = models.get(sid)
        if not mdl:
            continue
        a = mdl.get("auto") or {}
        sc = mdl.get("scene")
        primary = sc.get("kind") if isinstance(sc, dict) else a.get("s") or "litter"
        plan = mdl.get("plan") or a.get("p") or "colubrid"
        cs = set((countries.get(sid) or "").split("|"))
        aus = cs == {"Australia"}
        if sid in CURATED:  # (v6.02: a single hand-checked habitat is listed too: it sets the look, no Habitats button)
            out[sid] = [dict(k=k, l=l, **({"f": f} if f else {})) for k, l, f in CURATED[sid]]
            continue
        if plan == "blind" or primary == "soil":
            continue  # burrowers live underground: one habitat
        names = [n for n, b in bits if i < len(b) * 8 and b[i >> 3] & (1 << (i & 7))]
        score, flav = {}, {}
        for n in names:
            k = gen.get(n)
            if k:
                score[k] = score.get(k, 0) + 1
            if n in REGIONAL:
                k, f = REGIONAL[n]
                score[k] = score.get(k, 0) + 3
                if f:
                    flav.setdefault(k, f)
        # the species account's own words
        p = os.path.join(ROOT, "data/species-info", sid + ".json")
        if os.path.exists(p):
            info = json.load(open(p, encoding="utf-8"))
            txt = " ".join(x.get("text", "") for x in (info.get("sections") or {}).get("habitat", []) or []).lower()
            for k, rx in WORDS:
                if re.search(rx, txt):
                    score[k] = score.get(k, 0) + 5
        flav.setdefault("swamp", "cypress" if "United States" in cs else "tropic")
        if aus:
            flav["forest"] = "eucalypt"  # (v6.02: Australia's woods are eucalypt woodland, not spruce and oak)
        if "clay" in score and not aus:
            del score["clay"]  # (cracking-clay floodplains are drawn as inland Australia's)
        if "gibber" in score and not aus:
            del score["gibber"]
        fits = FITS.get(primary, set())
        cands = sorted(((s, k) for k, s in score.items() if k != primary and k in fits), reverse=True)
        top = max(score.values()) if score else 0
        alts = [k for s, k in cands if s >= 4 and s >= top * 0.3][:2]
        lab = lambda k: SWAMP.get(flav.get(k), "Swamp") if k == "swamp" else WOOD.get(flav.get(k), LABEL.get(k, k)) if k == "forest" else LABEL.get(k, k)
        if not alts:
            if primary == "forest" and aus:  # (one habitat, but its own kind of woodland)
                out[sid] = [dict(k=primary, l=lab(primary), f=flav[primary])]
            continue
        opts = [dict(k=primary, l=lab(primary), **({"f": flav[primary]} if primary in flav else {}))]
        for k in alts:
            opts.append(dict(k=k, l=lab(k), **({"f": flav[k]} if k in flav else {})))
        out[sid] = opts
    dst = os.path.join(ROOT, "species/3d/habitats.json")
    with open(dst, "w", encoding="utf-8") as fh:
        # v6.09: "map": the 3D scene for each habitat on the map's Habitats list (the 3D map's "See snakes here in 3D")
        hmap = {h[0]: map_look(h[0]) for sec in H["sections"] for h in sec[1]}
        json.dump({"v": 1, "sp": out, "map": hmap}, fh, ensure_ascii=False, separators=(",", ":"))
    from collections import Counter
    print("%d snakes with a choice of habitats -> %s (%d bytes)" % (len(out), dst, os.path.getsize(dst)))
    print(Counter(len(v) for v in out.values()), Counter(o["k"] for v in out.values() for o in v[1:]).most_common())
    print(Counter(o.get("f") for v in out.values() for o in v if o["k"] == "forest").most_common())


if __name__ == "__main__":
    main()
