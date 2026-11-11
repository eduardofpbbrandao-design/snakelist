"""Generated 3D model profiles for every snake in SnakeList (v4.63).

The 40 hand-made profiles in data/snake-models.json stay as they are. Every other species, living,
extinct or known only from fossils, gets a short generated profile that species/3d/viewer.js expands
(autoProfile) into a full one:
  - body plan (head shape, build, scales, pose) from its family and kind;
  - length: its reviewed account where SnakeList has one, the fossil estimate for fossils, otherwise a
    typical adult length for its genus or family;
  - colours: read from its own SnakeList photo (tools/model_colours.py -> data/snake-model-colours.json).
    Snakes with no photo, and all fossils (colour is never preserved), get their group's usual colours,
    and the model says the colours are a guess;
  - markings: from its name (striped, banded, coral, spotted, diamond...) and its genus, else from how
    much the photo's pattern colour stands out;
  - surroundings: from its kind (sea snakes in the sea, water snakes at a riverbank, burrowers on soil)
    and the habitats of the places it lives.
Each entry: {"name": ..., "auto": {"p": plan, "L": metres, "d": main colour, "c": pattern colour,
"b": belly colour, "t": pattern, "n": marks along the body, "s": scene, "k": keeled 0/1, "x": flags}}
flags: "f" fossil, "e" extinct, "g" colours guessed (no photo), "l" length typical for its group.
"""
import json, os, re, colorsys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PLAN_FAM = {
    "Pythonidae": "python", "Boidae": "python", "Loxocemidae": "python", "Xenopeltidae": "python", "Bolyeriidae": "python",
    "Tropidophiidae": "python", "Madtsoiidae": "python", "Acrochordidae": "python", "Dinilysiidae": "python",
    "Typhlopidae": "blind", "Leptotyphlopidae": "blind", "Anomalepididae": "blind", "Gerrhopilidae": "blind", "Xenotyphlopidae": "blind",
    "Elapidae": "elapid", "Palaeophiidae": "sea", "Simoliophiidae": "sea",
}
SEA_GENERA = {"hydrophis", "aipysurus", "emydocephalus", "laticauda", "hydrelaps", "ephalophis", "parahydrophis", "microcephalophis", "pelamis", "acalyptophis", "astrotia", "enhydrina", "kerilia", "kolpophis", "lapemis", "thalassophina", "thalassophis", "disteira", "chitulia", "leioselasma"}
# typical adult length (m) by genus; the rest fall back to family, then kind
GENUS_LEN = {
    "python": 2.5, "malayopython": 4.0, "morelia": 2.0, "liasis": 2.0, "antaresia": 0.9, "aspidites": 1.6, "simalia": 2.5, "leiopython": 2.0, "apodora": 3.0,
    "bothrochilus": 1.4, "candoia": 0.8, "boa": 2.5, "eunectes": 4.5, "epicrates": 1.6, "chilabothrus": 1.5, "corallus": 1.5, "acrantophis": 2.0, "sanzinia": 1.6,
    "eryx": 0.6, "charina": 0.6, "lichanura": 0.8, "calabaria": 0.8, "ungaliophis": 0.6, "tropidophis": 0.4, "exiliboa": 0.45, "xenopeltis": 1.0, "loxocemus": 1.2,
    "cylindrophis": 0.6, "anilius": 0.7, "uropeltis": 0.3, "rhinophis": 0.3, "melanophidium": 0.4, "acrochordus": 1.5,
    "crotalus": 1.0, "sistrurus": 0.6, "agkistrodon": 0.8, "bothrops": 1.2, "bothriechis": 0.7, "lachesis": 2.2, "trimeresurus": 0.7, "protobothrops": 1.0,
    "gloydius": 0.6, "deinagkistrodon": 1.0, "calloselasma": 0.8, "atropoides": 0.6, "metlapilcoatlus": 0.6, "porthidium": 0.6, "cerrophidion": 0.5,
    "bothrocophias": 0.8, "craspedocephalus": 0.7, "ovophis": 0.6, "hypnale": 0.4, "tropidolaemus": 0.8, "ophryacus": 0.6, "mixcoatlus": 0.5,
    "vipera": 0.6, "bitis": 0.9, "daboia": 1.2, "echis": 0.5, "cerastes": 0.6, "macrovipera": 1.3, "montivipera": 0.8, "atheris": 0.6, "causus": 0.6,
    "pseudocerastes": 0.7, "eristicophis": 0.6, "proatheris": 0.5, "azemiops": 0.7, "atractaspis": 0.5,
    "naja": 1.8, "ophiophagus": 3.5, "dendroaspis": 2.0, "bungarus": 1.2, "micrurus": 0.7, "micruroides": 0.5, "calliophis": 0.6, "sinomicrurus": 0.6,
    "oxyuranus": 2.0, "pseudonaja": 1.4, "notechis": 1.2, "acanthophis": 0.7, "pseudechis": 1.6, "hoplocephalus": 0.7, "demansia": 1.0, "aspidelaps": 0.6,
    "hemachatus": 1.1, "elapsoidea": 0.6, "walterinnesia": 1.0, "hydrophis": 1.2, "laticauda": 1.0, "aipysurus": 1.3, "emydocephalus": 0.8,
    "simoselaps": 0.3, "vermicella": 0.5, "cacophis": 0.5, "furina": 0.5, "suta": 0.5, "denisonia": 0.4, "cryptophis": 0.5, "toxicocalamus": 0.4,
    "pantherophis": 1.4, "lampropeltis": 1.0, "elaphe": 1.4, "zamenis": 1.2, "coronella": 0.6, "natrix": 1.0, "thamnophis": 0.7, "nerodia": 1.0,
    "coluber": 1.2, "masticophis": 1.5, "drymarchon": 2.2, "spilotes": 2.2, "ptyas": 2.0, "dendrelaphis": 1.1, "ahaetulla": 1.2, "boiga": 1.5,
    "chironius": 1.5, "philodryas": 1.2, "oxybelis": 1.3, "leptophis": 1.2, "dispholidus": 1.4, "thelotornis": 1.1, "philothamnus": 0.8, "psammophis": 1.0,
    "malpolon": 1.6, "hierophis": 1.4, "platyceps": 0.8, "eirenis": 0.4, "oligodon": 0.5, "lycodon": 0.6, "dasypeltis": 0.7, "tantilla": 0.25,
    "sonora": 0.25, "geophis": 0.3, "atractus": 0.35, "calamaria": 0.3, "pseudorabdion": 0.25, "ninia": 0.35, "storeria": 0.3, "diadophis": 0.4,
    "carphophis": 0.3, "virginia": 0.25, "heterodon": 0.7, "dipsas": 0.7, "sibon": 0.6, "imantodes": 0.9, "leptodeira": 0.7, "erythrolamprus": 0.6,
    "xenodon": 0.8, "clelia": 1.8, "oxyrhopus": 0.8, "pseudoboa": 1.0, "tachymenis": 0.6, "helicops": 0.7, "hydrops": 0.7, "apostolepis": 0.4,
    "rhadinaea": 0.4, "coniophanes": 0.5, "conophis": 0.7, "enhydris": 0.6, "homalopsis": 0.9, "cerberus": 0.8, "hypsiscopus": 0.6, "boaedon": 0.8,
    "lamprophis": 0.7, "lycophidion": 0.4, "gonionotophis": 0.9, "mehelya": 1.0, "prosymna": 0.3, "amblyodipsas": 0.4, "psammophylax": 0.7,
    "rhamphiophis": 1.0, "madagascarophis": 0.8, "liophidium": 0.5, "pseudoxyrhopus": 0.6, "leioheterodon": 1.3, "ithycyphus": 1.0, "langaha": 0.8,
    "pareas": 0.5, "aplopeltura": 0.6, "achalinus": 0.4, "xenodermus": 0.6, "opheodrys": 0.7, "arizona": 1.0, "pituophis": 1.5, "rhinocheilus": 0.7,
    "salvadora": 0.8, "trimorphodon": 0.8, "hypsiglena": 0.4, "senticolis": 1.0, "bogertophis": 1.2, "gonyosoma": 1.5, "orthriophis": 1.6,
    "euprepiophis": 0.9, "oreocryptophis": 0.9, "rhabdophis": 0.7, "amphiesma": 0.6, "hebius": 0.6, "fowlea": 0.8, "xenochrophis": 0.8,
    "sinonatrix": 0.8, "opisthotropis": 0.5, "trachischium": 0.3, "smithophis": 0.5, "stegonotus": 1.0, "dryocalamus": 0.5, "liopeltis": 0.5,
    "sibynophis": 0.5, "lygophis": 0.6, "echinanthera": 0.6, "taeniophallus": 0.4, "thamnodynastes": 0.5, "indotyphlops": 0.15, "afrotyphlops": 0.4,
    "amerotyphlops": 0.25, "ramphotyphlops": 0.25, "anilios": 0.3, "myriopholis": 0.2, "leptotyphlops": 0.2, "epictia": 0.2, "rena": 0.2,
    "tricheilostoma": 0.2, "trilepida": 0.2, "liotyphlops": 0.25, "typhlops": 0.3, "xerotyphlops": 0.3, "letheobia": 0.3, "gerrhopilus": 0.2,
}
FAM_LEN = {"Typhlopidae": 0.25, "Leptotyphlopidae": 0.18, "Anomalepididae": 0.2, "Gerrhopilidae": 0.2, "Xenotyphlopidae": 0.25, "Uropeltidae": 0.3,
           "Cylindrophiidae": 0.5, "Aniliidae": 0.7, "Anomochilidae": 0.4, "Tropidophiidae": 0.45, "Pareidae": 0.5, "Xenodermidae": 0.5,
           "Atractaspididae": 0.5, "Prosymnidae": 0.3, "Psammophiidae": 1.0, "Pseudoxyrhophiidae": 0.7, "Lamprophiidae": 0.7, "Homalopsidae": 0.7,
           "Acrochordidae": 1.5, "Pseudaspididae": 1.3, "Bolyeriidae": 1.0, "Xenopeltidae": 1.0, "Loxocemidae": 1.2, "Xenophidiidae": 0.3,
           "Madtsoiidae": 4.0, "Simoliophiidae": 1.0, "Palaeophiidae": 3.0, "Parviraptoridae": 0.3, "Nigerophiidae": 0.8, "Dinilysiidae": 2.0,
           "Lapparentophiidae": 0.8}
