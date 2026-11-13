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


def is_green(h):
    r, g, b = hx(h); H, L, S = colorsys.rgb_to_hls(r, g, b)
    return 70 / 360 <= H <= 170 / 360 and S >= 0.22 and 0.12 <= L <= 0.85


def pattern_of(c, plan, con, green=False):
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
    # v4.81: a green snake is plain green unless its name or genus says otherwise - the leaves round it in its
    # photo used to be read as blotches (smooth green snake, green tree python)
    if green: return "plain"
    if con >= 0.5: return "blotch" if plan in ("python", "viper", "pitviper") else "saddle"
    if con >= 0.3: return "speckle"
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


# v4.81: hand-checked looks for well-known species that have no hand-made profile in data/snake-models.json, each
# compared with its SnakeList photo and field guides. Keys override the generated entry; extra keys that
# viewer.js autoProfile understands: h head (iris, irisInner, irisDark, pupil round/slit/hslit, eyeRing, eyeStripe,
# horns, len, w, snout...), cx colours (bellyA, speckle, scaleEdge, mottle), sx scales (gloss, keel, iridescence),
# bx body (ld = slenderness...), lat flank colour, lip upper-lip colour, ls [colour, around, width] flank stripe,
# vs [colour, width] stripe along the spine, tt tail-tip colour, hc head colour, oc spot-centre colour, pat extra layers.
DARK_EYE = {"irisDark": 1, "pupil": "round"}
CURATED = {
    "opheodrys-vernalis": {"d": "#5aa832", "lat": "#6db53c", "b": "#ece9b0", "t": "plain", "s": "grass", "L": 0.5, "k": 0, "lip": "#e2e6a8", "sp": {"grassA": "#55803a", "grassB": "#9ab860"},
                           "h": dict(DARK_EYE, iris="#1d1d14", irisInner="#34341f", eyeRing="#cfd09a", pupilW=0.25, eye=0.18), "sx": {"gloss": 0.62}, "cx": {"bellyA": 0.7, "mottle": 0.04, "var": 0.03}},
    "opheodrys-aestivus": {"d": "#76b13a", "lat": "#86bd45", "b": "#e7e9a8", "t": "plain", "s": "forest", "L": 0.75, "k": 1, "lip": "#e2e6a8",
                           "h": dict(DARK_EYE, iris="#1d1d14", irisInner="#34341f", eyeRing="#cfd09a", pupilW=0.25, eye=0.18), "bx": {"ld": 62}, "sx": {"gloss": 0.45}, "cx": {"bellyA": 0.7, "mottle": 0.04}},
    "morelia-viridis": {"d": "#4fa82c", "lat": "#5ab232", "b": "#e4e46a", "c": "#f3f6dc", "t": "vert", "n": 40, "s": "rainforest",
                        "h": {"iris": "#b6b49c", "irisInner": "#dad6bc", "pupil": "slit"}, "sx": {"gloss": 0.6, "iridescence": 0.1}, "cx": {"bellyA": 0.76, "mottle": 0.05}},
    "corallus-caninus": {"d": "#24903a", "lat": "#2c9a3e", "b": "#f0d838", "c": "#f2f5e6", "t": "crossbar", "n": 30, "s": "rainforest",
                         "h": {"iris": "#8ea07a", "irisInner": "#c8d0a8", "pupil": "slit"}, "sx": {"gloss": 0.55}, "cx": {"bellyA": 0.8, "mottle": 0.05}},
    "trimeresurus-albolabris": {"d": "#5fb53a", "lat": "#74c246", "b": "#dbeaaf", "t": "plain", "lip": "#eef3d2", "ls": ["#e6efc0", 0.56, 0.022], "tt": "#a65a32",
                                "h": {"iris": "#d6b74a", "irisInner": "#efd77a"}, "cx": {"mottle": 0.05}},
    "trimeresurus-stejnegeri": {"d": "#58ab38", "lat": "#68b644", "b": "#d6e6a2", "t": "plain", "ls": ["#f0efd0", 0.57, 0.03], "tt": "#b0452a",
                                "h": {"iris": "#c84a3a", "irisInner": "#e8735c"}, "cx": {"mottle": 0.05}},
    "bothriechis-schlegelii": {"d": "#7d7f58", "c": "#3d3b2a", "b": "#c8c49a", "t": "spot", "s": "rainforest",
                               "h": {"horns": "supraocular", "hornColor": "#8a8a60", "iris": "#b0573a", "irisInner": "#d98a5e"}, "cx": {"mottle": 0.14, "speckle": {"p": 0.12, "color": "#3a3626", "k": 0.5}}},
    "atheris-squamigera": {"d": "#6c9a2a", "lat": "#77a431", "b": "#bfd36c", "c": "#a8c24a", "t": "band", "n": 30, "s": "rainforest",
                           "h": {"iris": "#b8b060", "irisInner": "#dcd488"}, "sx": {"keel": 1, "gloss": 0.15}},
    "ahaetulla-nasuta": {"d": "#58b23e", "lat": "#6cc04a", "b": "#a9d77c", "t": "plain", "ls": ["#e8efb0", 0.72, 0.02], "s": "rainforest", "L": 1.2,
                         "bx": {"ld": 95, "neck": 0.9}, "h": {"pupil": "hslit", "iris": "#d2c27a", "irisInner": "#efe2a0", "len": 0.04, "snout": 0.4, "tip": 0.3}},
    "ahaetulla-prasina": {"d": "#5aae3c", "lat": "#6cbc48", "b": "#b2d88a", "t": "plain", "ls": ["#e8efb0", 0.72, 0.02], "s": "rainforest", "L": 1.3,
                          "bx": {"ld": 95, "neck": 0.9}, "h": {"pupil": "hslit", "iris": "#d2c27a", "irisInner": "#efe2a0", "len": 0.04, "snout": 0.4, "tip": 0.3}},
    "dispholidus-typus": {"d": "#5a962c", "lat": "#68a336", "b": "#b8d26a", "t": "plain", "s": "forest",
                          "h": {"iris": "#7ab84c", "irisInner": "#acd87c", "pupil": "round", "pupilW": 0.16, "eye": 0.24}, "cx": {"scaleEdge": {"color": "#1d2a10", "k": 0.55}}},
    "leptophis-ahaetulla": {"d": "#4cab3a", "lat": "#5ab646", "b": "#c8e0a0", "t": "plain", "vs": ["#b08a3a", 0.06], "s": "rainforest", "bx": {"ld": 80},
                            "h": {"iris": "#d6b84a", "irisInner": "#efd77a"}, "pat": [{"type": "line", "p0": [0.0, 0.36], "p1": [1.25, 0.44], "wid": 0.03, "color": "#121110", "mirror": True}]},
    "naja-naja": {"d": "#a67b45", "lat": "#b08550", "b": "#e6d7b5", "t": "plain", "s": "grass",
                  "h": dict(DARK_EYE, iris="#2e2218", irisInner="#4a3624"), "sx": {"gloss": 0.5}, "cx": {"mottle": 0.06},
                  "pat": [{"type": "band", "t": [0.085, 0.16], "count": 2, "len": 0.45, "color": "#3a2818", "alpha": 0.75, "warp": 0.2}]},
    "naja-nivea": {"d": "#c4953a", "lat": "#c99c44", "b": "#ecd69c", "t": "plain", "s": "arid", "h": dict(DARK_EYE, iris="#2e2218", irisInner="#4a3624"), "sx": {"gloss": 0.55}},
    "eunectes-murinus": {"d": "#4b5230", "lat": "#66683a", "b": "#cbb968", "c": "#15130e", "oc": "#e0a443", "t": "ocelli", "n": 46, "s": "riverbank",
                         "h": {"iris": "#6a5a35", "irisInner": "#a08a50", "pupil": "slit"}, "sx": {"gloss": 0.55, "iridescence": 0.15}, "cx": {"bellyA": 0.82},
                         "pat": [{"type": "line", "p0": [0.32, 0.3], "p1": [1.5, 0.42], "wid": 0.04, "color": "#d8892e", "mirror": True}, {"type": "line", "p0": [0.32, 0.22], "p1": [1.5, 0.33], "wid": 0.03, "color": "#15130e", "mirror": True}]},
    "thamnophis-sirtalis": {"d": "#2a2a22", "lat": "#36322a", "b": "#d3cb9c", "c": "#121110", "t": "plain", "vs": ["#e4cf62", 0.045], "ls": ["#e8d77a", 0.55, 0.045], "k": 1,
                            "h": {"iris": "#c8a050", "irisInner": "#e6c878"}, "pat": [{"type": "blotch", "count": 70, "a": 0.3, "mirror": True, "alt": True, "wid": 0.07, "len": 0.35, "shape": "rect", "color": "#121110", "alpha": 0.8, "t": [0.06, 0.95]}]},
    "cerastes-cerastes": {"d": "#d8bf93", "lat": "#dbc49c", "b": "#efe6d0", "c": "#a88a62", "t": "blotch", "s": "sand",
                          "h": {"horns": "supraocular", "hornColor": "#cdb48a", "iris": "#b8a070", "irisInner": "#dcc89a"}, "cx": {"mottle": 0.14, "speckle": {"p": 0.12, "color": "#9a7c58", "k": 0.5}}},
    "natrix-natrix": {"d": "#6e6a4c", "lat": "#77704f", "b": "#d8d2bf", "c": "#f0c23a", "t": "collar2", "k": 1, "s": "riverbank",
                      "h": {"iris": "#d0a040", "irisInner": "#ecc870", "pupil": "round"}, "cx": {"bellyA": 0.76}},
    "morelia-spilota": {"d": "#7a6a40", "c": "#2e2618", "b": "#e2d6a6", "t": "blotch", "n": 44},
    "python-molurus": {"d": "#c2a77a", "c": "#5a4228", "b": "#e8dcc0", "t": "blotch", "n": 38},
    "liasis-olivaceus": {"d": "#6a5e36", "b": "#e8dcb8", "t": "plain", "sx": {"gloss": 0.6, "iridescence": 0.3}},
    "pseudechis-porphyriacus": {"d": "#131315", "lat": "#1a1718", "b": "#d4544a", "t": "plain", "s": "riverbank", "sx": {"gloss": 0.85},
                                "h": dict(DARK_EYE, iris="#1a1412", irisInner="#2e2420"), "cx": {"bellyA": 0.62, "bellySharp": 0.08},
                                "pat": [{"type": "tint", "t": [0.04, 1], "ramp": 0.02, "aRange": [0.56, 1], "color": "#cf4a3e", "alpha": 0.9}]},
    "pseudonaja-textilis": {"d": "#8a6a45", "lat": "#91724c", "b": "#e7cf8a", "t": "plain", "h": dict(DARK_EYE, iris="#3a2618", irisInner="#5a3c22", eyeRing="#c8762e")},
    "oxyuranus-scutellatus": {"d": "#7a5a3a", "lat": "#86663f", "b": "#e9dcae", "t": "plain", "hc": "#c9b48c", "hcx": 0.45, "h": dict(DARK_EYE, iris="#5a4430", irisInner="#7a5c40")},
    "laticauda-colubrina": {"d": "#7d93a8", "lat": "#8aa0b2", "b": "#e6dc96", "c": "#121214", "t": "band", "n": 40, "lip": "#e6d36a", "h": dict(DARK_EYE, iris="#1a1a1c", irisInner="#2a2a30")},
    "drymarchon-couperi": {"d": "#141821", "lat": "#1b2030", "b": "#2a3040", "t": "plain", "sx": {"gloss": 0.9, "iridescence": 0.6}, "lip": "#a8503a", "h": dict(DARK_EYE, iris="#1a1614", irisInner="#2a2220")},
    "lampropeltis-elapsoides": {"d": "#f0da66", "c": "#c8302a", "b": "#efe2b0", "t": "tricolor", "n": 36, "k": 0, "hc": "#c8302a", "hcx": 0.75},
    "xenopeltis-unicolor": {"d": "#3a2a24", "lat": "#3d2e28", "b": "#e6e2d6", "t": "plain", "sx": {"gloss": 1, "iridescence": 1}, "h": dict(DARK_EYE, iris="#2a1e18", irisInner="#3e2c22")},
    "acanthophis-antarcticus": {"d": "#8a6e5a", "c": "#5a4234", "b": "#e3d6c0", "t": "band", "n": 50, "tt": "#e8dcc0", "bx": {"ld": 14, "neck": 0.5, "tail": 0.11}, "h": {"pupil": "slit", "iris": "#b9915a", "irisInner": "#dcb880", "w": 1.3}},
    "aspidites-ramsayi": {"d": "#d7964a", "c": "#8a5428", "b": "#f0e2c0", "t": "band", "n": 50, "hc": "#e2b070", "h": {"iris": "#5a3a22", "irisInner": "#7a5432"}},
    "boiga-dendrophila": {"d": "#141414", "lat": "#181816", "c": "#f0d040", "b": "#2c2c26", "t": "band", "n": 44, "lip": "#f2d84a", "h": {"iris": "#2a2018", "irisInner": "#3a2c20", "irisDark": 1, "pupil": "slit"}, "sx": {"gloss": 0.75}},
    "hierophis-viridiflavus": {"d": "#1b1d16", "lat": "#1f2118", "c": "#c9c24a", "b": "#d8d4a0", "t": "plain", "cx": {"speckle": {"p": 0.5, "color": "#c9c24a", "k": 0.75}}, "h": {"iris": "#7a6a3a", "irisInner": "#b49a50"}},
    "calloselasma-rhodostoma": {"d": "#b9805a", "c": "#5a2e1e", "t": "hourglass", "vs": ["#4a2618", 0.03], "h": {"iris": "#a07040", "irisInner": "#c8985a"}},
    "crotalus-scutulatus": {"d": "#a39a6c", "c": "#5a4a32", "b": "#e2dcc0", "t": "diamond"},
    "crotalus-viridis": {"d": "#8d8a60", "c": "#4a3d26", "b": "#e2dcc0", "t": "diamond"},
    "crotalus-oreganus": {"d": "#7a6650", "c": "#3e3024", "b": "#e2d8c4", "t": "diamond"},
    "tropidolaemus-wagleri": {"d": "#2f8a2a", "lat": "#3a942e", "c": "#e6dc5a", "b": "#c8d880", "t": "band", "n": 36, "h": {"iris": "#c8b040", "irisInner": "#e6d070"}},
    "pituophis-catenifer": {"d": "#d0b47a", "lat": "#c9ad75", "b": "#efe2c2", "c": "#3b2a1a", "t": "blotch", "n": 50, "k": 1, "s": "grass", "h": {"iris": "#b08850", "irisInner": "#d0aa70"}},
    "sistrurus-miliarius": {"d": "#8a7a6a", "c": "#2a2420", "b": "#e2d8c8", "t": "spot", "vs": ["#c26a3a", 0.035]},
    "bothrops-atrox": {"d": "#8a7a5a", "c": "#3a2e20", "b": "#ddd2b6"},
    "chrysopelea-ornata": {"d": "#8fb03a", "lat": "#98b844", "c": "#141a0c", "b": "#d8e0a0", "t": "band", "n": 60, "cx": {"scaleEdge": {"color": "#141a0c", "k": 0.7}}},
}