TYPE_LEN = {"Colubrid": 0.8, "Other": 0.6, "Pit Viper": 0.9, "Elapid": 1.0, "Watersnake": 0.8, "Viper": 0.6, "Boa": 1.5, "Sea Snake": 1.1, "Python": 2.5, "Cobra": 1.6}
KEELED_GENERA = {"natrix", "nerodia", "thamnophis", "pituophis", "regina", "storeria", "virginia", "rhabdophis", "hebius", "amphiesma", "fowlea", "xenochrophis",
                 "sinonatrix", "tropidonophis", "atretium", "macropisthodon", "dasypeltis", "heterodon", "arizona", "drymarchon", "spilotes", "zamenis",
                 "elaphe", "pantherophis", "lampropeltis", "opisthotropis", "afronatrix", "limnophis", "hydraethiops", "grayia", "acrochordus", "helicops"}
# usual colours for a group when there is no photo (main, pattern, belly)
GROUP_COLS = {"python": ("#6e5c3e", "#2e2416", "#d9cfae"), "viper": ("#8a7656", "#3a2c1c", "#d6c8a8"), "pitviper": ("#7d6a4c", "#33281a", "#d7c9a6"),
              "elapid": ("#5d5649", "#2a251d", "#cfc6ae"), "sea": ("#7e8a8c", "#262a2c", "#e3dfcc"), "blind": ("#6b5144", "#3b2a22", "#9a8070"),
              "colubrid": ("#73654c", "#3a3022", "#d8ccac"), "fossil": ("#7a6a52", "#4a3e2e", "#cdbf9f")}


def hx(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
def hexc(rgb): return "#%02x%02x%02x" % tuple(int(max(0, min(1, v)) * 255 + 0.5) for v in rgb)
def lum(h): r, g, b = hx(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def tone(h, l=1.0, s=1.0):
    r, g, b = hx(h); H, L, S = colorsys.rgb_to_hls(r, g, b); return hexc(colorsys.hls_to_rgb(H, max(0, min(1, L * l)), max(0, min(1, S * s))))
def mix(a, b, t): A, B = hx(a), hx(b); return hexc(tuple(A[i] + (B[i] - A[i]) * t for i in range(3)))


def plan_of(c):
    g, f, t = c["genus"].lower(), c["family"], c["type"]
    if t == "Sea Snake" or g in SEA_GENERA: return "sea"
    if f == "Viperidae": return "pitviper" if t == "Pit Viper" else "viper"
    if t == "Pit Viper": return "pitviper"
    if t == "Viper": return "viper"
    if f in PLAN_FAM: return PLAN_FAM[f]
    if t in ("Python", "Boa"): return "python"
    if t in ("Elapid", "Cobra"): return "elapid"
    return "colubrid"


def length_of(c, lm, fossil_len):
    if lm: return round((lm[0] + lm[1]) / 2, 2), False
    if c["id"] in fossil_len: return fossil_len[c["id"]], False
    g = c["genus"].lower()
    if g in GENUS_LEN: return GENUS_LEN[g], True
    if c["family"] in FAM_LEN: return FAM_LEN[c["family"]], True
    return TYPE_LEN.get(c["type"], 0.8), True


def pattern_of(c, plan, con):
    n, g = (c["name"] if not c["is_sci"] else "").lower(), c["genus"].lower()
    if re.search(r"coral", n) or g in ("micrurus", "micruroides", "leptomicrurus", "sinomicrurus", "calliophis"): return "coral"
    if g == "crotalus" or re.search(r"diamond|rattle", n): return "diamond"
    if re.search(r"collared|ring-?necked|ringneck|necked|hooded", n): return "collar"
    if re.search(r"ringed|banded|band|annulat|zebra|barred|tiger|krait", n) or g in ("bungarus", "laticauda", "lampropeltis", "hydrophis", "aspidelaps", "vermicella", "simoselaps"): return "band"
    if re.search(r"striped|stripe|lined|ribbon|garter|line", n) or g in ("thamnophis", "psammophis", "coniophanes", "lygophis", "tachymenis"): return "stripe"
    if re.search(r"spotted|leopard|dotted|speckled|ocellat|freckle|pearl|jewel|flower", n): return "spot"
    if re.search(r"saddle|blotch|mosaic|checker|chequer|tessellat|carpet|rock python|cat|chain", n): return "blotch"
    if g in ("vipera", "pelias") or re.search(r"zigzag|adder", n) and plan == "viper": return "zigzag"
    if g == "bitis": return "chevron"
    if g in ("bothrops", "porthidium", "bothrocophias", "atropoides", "metlapilcoatlus", "agkistrodon", "gloydius", "deinagkistrodon", "calloselasma", "cerrophidion", "lachesis"): return "hourglass"
    if g in ("daboia", "echis"): return "spot"
    if g in ("python", "morelia", "boa", "epicrates", "chilabothrus", "eryx", "pantherophis", "elaphe", "zamenis", "pituophis", "acrantophis", "sanzinia", "liasis", "simalia", "malayopython"): return "blotch"
    if g in ("dendroaspis", "naja", "ophiophagus", "oxyuranus", "pseudonaja", "pseudechis", "ahaetulla", "philothamnus", "dispholidus", "drymarchon", "coluber", "masticophis", "ptyas"): return "plain"
    if plan == "blind": return "plain"
    if plan == "sea": return "band"
    if con >= 0.45: return "blotch" if plan in ("python", "viper", "pitviper") else "saddle"
    if con >= 0.25: return "speckle"
    return "plain"


def scene_of(c, plan, kinds):
    t, g, f = c["type"], c["genus"].lower(), c["family"]
    if plan == "sea": return "sea"
    if g in ("titanoboa", "eunectes", "gigantophis", "palaeophis"): return "riverbank"  # giant snakes of rivers and swamps
    if t == "Watersnake" or f in ("Homalopsidae", "Acrochordidae") or g in ("natrix", "nerodia", "helicops", "hydrops", "sinonatrix", "opisthotropis", "regina", "afronatrix", "grayia"): return "riverbank"
    if plan == "blind" or f in ("Uropeltidae", "Atractaspididae", "Prosymnidae", "Anomochilidae", "Xenophidiidae") or g in ("calamaria", "tantilla", "geophis", "atractus", "apostolepis", "pseudorabdion", "carphophis", "virginia", "sonora", "ninia"): return "soil"
    if g in ("cerastes", "eryx", "pseudocerastes", "eristicophis", "chionactis", "phyllorhynchus", "lytorhynchus", "spalerosophis", "psammophis", "rhamphiophis", "echis"): return "sand"
    if not kinds: return "litter"
    tot = float(sum(kinds.values())) or 1.0
    sh = lambda *ks: sum(kinds.get(k, 0) for k in ks) / tot
    aus = set(c["countries"]) <= {"Australia"} and c["countries"]
    if sh("Deserts & dunes") >= 0.2: return "gibber" if aus else "arid"
    if aus and sh("Savannas & grasslands", "Shrublands & heath", "Deserts & dunes") >= 0.4: return "gibber"
    if sh("Rainforests") >= 0.3: return "rainforest"
    if sh("Savannas & grasslands") >= 0.25: return "grass"
    if sh("Shrublands & heath") >= 0.2: return "heath"
    if sh("Wetlands & swamps", "Rivers & lakes") >= 0.3: return "riverbank"
    if sh("Mountains & rocks") >= 0.3: return "arid"
    return "forest"


REGIONLESS = {"Rainforests", "Forests & woodlands", "Savannas & grasslands", "Shrublands & heath", "Deserts & dunes", "Mountains & rocks",
              "Underground & forest floor", "Wetlands & swamps", "Rivers & lakes", "Coasts & sea", "Around people"}


def build(cards, lengths, hab_kind, existing, hab_sec=None):
    """cards: the app's cards (build_species); lengths: id -> (lo, hi) from reviewed accounts;
    existing: the hand-made profiles (kept). Returns id -> generated entry."""
    cols = json.load(open(os.path.join(ROOT, "data/snake-model-colours.json"), encoding="utf-8"))
    fossil_len = {x["id"]: x["length_m"] for x in json.load(open(os.path.join(ROOT, "data/fossil-additions.json"), encoding="utf-8")) if x.get("length_m")}
    out = {}
    for c in cards:
        if c["id"] in existing: continue
        plan = plan_of(c)
        L, typical = length_of(c, lengths.get(c["id"]), fossil_len)
        cc = None if c["fossil"] else cols.get(c["id"])
        flags = ("f" if c["fossil"] else "") + ("e" if c["extinct"] and not c["fossil"] else "") + ("l" if typical else "")
        gd, gp, gb = GROUP_COLS["fossil" if c["fossil"] else plan]
        if cc and cc["q"] >= 0.3:
            d = cc["d"]
            if cc["q"] < 0.6: d = mix(d, gd, 0.35)  # not sure the photo shows mostly snake: lean toward its group's colour
            p = cc["p"] or (tone(d, 0.45) if lum(d) > 0.18 else tone(d, 1.9, 0.7))
            con = cc["c"]
        else:
            d, p, con = gd, gp, 0.3; flags += "g"
        t = pattern_of(c, plan, con)
        # the belly: paler and less coloured than the back (a dark snake keeps a darker belly)
        b = mix(tone(d, 1.45 if lum(d) < 0.5 else 1.1, 0.55), "#e6dcc4", 0.35) if plan != "blind" else tone(d, 1.2, 0.8)
        if t == "coral": d, p, b = "#b3352a", "#141110", "#c9463a"
        if c["fossil"]: t = {"band": "blotch", "stripe": "blotch", "coral": "blotch"}.get(t, t) if t != "plain" else "blotch"
        # how dark marks are against the main colour: always visible, never black-on-black
        if t not in ("plain", "coral") and abs(lum(p) - lum(d)) < 0.08: p = tone(d, 0.5) if lum(d) > 0.2 else tone(d, 2.2, 0.6)
        n = max(14, min(70, int(round(22 + (L ** 0.3) * 14))))
        kinds = {}
        for h in c.get("habitats", []):
            # habitats named after a region (Kalahari Desert, Amazon Rainforest...) say more about where it lives
            k = hab_kind(h); kinds[k] = kinds.get(k, 0) + (3 if hab_sec and hab_sec(h) not in (None, "") and hab_sec(h) not in REGIONLESS else 1)
        keel = 1 if plan in ("viper", "pitviper") or c["genus"].lower() in KEELED_GENERA else 0
        a = {"p": plan, "L": round(L, 2), "d": d, "c": p, "b": b, "t": t, "n": n, "s": scene_of(c, plan, kinds), "k": keel}
        if flags: a["x"] = flags
        if c["family"] == "Uropeltidae" or c["family"] == "Cylindrophiidae" or c["family"] == "Aniliidae": a["o"] = 1  # short blunt tail
        out[c["id"]] = {"name": c["sci"] if c["is_sci"] else c["name"], "auto": a}
    return out