# (Gaboon viper: the purple was too strong and the head too pale; a darker, warmer iris)
HAND_FIXES = {
    "bitis-gabonica": [(("head", "iris"), "#b49f74"), (("head", "irisInner"), "#d6c8a2"), (("pattern", 2, "color"), "#634842"),
                       (("pattern", 2, "inner", "color"), "#8a6a58"), (("pattern", 5, "color"), "#b8a079")],
}


REGIONLESS = {"Rainforests", "Forests & woodlands", "Savannas & grasslands", "Shrublands & heath", "Deserts & dunes", "Mountains & rocks",
              "Underground & forest floor", "Wetlands & swamps", "Rivers & lakes", "Coasts & sea", "Around people"}


def build(cards, lengths, hab_kind, existing, hab_sec=None):
    """cards: the app's cards (build_species); lengths: id -> (lo, hi) from reviewed accounts;
    existing: the hand-made profiles (kept). Returns id -> generated entry."""
    cols = json.load(open(os.path.join(ROOT, "data/snake-model-colours.json"), encoding="utf-8"))
    fossil_len = {x["id"]: x["length_m"] for x in json.load(open(os.path.join(ROOT, "data/fossil-additions.json"), encoding="utf-8")) if x.get("length_m")}
    # v4.81: colour fixes for hand-made profiles, applied here so data/snake-models.json stays as reviewed
    for sid, fix in HAND_FIXES.items():
        prof = existing.get(sid)
        if prof:
            for path, val in fix:
                o = prof
                for k in path[:-1]: o = o[k]
                o[path[-1]] = val
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
        green = is_green(d)
        if green and lum(d) < 0.55:  # photos make green snakes look dull and olive: a living green snake is vivid
            d = tone(d, 1.12, 1.35)
        t = pattern_of(c, plan, con, green)
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
        g = c["genus"].lower()
        if g in ("crotalus", "sistrurus"): a["tl"] = {"rattle": 7 if g == "crotalus" else 5}
        if c["id"] in CURATED:  # v4.81: hand-checked against its photo
            a.update(CURATED[c["id"]]); a["x"] = a.get("x", "").replace("g", "").replace("l", "" if "L" in CURATED[c["id"]] else "l")
            if not a["x"]: a.pop("x")
        if c["family"] == "Uropeltidae" or c["family"] == "Cylindrophiidae" or c["family"] == "Aniliidae": a["o"] = 1  # short blunt tail
        out[c["id"]] = {"name": c["sci"] if c["is_sci"] else c["name"], "auto": a}
    return out
