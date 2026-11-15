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
# v5.18: dorsal scale rows at mid-body (typical for the genus) - this sets the size of the scales against the body
GENUS_ROWS = {
    "opheodrys": 15, "micrurus": 15, "micruroides": 15, "calliophis": 13, "sinomicrurus": 13, "leptomicrurus": 15, "tantilla": 15, "sonora": 15, "carphophis": 13,
    "diadophis": 15, "storeria": 15, "virginia": 17, "calamaria": 13, "pseudorabdion": 15, "geophis": 15, "atractus": 17, "ninia": 19, "coluber": 17,
    "masticophis": 17, "dendroaspis": 19, "dendrelaphis": 15, "ahaetulla": 15, "chrysopelea": 17, "oxybelis": 17, "leptophis": 15, "philothamnus": 15,
    "dispholidus": 19, "thelotornis": 19, "imantodes": 17, "dipsas": 15, "sibon": 15, "chironius": 12, "drymobius": 17, "dendrophidion": 17,
    "thamnophis": 19, "natrix": 19, "nerodia": 25, "regina": 19, "hebius": 19, "rhabdophis": 19, "fowlea": 19, "lycodon": 17, "oligodon": 17,
    "boiga": 21, "pantherophis": 27, "elaphe": 25, "zamenis": 23, "orthriophis": 25, "euprepiophis": 21, "gonyosoma": 21, "ptyas": 17, "lampropeltis": 23,
    "pituophis": 29, "arizona": 29, "heterodon": 25, "coronella": 19, "hierophis": 19, "platyceps": 19, "malpolon": 19, "psammophis": 17, "dasypeltis": 25,
    "boaedon": 27, "naja": 21, "ophiophagus": 15, "bungarus": 15, "pseudechis": 17, "pseudonaja": 17, "oxyuranus": 23, "notechis": 17, "acanthophis": 21,
    "demansia": 15, "hoplocephalus": 21, "laticauda": 23, "hydrophis": 37, "aipysurus": 19, "emydocephalus": 17,
    "crotalus": 25, "sistrurus": 23, "agkistrodon": 23, "bothrops": 27, "bothriechis": 21, "lachesis": 35, "trimeresurus": 21, "protobothrops": 25,
    "gloydius": 21, "calloselasma": 21, "deinagkistrodon": 21, "craspedocephalus": 19, "tropidolaemus": 25, "vipera": 21, "macrovipera": 25,
    "daboia": 29, "bitis": 33, "echis": 29, "cerastes": 31, "atheris": 21, "causus": 19, "pseudocerastes": 25, "montivipera": 23, "azemiops": 17,
    "python": 65, "malayopython": 71, "morelia": 50, "simalia": 45, "liasis": 50, "antaresia": 41, "aspidites": 55, "leiopython": 45,
    "boa": 75, "eunectes": 60, "epicrates": 47, "chilabothrus": 45, "corallus": 50, "eryx": 45, "charina": 45, "lichanura": 41,
    "candoia": 35, "xenopeltis": 15, "cylindrophis": 21, "anilius": 21, "uropeltis": 17, "rhinophis": 17,
}
GENUS_KIND = {"acrochordus": ("juxta", 140), "xenopeltis": ("cycloid", 15)}


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


# v5.12: genera whose species are green in life (unless their name says otherwise)
GREEN_IN_LIFE = {"ahaetulla", "philothamnus", "hapsidophrys", "opheodrys", "trimeresurus", "gonyosoma", "rhadinophis", "cyclophiops", "uromacer", "leptophis", "rhamnophis", "viridovipera", "popeia", "chlorosoma", "dendrophidion"}


def is_green(h):
    r, g, b = hx(h); H, L, S = colorsys.rgb_to_hls(r, g, b)
    return 70 / 360 <= H <= 170 / 360 and S >= 0.22 and 0.12 <= L <= 0.85


def pattern_of(c, plan, con, green=False):
    n, g = (c["name"] if not c["is_sci"] else "").lower(), c["genus"].lower()
    # v5.12: "coral snake" in Australia and Africa (Brachyurophis, Aspidelaps) is plain or banded, not red-black-yellow
    if g in ("micrurus", "micruroides", "leptomicrurus", "sinomicrurus", "calliophis") or (re.search(r"coral", n) and set(c.get("continents", [])) & {"North America", "South America"}): return "coral"
    # v5.20: genus by genus, from photos of each group
    if g in ("crotalus", "sistrurus"):
        if c["id"] in ("crotalus-adamanteus", "crotalus-atrox", "crotalus-ruber", "crotalus-scutulatus", "crotalus-tortugensis", "crotalus-exsul", "crotalus-catalinensis") or re.search(r"diamond", n): return "diamond"
        if c["id"] in ("crotalus-horridus",): return "chevron"
        # v5.21: the banded montane rattlesnakes, the speckled ones, the rest blotched
        if c["id"].split("-")[1] in ("lepidus", "klauberi", "morulus", "transversus", "aquilus", "pusillus", "tancitarensis", "intermedius", "pricei", "willardi", "triseriatus", "ravus"): return "xband"
        if c["id"].split("-")[1] in ("mitchellii", "stephensi", "pyrrhus", "angelensis", "tigris", "polisi"): return "xband"  # (with speckling, added below)
        return "rblotch"
    if g == "daboia": return "daboia"
    # v5.21: more groups, from photos
    if g in ("pantherophis", "zamenis", "pseudelaphe") or (g == "elaphe" and not re.search(r"strip|lined|four", n)): return "esaddle"
    if g in ("epicrates",): return "rings"
    if g in ("boa",): return "boa"
    if g == "eunectes": return "ocelli"
    if g in ("dipsas", "sibon", "tropidodipsas", "imantodes", "acanthophis", "causus") and not green: return "xband"
    if g == "atractus" and not re.search(r"band|ring|spot|strip|line", n): return "xband" if con >= 0.35 else "plain"  # ground snakes: plain, or crossbanded when the photo shows contrast
    if g == "echis": return "echis"
    if g == "thamnophis": return "garter"
    if g == "nerodia" and not green: return "band"
    if g == "tantilla": return "plain"
    if g == "natrix" and c["id"] != "natrix-natrix": return "spot"
    if g == "coronella": return "spot"
    if re.search(r"diamond", n): return "diamond"
    if re.search(r"rattle", n): return "rblotch"
    if re.search(r"collared|ring-?necked|ringneck|necked|hooded", n): return "collar"
    # v5.12: prairie and mole kingsnakes are blotched, not ringed
    if c["id"] in ("lampropeltis-calligaster", "lampropeltis-occipitolineata", "lampropeltis-rhombomaculata"): return "blotch"
    # v5.12: wolf snakes (Lycodon) are usually cross-banded (black and white or yellow) when their photo shows clear contrast
    if g in ("lycodon", "dryocalamus") and con >= 0.3: return "band"
    if re.search(r"ringed|banded|band|annulat|zebra|barred|tiger|krait", n) or g in ("bungarus", "laticauda", "lampropeltis", "hydrophis", "aspidelaps", "vermicella", "simoselaps"): return "band"
    if re.search(r"striped|stripe|lined|ribbon|garter|line", n) or g in ("thamnophis", "psammophis", "coniophanes", "lygophis", "tachymenis"): return "stripe"
    if re.search(r"spotted|leopard|dotted|speckled|ocellat|freckle|pearl|jewel|flower", n): return "spot"
    if re.search(r"saddle|blotch|mosaic|checker|chequer|tessellat|carpet|rock python|cat|chain", n): return "blotch"
    if g in ("vipera", "pelias") or re.search(r"zigzag|adder", n) and plan == "viper": return "zigzag"
    if g == "bitis": return "chevron"
    # v5.19: copperheads and cottonmouths: crossbands narrow over the spine, wide on the flanks; the getula-group kingsnakes: a chain
    if g == "agkistrodon": return "hourglass2"
    if c["id"] in ("lampropeltis-getula", "lampropeltis-floridana", "lampropeltis-meansi", "lampropeltis-nigrita"): return "chain"
    if g == "malayopython": return "net"
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
    tot0 = float(sum(kinds.values())) or 1.0
    desert = sum(kinds.get(k, 0) for k in ("Deserts & dunes",)) / tot0
    if plan == "sea": return "sea"
    if g in ("titanoboa", "eunectes", "gigantophis", "palaeophis"): return "riverbank"  # giant snakes of rivers and swamps
    if t == "Watersnake" or f in ("Homalopsidae", "Acrochordidae") or g in ("natrix", "nerodia", "helicops", "hydrops", "sinonatrix", "opisthotropis", "regina", "afronatrix", "grayia"): return "riverbank"
    if plan == "blind" or f in ("Uropeltidae", "Atractaspididae", "Prosymnidae", "Anomochilidae", "Xenophidiidae") or g in ("calamaria", "tantilla", "geophis", "atractus", "apostolepis", "pseudorabdion", "carphophis", "virginia", "sonora", "ninia"):
        return "arid" if desert >= 0.2 else "soil"  # v5.12: burrowers of deserts live under sand and stones, not forest soil
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
    # v5.12: rocky mountains are dry ground unless they are mostly forested (Himalayan and Chinese mountain forests)
    if sh("Mountains & rocks") >= 0.3 and sh("Forests & woodlands", "Rainforests") < 0.3: return "arid"
    return "forest"


# v4.81: hand-checked looks for well-known species that have no hand-made profile in data/snake-models.json, each
# compared with its SnakeList photo and field guides. Keys override the generated entry; extra keys that
# viewer.js autoProfile understands: h head (iris, irisInner, irisDark, pupil round/slit/hslit, eyeRing, eyeStripe,
# horns, len, w, snout...), cx colours (bellyA, speckle, scaleEdge, mottle), sx scales (gloss, keel, iridescence),
# bx body (ld = slenderness...), lat flank colour, lip upper-lip colour, ls [colour, around, width] flank stripe,
# vs [colour, width] stripe along the spine, tt tail-tip colour, hc head colour, oc spot-centre colour, pat extra layers.
DARK_EYE = {"irisDark": 1, "pupil": "round"}
CURATED = {
    # v5.09: smooth green snake - small (adults 30-50 cm), slender, plain grass green, pale yellow-white belly, 15 rows of smooth scales
    "opheodrys-vernalis": {"d": "#6cad3a", "lat": "#7fbb48", "b": "#f1efc6", "t": "plain", "s": "grass", "L": 0.45, "k": 0, "lip": "#e2e6a8", "sp": {"grassA": "#55803a", "grassB": "#9ab860"},
                           "h": dict(DARK_EYE, iris="#1d1d14", irisInner="#34341f", eyeRing="#cfd09a", pupilW=0.25, eye=0.2, len=0.03, w=0.95), "bx": {"ld": 58, "neck": 0.9},
                           "sx": {"gloss": 0.5, "rows": 15, "keel": 0}, "cx": {"bellyA": 0.7, "mottle": 0.04, "var": 0.03}},
    "opheodrys-aestivus": {"d": "#76b13a", "lat": "#86bd45", "b": "#ecebb0", "t": "plain", "s": "forest", "L": 0.8, "k": 1, "lip": "#e2e6a8",
                           "h": dict(DARK_EYE, iris="#1d1d14", irisInner="#34341f", eyeRing="#cfd09a", pupilW=0.25, eye=0.18), "bx": {"ld": 70, "neck": 0.9}, "sx": {"gloss": 0.4, "rows": 17}, "cx": {"bellyA": 0.7, "mottle": 0.04}},
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
    "crotalus-viridis": {"d": "#a8a07a", "c": "#5a4630", "b": "#e2dcc0", "t": "blotch", "n": 40},
    "crotalus-oreganus": {"d": "#8a7660", "c": "#3e3024", "b": "#e2d8c4", "t": "blotch", "n": 36},
    "tropidolaemus-wagleri": {"d": "#2f8a2a", "lat": "#3a942e", "c": "#e6dc5a", "b": "#c8d880", "t": "band", "n": 36, "h": {"iris": "#c8b040", "irisInner": "#e6d070"}},
    "sistrurus-miliarius": {"d": "#8a7a6a", "c": "#2a2420", "b": "#e2d8c8", "t": "spot", "vs": ["#c26a3a", 0.035]},
    "bothrops-atrox": {"d": "#8a7a5a", "c": "#3a2e20", "b": "#ddd2b6"},
    "chrysopelea-ornata": {"d": "#8fb03a", "lat": "#98b844", "c": "#141a0c", "b": "#d8e0a0", "t": "band", "n": 60, "cx": {"scaleEdge": {"color": "#141a0c", "k": 0.7}}},
    "morelia-spilota": {"d": "#b4ab92", "lat": "#aca286", "c": "#1e1c18", "b": "#e2dcc6", "t": "blotch", "n": 50, "L": 2.0, "s": "forest", "sx": {"gloss": 0.5, "iridescence": 0.1}},
    # v5.19: patterns checked against photos
    "crotalus-ruber": {"d": "#b5826a", "c": "#7a3c2a", "b": "#e8dccb", "t": "diamond", "n": 34, "L": 1.1, "s": "arid", "tl": {"rattle": 7}, "pat": [{"type": "band", "t": [0.88, 0.985], "count": 5, "len": 0.5, "color": "#1a1512", "warp": 0.2, "jit": 0.02}]},
    "nerodia-sipedon": {"d": "#6e604c", "lat": "#74644e", "c": "#2e2218", "b": "#e2d6c0", "t": "band", "n": 32, "L": 0.9, "s": "riverbank", "k": 1, "ck": "#7a3a2a"},
    "laticauda-laticaudata": {"d": "#5f7fa6", "lat": "#6a88ac", "c": "#121214", "b": "#d8d8c8", "t": "band", "n": 40, "L": 1.0, "s": "sea"},
    "thamnophis-sirtalis": {"d": "#2a2a22", "lat": "#36322a", "b": "#d3cb9c", "c": "#121110", "t": "plain", "vs": ["#e4cf62", 0.045], "ls": ["#e8d77a", 0.52, 0.05], "k": 1, "L": 0.7, "s": "grass", "h": {"iris": "#c8a050", "irisInner": "#e6c878"}, "pat": [{"type": "blotch", "count": 70, "a": 0.3, "mirror": True, "alt": True, "wid": 0.07, "len": 0.35, "shape": "rect", "color": "#121110"}]},
    # v5.18: iconic species checked against their photos
    "heterodon-nasicus": {"d": "#b89a72", "c": "#6a4a32", "b": "#2a2622", "t": "blotch", "n": 40, "L": 0.55, "s": "grass", "bx": {"ld": 16}},
    "pantherophis-alleghaniensis": {"d": "#1f201f", "lat": "#252524", "c": "#3a3a36", "b": "#d8d2c0", "t": "plain", "L": 1.4, "s": "forest", "cx": {"speckle": {"p": 0.18, "color": "#b8b2a2", "k": 0.45}}, "sx": {"keel": 0.25, "gloss": 0.55}},
    "elaphe-dione": {"d": "#8a8270", "c": "#3e3428", "b": "#d6d0bc", "t": "blotch", "n": 50, "L": 1.0, "s": "grass", "vs": ["#b8ae96", 0.03]},
    "acrochordus-javanicus": {"d": "#3a362e", "lat": "#403a30", "c": "#5a5444", "b": "#6a6250", "t": "speckle", "L": 1.8, "s": "riverbank", "bx": {"ld": 16, "neck": 0.85}},
    "acrochordus-granulatus": {"d": "#4a4a42", "c": "#d2ccb4", "b": "#bab49e", "t": "band", "n": 40, "L": 1.0, "s": "riverbank"},
    "pituophis-catenifer": {"d": "#cdb27a", "lat": "#c7ab76", "b": "#efe2c2", "c": "#5a3e26", "t": "blotch", "n": 55, "k": 1, "s": "grass", "h": {"iris": "#b08850", "irisInner": "#d0aa70"}},
    # v5.16: black snakes whose photos were read as grey or brown (night shots, pale ground, a hand)
    "azemiops-feae": {"d": "#17171d", "lat": "#1b1b22", "b": "#3a3a44", "c": "#e8e4da", "t": "plain", "pat": [{"type": "band", "t": [0.1, 0.97], "count": 14, "len": 0.1, "color": "#e3a25c", "warp": 0.1, "jit": 0.02}], "L": 0.7, "s": "forest", "hc": "#d9873c", "hcx": 0.55, "h": {"irisDark": 1, "pupil": "round", "iris": "#1a1614", "irisInner": "#2a2420"}},
    "hebius-taronensis": {"d": "#19191a", "lat": "#1c1c1c", "b": "#c8c4b4", "t": "plain", "L": 0.6, "lip": "#d8d4c4"},
    "blythia-hmuifang": {"d": "#2c2a2e", "lat": "#302e32", "b": "#4a4650", "t": "plain", "L": 0.35},
    "erythrolamprus-oligolepis": {"d": "#171616", "lat": "#1b1a1a", "b": "#2c2a28", "t": "plain"},
    "oligodon-trilineatus": {"d": "#151313", "lat": "#181515", "b": "#c2402c", "t": "plain", "vs": ["#b02a22", 0.05], "ls": ["#b02a22", 0.55, 0.03]},
    "madatyphlops-domerguei": {"d": "#2a2422", "lat": "#2e2826", "b": "#5a4a44", "t": "plain"},
    "bungarus-niger": {"t": "plain", "b": "#d8d2c4"}, "bungarus-lividus": {"t": "plain", "b": "#d8d2c4"},
    "bungarus-bungaroides": {"d": "#161616", "c": "#d9d4c8", "b": "#d9d4c8", "t": "band", "n": 50, "s": "forest"},
    "rhinobothryum-lentiginosum": {"d": "#e8e2d6", "c": "#c43a2e", "b": "#e8e2d6", "t": "tricolor", "n": 28, "L": 1.4, "s": "rainforest"},
    "atractus-elaps": {"d": "#b8382c", "c": "#141110", "b": "#c84a3a", "t": "band", "n": 30},
    # v5.12: Australian coral snakes are orange-brown with faint pale bands (not red-black-yellow)
    "brachyurophis-australis": {"d": "#b8724a", "c": "#d9a07a", "b": "#efe2cc", "t": "band", "n": 46, "L": 0.5, "s": "arid", "hc": "#3a2a22", "hcx": 0.45},
    "brachyurophis-semifasciatus": {"d": "#c8834e", "c": "#3a2a22", "b": "#efe2cc", "t": "band", "n": 40, "L": 0.4, "s": "gibber"},
    # v5.12: kingsnakes and milksnakes - smooth glossy scales, real sizes; speckled kingsnake black with a yellow speck on every scale
    'lampropeltis-holbrooki': {'d': '#141511', 'lat': '#181913', 'b': '#e2d47a', 't': 'plain', 'L': 1.1, 's': 'grass', 'cx': {'speckle': {'p': 0.55, 'color': '#e6d77a', 'k': 0.75}, 'mottle': 0.03, 'bellyA': 0.8}, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-nigra': {'d': '#121211', 'lat': '#151514', 'b': '#2a2a24', 't': 'plain', 'L': 1.0, 's': 'forest', 'cx': {'speckle': {'p': 0.14, 'color': '#d9d7a8', 'k': 0.6}, 'mottle': 0.03, 'bellyA': 0.82}, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-splendida': {'d': '#151410', 'lat': '#2a2718', 'b': '#d9cc78', 't': 'plain', 'L': 1.0, 's': 'arid', 'cx': {'speckle': {'p': 0.45, 'color': '#e8d880', 'k': 0.85}, 'mottle': 0.03, 'bellyA': 0.76}, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-catalinensis': {'d': '#e6e0cc', 'c': '#141210', 'b': '#e6e0cc', 't': 'band', 'n': 40, 'L': 0.9, 's': 'arid', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-alterna': {'d': '#8c8c88', 'c': '#c25a30', 'b': '#c8c4ba', 't': 'tricolor', 'n': 30, 'L': 0.85, 's': 'arid', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-mexicana': {'d': '#9a968e', 'c': '#c2402c', 'b': '#d0ccc2', 't': 'tricolor', 'n': 34, 'L': 0.8, 's': 'arid', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-greeri': {'d': '#a4a29a', 'c': '#c2432e', 'b': '#d0ccc2', 't': 'tricolor', 'n': 34, 'L': 0.8, 's': 'arid', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-webbi': {'d': '#a39e94', 'c': '#b8432f', 'b': '#d0ccc2', 't': 'tricolor', 'n': 34, 'L': 0.8, 's': 'arid', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-leonis': {'d': '#9c968c', 'c': '#c2402c', 'b': '#d0ccc2', 't': 'tricolor', 'n': 34, 'L': 0.8, 's': 'arid', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-zonata': {'d': '#ede7d8', 'c': '#c8302a', 'b': '#ece4d0', 't': 'tricolor', 'n': 40, 'L': 0.85, 's': 'forest', 'hc': '#141210', 'hcx': 0.7, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-pyromelana': {'d': '#ede7d8', 'c': '#c8302a', 'b': '#ece4d0', 't': 'tricolor', 'n': 44, 'L': 0.85, 's': 'arid', 'hc': '#141210', 'hcx': 0.7, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-knoblochi': {'d': '#ede7d8', 'c': '#c8302a', 'b': '#ece4d0', 't': 'tricolor', 'n': 44, 'L': 0.85, 's': 'arid', 'hc': '#141210', 'hcx': 0.7, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-ruthveni': {'d': '#eadfb8', 'c': '#c8382c', 'b': '#ece4cc', 't': 'tricolor', 'n': 34, 'L': 0.85, 's': 'arid', 'hc': '#141210', 'hcx': 0.7, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-annulata': {'d': '#e9d9a0', 'c': '#c8302a', 'b': '#e8dcb4', 't': 'tricolor', 'n': 30, 'L': 0.9, 's': 'arid', 'hc': '#141210', 'hcx': 0.8, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-polyzona': {'d': '#e9d48a', 'c': '#c8302a', 'b': '#e8dcb4', 't': 'tricolor', 'n': 30, 'L': 1.3, 's': 'forest', 'hc': '#141210', 'hcx': 0.8, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-abnorma': {'d': '#e9d48a', 'c': '#c8302a', 'b': '#e8dcb4', 't': 'tricolor', 'n': 26, 'L': 1.5, 's': 'rainforest', 'hc': '#141210', 'hcx': 0.8, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-gentilis': {'d': '#e9e0cc', 'c': '#b8402c', 'b': '#e6dfcf', 't': 'tricolor', 'n': 30, 'L': 0.8, 's': 'grass', 'hc': '#141210', 'hcx': 0.8, 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-micropholis': {'d': '#151413', 'lat': '#191817', 'b': '#3a3836', 't': 'plain', 'L': 1.6, 's': 'rainforest', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-calligaster': {'d': '#a39272', 'c': '#6b4a32', 'b': '#d8cfb8', 't': 'blotch', 'n': 55, 'L': 1.0, 's': 'grass', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-rhombomaculata': {'d': '#8e6a52', 'c': '#5a3a28', 'b': '#d0c2a8', 't': 'blotch', 'n': 55, 'L': 0.85, 's': 'forest', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-occipitolineata': {'d': '#a38a6e', 'c': '#6e4a30', 'b': '#d6c8ae', 't': 'blotch', 'n': 55, 'L': 0.85, 's': 'forest', 'k': 0, 'sx': {'gloss': 0.7}},
    'lampropeltis-extenuata': {'d': '#8f8e8a', 'c': '#3a3a36', 'b': '#d0ccc2', 't': 'blotch', 'n': 60, 'L': 0.5, 's': 'sand', 'bx': {'ld': 60}, 'k': 0, 'sx': {'gloss': 0.7}},
    # v5.12: lyre snakes - pale grey or tan with dark brown saddles (pale centres, pale edges) and the lyre-shaped mark on the head
    'trimorphodon-lyrophanes': {'d': '#a59d8b', 'c': '#5b4231', 'b': '#e6dfcd', 't': 'plain', 'n': 26, 'L': 0.75, 's': 'arid', 'k': 0, 'cx': {'mottle': 0.12, 'speckle': {'p': 0.08, 'color': '#5b4231', 'k': 0.4}}, 'h': {'pupil': 'slit', 'iris': '#b8a27a', 'irisInner': '#d8c8a0'}, 'pat': [{'type': 'blotch', 't': [0.08, 0.95], 'count': 26, 'a': 0, 'wid': 0.5, 'len': 0.55, 'shape': 'saddle', 'color': '#5b4231', 'edgeColor': '#d9cdb4', 'edge': 0.16, 'edgeOut': True, 'inner': {'r': 0.3, 'color': '#8a7a64'}, 'warp': 0.35, 'jit': 0.08}, {'type': 'line', 'p0': [0.12, 0.02], 'p1': [1.05, 0.2], 'wid': 0.05, 'color': '#4a3324', 'mirror': True, 'aa': 0.3}, {'type': 'line', 'p0': [0.55, 0.0], 'p1': [1.1, 0.0], 'wid': 0.05, 'color': '#4a3324', 'aa': 0.3}, {'type': 'line', 'p0': [0.25, 0.38], 'p1': [0.9, 0.42], 'wid': 0.04, 'color': '#4a3324', 'mirror': True, 'aa': 0.35}]},
    'trimorphodon-lambda': {'d': '#b5a68e', 'c': '#5e4330', 'b': '#ece2cc', 't': 'plain', 'n': 26, 'L': 0.9, 's': 'arid', 'k': 0, 'cx': {'mottle': 0.12, 'speckle': {'p': 0.08, 'color': '#5e4330', 'k': 0.4}}, 'h': {'pupil': 'slit', 'iris': '#b8a27a', 'irisInner': '#d8c8a0'}, 'pat': [{'type': 'blotch', 't': [0.08, 0.95], 'count': 26, 'a': 0, 'wid': 0.5, 'len': 0.55, 'shape': 'saddle', 'color': '#5e4330', 'edgeColor': '#d9cdb4', 'edge': 0.16, 'edgeOut': True, 'inner': {'r': 0.3, 'color': '#8f7b62'}, 'warp': 0.35, 'jit': 0.08}, {'type': 'line', 'p0': [0.12, 0.02], 'p1': [1.05, 0.2], 'wid': 0.05, 'color': '#4a3324', 'mirror': True, 'aa': 0.3}, {'type': 'line', 'p0': [0.55, 0.0], 'p1': [1.1, 0.0], 'wid': 0.05, 'color': '#4a3324', 'aa': 0.3}, {'type': 'line', 'p0': [0.25, 0.38], 'p1': [0.9, 0.42], 'wid': 0.04, 'color': '#4a3324', 'mirror': True, 'aa': 0.35}]},
    'trimorphodon-vilkinsonii': {'d': '#a9a49a', 'c': '#4e3a2c', 'b': '#e4e0d6', 't': 'plain', 'n': 22, 'L': 0.85, 's': 'arid', 'k': 0, 'cx': {'mottle': 0.12, 'speckle': {'p': 0.08, 'color': '#4e3a2c', 'k': 0.4}}, 'h': {'pupil': 'slit', 'iris': '#b8a27a', 'irisInner': '#d8c8a0'}, 'pat': [{'type': 'blotch', 't': [0.08, 0.95], 'count': 22, 'a': 0, 'wid': 0.5, 'len': 0.55, 'shape': 'saddle', 'color': '#4e3a2c', 'edgeColor': '#d9cdb4', 'edge': 0.16, 'edgeOut': True, 'inner': {'r': 0.3, 'color': '#7c6e60'}, 'warp': 0.35, 'jit': 0.08}, {'type': 'line', 'p0': [0.12, 0.02], 'p1': [1.05, 0.2], 'wid': 0.05, 'color': '#4a3324', 'mirror': True, 'aa': 0.3}, {'type': 'line', 'p0': [0.55, 0.0], 'p1': [1.1, 0.0], 'wid': 0.05, 'color': '#4a3324', 'aa': 0.3}, {'type': 'line', 'p0': [0.25, 0.38], 'p1': [0.9, 0.42], 'wid': 0.04, 'color': '#4a3324', 'mirror': True, 'aa': 0.35}]},
    'trimorphodon-biscutatus': {'d': '#9c8c76', 'c': '#4f3a2a', 'b': '#e2d8c4', 't': 'plain', 'n': 28, 'L': 1.2, 's': 'forest', 'k': 0, 'cx': {'mottle': 0.12, 'speckle': {'p': 0.08, 'color': '#4f3a2a', 'k': 0.4}}, 'h': {'pupil': 'slit', 'iris': '#b8a27a', 'irisInner': '#d8c8a0'}, 'pat': [{'type': 'blotch', 't': [0.08, 0.95], 'count': 28, 'a': 0, 'wid': 0.5, 'len': 0.55, 'shape': 'saddle', 'color': '#4f3a2a', 'edgeColor': '#d9cdb4', 'edge': 0.16, 'edgeOut': True, 'inner': {'r': 0.3, 'color': '#7a6a56'}, 'warp': 0.35, 'jit': 0.08}, {'type': 'line', 'p0': [0.12, 0.02], 'p1': [1.05, 0.2], 'wid': 0.05, 'color': '#4a3324', 'mirror': True, 'aa': 0.3}, {'type': 'line', 'p0': [0.55, 0.0], 'p1': [1.1, 0.0], 'wid': 0.05, 'color': '#4a3324', 'aa': 0.3}, {'type': 'line', 'p0': [0.25, 0.38], 'p1': [0.9, 0.42], 'wid': 0.04, 'color': '#4a3324', 'mirror': True, 'aa': 0.35}]},
    'trimorphodon-tau': {'d': '#b9a68a', 'c': '#4a3426', 'b': '#ece2cc', 't': 'plain', 'n': 30, 'L': 0.75, 's': 'arid', 'k': 0, 'cx': {'mottle': 0.12, 'speckle': {'p': 0.08, 'color': '#4a3426', 'k': 0.4}}, 'h': {'pupil': 'slit', 'iris': '#b8a27a', 'irisInner': '#d8c8a0'}, 'pat': [{'type': 'blotch', 't': [0.08, 0.95], 'count': 30, 'a': 0, 'wid': 0.5, 'len': 0.55, 'shape': 'saddle', 'color': '#4a3426', 'edgeColor': '#d9cdb4', 'edge': 0.16, 'edgeOut': True, 'inner': {'r': 0.3, 'color': '#8e7a62'}, 'warp': 0.35, 'jit': 0.08}, {'type': 'line', 'p0': [0.12, 0.02], 'p1': [1.05, 0.2], 'wid': 0.05, 'color': '#4a3324', 'mirror': True, 'aa': 0.3}, {'type': 'line', 'p0': [0.55, 0.0], 'p1': [1.1, 0.0], 'wid': 0.05, 'color': '#4a3324', 'aa': 0.3}, {'type': 'line', 'p0': [0.25, 0.38], 'p1': [0.9, 0.42], 'wid': 0.04, 'color': '#4a3324', 'mirror': True, 'aa': 0.35}]},
    'trimorphodon-paucimaculatus': {'d': '#c3ad8c', 'c': '#5a3e2a', 'b': '#ece2cc', 't': 'plain', 'n': 22, 'L': 0.9, 's': 'forest', 'k': 0, 'cx': {'mottle': 0.12, 'speckle': {'p': 0.08, 'color': '#5a3e2a', 'k': 0.4}}, 'h': {'pupil': 'slit', 'iris': '#b8a27a', 'irisInner': '#d8c8a0'}, 'pat': [{'type': 'blotch', 't': [0.08, 0.95], 'count': 22, 'a': 0, 'wid': 0.5, 'len': 0.55, 'shape': 'saddle', 'color': '#5a3e2a', 'edgeColor': '#d9cdb4', 'edge': 0.16, 'edgeOut': True, 'inner': {'r': 0.3, 'color': '#937a5c'}, 'warp': 0.35, 'jit': 0.08}, {'type': 'line', 'p0': [0.12, 0.02], 'p1': [1.05, 0.2], 'wid': 0.05, 'color': '#4a3324', 'mirror': True, 'aa': 0.3}, {'type': 'line', 'p0': [0.55, 0.0], 'p1': [1.1, 0.0], 'wid': 0.05, 'color': '#4a3324', 'aa': 0.3}, {'type': 'line', 'p0': [0.25, 0.38], 'p1': [0.9, 0.42], 'wid': 0.04, 'color': '#4a3324', 'mirror': True, 'aa': 0.35}]},
    'trimorphodon-quadruplex': {'d': '#8f8170', 'c': '#3e2e22', 'b': '#ddd3c0', 't': 'plain', 'n': 28, 'L': 1.1, 's': 'forest', 'k': 0, 'cx': {'mottle': 0.12, 'speckle': {'p': 0.08, 'color': '#3e2e22', 'k': 0.4}}, 'h': {'pupil': 'slit', 'iris': '#b8a27a', 'irisInner': '#d8c8a0'}, 'pat': [{'type': 'blotch', 't': [0.08, 0.95], 'count': 28, 'a': 0, 'wid': 0.5, 'len': 0.55, 'shape': 'saddle', 'color': '#3e2e22', 'edgeColor': '#d9cdb4', 'edge': 0.16, 'edgeOut': True, 'inner': {'r': 0.3, 'color': '#6e604e'}, 'warp': 0.35, 'jit': 0.08}, {'type': 'line', 'p0': [0.12, 0.02], 'p1': [1.05, 0.2], 'wid': 0.05, 'color': '#4a3324', 'mirror': True, 'aa': 0.3}, {'type': 'line', 'p0': [0.55, 0.0], 'p1': [1.1, 0.0], 'wid': 0.05, 'color': '#4a3324', 'aa': 0.3}, {'type': 'line', 'p0': [0.25, 0.38], 'p1': [0.9, 0.42], 'wid': 0.04, 'color': '#4a3324', 'mirror': True, 'aa': 0.35}]},
    # v5.09: green snakes whose photos read as brown/grey, or that got their group's typical length - plain green, real size
    "ptyas-major": {"s": "forest", "d": "#5fae38", "lat": "#6db840", "b": "#dde7a2", "t": "plain", "L": 1.0, "k": 0},
    "ptyas-semicarinata": {"d": "#5a9c3a", "lat": "#68a642", "b": "#d9e1a2", "t": "plain", "L": 1.4, "k": 1},
    "ptyas-herminae": {"d": "#5aa23c", "lat": "#68ac44", "b": "#dfe6aa", "t": "plain", "L": 0.8, "k": 0},
    "ptyas-doriae": {"s": "forest", "d": "#5f9e3e", "lat": "#6da846", "b": "#d6dea2", "t": "plain", "L": 1.0, "k": 0},
    "ptyas-nigromarginata": {"s": "forest", "d": "#4f9034", "lat": "#5d9a3c", "b": "#d6dc9c", "t": "plain", "L": 1.6, "k": 0, "cx": {"scaleEdge": {"color": "#141a0c", "k": 0.7}}},
    "ptyas-multicincta": {"s": "forest", "d": "#5c8f3a", "lat": "#6a9942", "b": "#d9dcaa", "t": "band", "L": 1.0, "k": 0, "c": "#1d2618", "n": 40},
    "gonyosoma-prasinum": {"s": "forest", "d": "#58ac38", "lat": "#66b640", "b": "#e3e7a2", "t": "plain", "L": 1.2, "k": 0},
    "senticolis-triaspis": {"s": "forest", "d": "#6b9a46", "lat": "#79a44e", "b": "#e0dfaa", "t": "plain", "L": 1.1, "k": 0},
    "chlorosoma-viridissimum": {"d": "#58b040", "lat": "#66ba48", "b": "#dfe9a8", "t": "plain", "L": 1.0, "k": 0},
    "philodryas-olfersii": {"d": "#5aa040", "lat": "#68aa48", "b": "#cfe0a2", "t": "plain", "L": 1.1, "k": 0},
    "philodryas-aestiva": {"d": "#68a848", "lat": "#76b250", "b": "#d6e2aa", "t": "plain", "L": 0.9, "k": 0},
    "philodryas-baroni": {"d": "#5c9c3e", "lat": "#6aa646", "b": "#d9dfa8", "t": "plain", "L": 1.4, "k": 0},
    "oxybelis-fulgidus": {"d": "#5aa83a", "lat": "#68b242", "b": "#cfe39c", "t": "plain", "L": 1.6, "k": 0, "ls": ["#e8f0b0", 0.62, 0.03], "bx": {"ld": 90, "neck": 0.9}},
    "bothrops-bilineatus": {"d": "#6aa43c", "lat": "#78ae44", "b": "#d8e0a2", "t": "plain", "L": 0.8, "k": 1, "ls": ["#e6d870", 0.55, 0.03]},
    "ophryacus-smaragdinus": {"d": "#5f9e3c", "lat": "#6da844", "b": "#cfd99c", "t": "plain", "L": 0.6, "k": 1},
    "philothamnus-angolensis": {"d": "#4f9e3a", "lat": "#5da842", "b": "#d8e6a0", "t": "plain", "L": 1.0, "k": 0},
    "philothamnus-bequaerti": {"d": "#58a03c", "lat": "#66aa44", "b": "#dbe4a6", "t": "plain", "L": 0.8, "k": 0},
    "philothamnus-irregularis": {"d": "#5aa23e", "lat": "#68ac46", "b": "#dde6a8", "t": "plain", "L": 0.8, "k": 0},
    "philothamnus-natalensis": {"d": "#56a03a", "lat": "#64aa42", "b": "#dce6a4", "t": "plain", "L": 0.8, "k": 0},
    "philothamnus-battersbyi": {"d": "#5aa63e", "lat": "#68b046", "b": "#dde8a8", "t": "plain", "L": 0.7, "k": 0},
    "philothamnus-carinatus": {"d": "#4f9838", "lat": "#5da240", "b": "#d6e2a0", "t": "plain", "L": 0.7, "k": 1},
    "philothamnus-heterodermus": {"d": "#3f9a3a", "lat": "#4da442", "b": "#cfe2a0", "t": "plain", "L": 0.6, "k": 0},
    "philothamnus-hoplogaster": {"d": "#5a9a3c", "lat": "#68a444", "b": "#e2e6b0", "t": "plain", "L": 0.6, "k": 0},
    "philothamnus-nitidus": {"d": "#52a03c", "lat": "#60aa44", "b": "#d8e4a4", "t": "plain", "L": 0.7, "k": 0},
    "philothamnus-heterolepidotus": {"d": "#58a23e", "lat": "#66ac46", "b": "#dde6a8", "t": "plain", "L": 0.8, "k": 0},
    "philothamnus-hughesi": {"d": "#56a03c", "lat": "#64aa44", "b": "#dce4a6", "t": "plain", "L": 0.7, "k": 0},
    "philothamnus-macrops": {"d": "#58a040", "lat": "#66aa48", "b": "#dce4a8", "t": "plain", "L": 0.8, "k": 0},
    "philothamnus-ruandae": {"d": "#4f9a3a", "lat": "#5da442", "b": "#d6e2a2", "t": "plain", "L": 0.7, "k": 0},
    "philothamnus-occidentalis": {"s": "forest", "d": "#56a23c", "lat": "#64ac44", "b": "#dce6a6", "t": "plain", "L": 0.9, "k": 0},
    "philothamnus-punctatus": {"d": "#5aa03c", "lat": "#68aa44", "b": "#dce4a8", "t": "spot", "L": 0.8, "k": 0, "c": "#141812", "n": 36},
    "hapsidophrys-smaragdinus": {"d": "#4fae3a", "lat": "#5db842", "b": "#e6e39c", "t": "plain", "L": 0.8, "k": 0},
    "hapsidophrys-principis": {"d": "#56a63c", "lat": "#64b044", "b": "#e0e2a0", "t": "plain", "L": 0.8, "k": 0},
    "hapsidophrys-lineatus": {"d": "#5a9a36", "lat": "#68a43e", "b": "#dfe2a6", "t": "stripe", "L": 0.9, "k": 0, "c": "#141a10"},
    "rhamnophis-aethiopissa": {"d": "#4f9a3a", "lat": "#5da442", "b": "#d9e2a2", "t": "plain", "L": 1.0, "k": 0, "cx": {"scaleEdge": {"color": "#141a0c", "k": 0.65}}},
    "dipsadoboa-viridis": {"d": "#5a9a40", "lat": "#68a448", "b": "#dce2aa", "t": "plain", "L": 0.8, "k": 0},
    "dipsadoboa-unicolor": {"d": "#56943c", "lat": "#649e44", "b": "#d8dea6", "t": "plain", "L": 0.8, "k": 0},
    "atheris-chlorechis": {"d": "#7cb84a", "lat": "#8ac252", "b": "#dfe6a8", "t": "plain", "L": 0.6, "k": 1},
    "causus-resimus": {"d": "#6a9a3e", "lat": "#78a446", "b": "#e8e2b0", "t": "zigzag", "L": 0.5, "k": 0, "c": "#3d5a26"},
    "rhabdophis-nigrocinctus": {"d": "#5f8f3c", "lat": "#6d9944", "b": "#d6d8b0", "t": "band", "L": 0.8, "k": 1, "c": "#1a1a14"},
    "boiga-cyanea": {"d": "#4f9a48", "lat": "#5da450", "b": "#c8dca8", "t": "plain", "L": 1.4, "k": 0},
    "morelia-azurea": {"d": "#4a9a34", "lat": "#58a43c", "b": "#e0e070", "t": "vert", "L": 1.6, "k": 0, "c": "#f0f2dc", "n": 40},
}


# (Gaboon viper: the purple was too strong and the head too pale; a darker, warmer iris)
HAND_FIXES = {
    # v5.19: patterns checked against photos (chequered bellies, reticulated net, copperhead hourglasses, timber chevrons, diamond chain, kingsnake chain, bushmaster rhomboids)
    'pantherophis-guttatus': [(('pattern',), [{'type': 'blotch', 't': [0.06, 0.95], 'count': 36, 'a': 0, 'wid': 0.3, 'len': 0.62, 'shape': 'round', 'color': '#a8331f', 'edgeColor': '#1a1210', 'edge': 0.15, 'warp': 0.3}, {'type': 'blotch', 't': [0.06, 0.95], 'count': 36, 'phase': 0.5, 'a': 0.6, 'mirror': True, 'alt': True, 'wid': 0.1, 'len': 0.4, 'color': '#a8331f', 'edgeColor': '#2a1a14', 'edge': 0.2}, {'type': 'blotch', 't': [0.06, 0.97], 'count': 70, 'a': 0.9, 'mirror': True, 'alt': True, 'belly': True, 'wid': 0.06, 'len': 0.5, 'shape': 'rect', 'color': '#1a1512'}, {'type': 'poly', 'pts': [[0.25, 0], [0.6, 0.12], [1.3, 0.14], [1.3, -0.14], [0.6, -0.12]], 'color': '#b03a22'}, {'type': 'line', 'p0': [0.3, 0.4], 'p1': [1.0, 0.62], 'wid': 0.06, 'color': '#a8331f', 'mirror': True}, {'type': 'checker', 'belly': True, 'color': '#141210', 'alpha': 0.9, 'skip': 0.1}])],
    'pantherophis-obsoletus': [(('pattern',), [{'type': 'blotch', 't': [0.06, 0.95], 'count': 34, 'a': 0, 'wid': 0.3, 'len': 0.6, 'color': '#2c2824', 'alpha': 0.8}, {'type': 'line', 'p0': [0.05, 0.66], 'p1': [0.9, 0.64], 'wid': 0.1, 'color': '#d8d2c2', 'mirror': True}, {'type': 'checker', 'belly': True, 'color': '#2a2824', 'alpha': 0.6, 'skip': 0.1}])],
    'malayopython-reticulatus': [(('colors', 'dorsal'), '#9a7c44'), (('colors', 'lateral'), '#a08040'), (('pattern',), [{'type': 'net', 't': [0.05, 0.97], 'count': 46, 'na': 2.1, 'wid': 0.11, 'color': '#15100a', 'edgeColor': '#e0cc8e', 'edge': 0.4, 'warp': 0.7}, {'type': 'blotch', 't': [0.05, 0.97], 'count': 46, 'phase': 0.5, 'a': 0.62, 'mirror': True, 'wid': 0.08, 'len': 0.3, 'shape': 'diamond', 'color': '#e2dccb', 'warp': 0.4}, {'type': 'cap', 'x0': 0, 'x1': 1.04, 'wid': 0.6, 'color': '#9a7a40'}, {'type': 'line', 'p0': [0.04, 0], 'p1': [1.2, 0], 'wid': 0.018, 'color': '#120c06'}, {'type': 'line', 'p0': [0.33, 0.37], 'p1': [1.0, 0.54], 'wid': 0.03, 'color': '#120c06', 'mirror': True}, {'type': 'line', 'p0': [0.04, 0.64], 'p1': [0.82, 0.63], 'wid': 0.06, 'color': '#d6c48c', 'mirror': True}])],
    'agkistrodon-contortrix': [(('pattern', 0, 'shape'), 'hourglass2'), (('pattern', 0, 'wid'), 0.98), (('pattern', 0, 'len'), 0.7), (('colors', 'dorsal'), '#cba68c'), (('colors', 'lateral'), '#c6a288')],
    'agkistrodon-piscivorus': [(('pattern', 0, 'shape'), 'hourglass2'), (('pattern', 0, 'alpha'), 0.7), (('pattern', 0, 'wid'), 0.98)],
    'crotalus-horridus': [(('pattern', 1, 'wid'), 0.55), (('pattern', 1, 'len'), 0.42), (('pattern', 1, 'warp'), 0.3)],
    'crotalus-adamanteus': [(('pattern', 0, 'len'), 1.25), (('pattern', 0, 'wid'), 0.19), (('pattern', 0, 'edge'), 0.2)],
    'crotalus-atrox': [(('pattern', 0, 'len'), 1.25), (('pattern', 0, 'wid'), 0.19), (('pattern', 0, 'edge'), 0.2), (('pattern', 1, 'a'), 0.52)],
    'lampropeltis-getula': [(('pattern',), [{'type': 'chain', 't': [0.05, 0.96], 'count': 24, 'na': 1.5, 'wid': 0.065, 'color': '#ece6cf', 'warp': 0.25, 'a0': 0.3, 'a1': 0.86}, {'type': 'checker', 'belly': True, 'color': '#ece6cf', 'alpha': 0.7, 'skip': 0.1}])],
    'lachesis-muta': [(('colors', 'dorsal'), '#c9a37e'), (('colors', 'lateral'), '#c8a27c'), (('pattern', 0, 'warp'), 0.12), (('pattern', 0, 'inner', 'r'), 0.4), (('pattern', 0, 'inner', 'color'), '#9a7652'), (('pattern', 0, 'len'), 0.72), (('pattern', 0, 'wid'), 0.32), (('pattern', 0, 'count'), 28)],
    # v5.18: eastern milksnake - wider red-brown saddles edged in black on a grey-tan ground
    "lampropeltis-triangulum": [(("pattern", 0, "wid"), 0.46), (("pattern", 0, "color"), "#8e3a26"), (("pattern", 1, "color"), "#8e3a26"), (("colors", "dorsal"), "#9d9686")],
    # v5.16: bushmaster - separate dark rhomboid blotches (pale centres) on a pinkish tan ground; they had merged into bands
    # v5.16: yellow-bellied sea snake - the water line lower on its body, so the bright yellow lower flanks show above the water line
    "hydrophis-platurus": [(("colors", "belly"), "#f0c23a"), (("colors", "bellyA"), 0.34), (("scene", "float"), 0.3)],
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
        nm = (c["name"] if not c["is_sci"] else "").lower()
        if (c["genus"].lower() in GREEN_IN_LIFE or (c["genus"].lower() == "dendroaspis" and "black" not in nm)) and not green and lum(d) < 0.3 and not re.search(r"brown|gr[ae]y|black|white|yellow|red|mangrove|bronze|spotted|striped|banded", nm):
            d, green = "#5aa63a", True  # v5.12: the photo read leaves or shade as its colour - in life it is green
        # v5.12: a near-black colour read from a photo is usually shadow, unless the snake's name says it is dark
        if not green and lum(d) < (0.15 if c["genus"].lower() in ("crotalus", "sistrurus") else 0.06) and not re.search(r"black|dark|melan|nigr|ebon|coal|ink|night|obscur|mole", nm + " " + c["id"]): d = mix(d, gd, 0.6)
        t = pattern_of(c, plan, con, green)
        # the belly: paler and less coloured than the back (a dark snake keeps a darker belly)
        b = mix(tone(d, 1.45 if lum(d) < 0.5 else 1.1, 0.55), "#e6dcc4", 0.35) if plan != "blind" else tone(d, 1.2, 0.8)
        if t == "coral": d, p, b = "#b3352a", "#141110", "#c9463a"
        # v5.16: snakes named for being black all over (Black Snake, Greater Black Krait, Black Python, epithet ater/niger/
        # nigra/nigrescens...) are black - photos at night or on pale ground were read as grey or brown
        sp_ep = c["id"].split("-")[-1]
        if (re.search(r"(^|[ (])black(ish)?(?![-a-z])", nm) and not re.search(r"red-black|black-and|and black", nm)) or sp_ep in ("ater", "atra", "atratus", "niger", "nigra", "nigrum", "nigrescens"):
          if c["id"] not in ("atractus-elaps",):
            d = "#19191b" if "ish" not in nm else "#2e2a28"
            b = tone(d, 2.2, 0.4) if b and lum(b) < 0.25 else b
            if t == "coral": t = "plain"
            if t in ("band",): p = "#d9d4c8"
            elif t not in ("plain", "stripe"): t = "plain"
            green = False
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
        if g in ("pantherophis", "elaphe", "pituophis", "lampropeltis", "pseudelaphe", "senticolis", "bogertophis", "arizona", "zamenis", "euprepiophis", "oreocryptophis") and t not in ("tricolor",): a["ck"] = 1  # v5.19: chequered belly
        # v5.20: the marks each group really has, beyond its main pattern
        if g in ("trimeresurus", "craspedocephalus", "viridovipera", "popeia", "cryptelytrops") and (green or is_green(a["d"])):
            a.setdefault("ls", ["#e9f0c6", 0.58, 0.028]); a.setdefault("tt", "#a8552e")  # pale line low on the flanks, rusty tail tip
            if a["t"] in ("speckle", "blotch", "spot"): a["t"] = "plain"
        if g == "dendrelaphis" and not re.search(r"green", nm): a["d"] = "#8a6a3e"; a["lat"] = "#8e6e42"; a["t"] = "plain"  # bronzebacks are bronze-brown
        if g == "dendrelaphis": a.setdefault("ls", ["#141210", 0.5, 0.045]); a["pat"] = a.get("pat", []) + [{"type": "stripe", "t": [0.04, 1], "a": 0.62, "mirror": True, "wid": 0.025, "color": "#ece2b8", "aa": 0.35}]
        if g == "crotalus" and c["id"].split("-")[1] in ("mitchellii", "stephensi", "pyrrhus", "angelensis", "tigris", "polisi"): a["cx"] = dict(a.get("cx") or {}, speckle={"p": 0.3, "color": tone(d, 0.55), "k": 0.6}, mottle=0.14)
        if g == "tantilla": a.setdefault("hc", "#1a1614"); a.setdefault("hcx", 1.0)  # the black head of centipede snakes
        if g == "oligodon" and a["t"] == "speckle": a["t"] = "saddle"
        if g in ("typhlops", "afrotyphlops", "indotyphlops", "amerotyphlops", "letheobia", "anilios", "ramphotyphlops", "argyrophis", "madatyphlops", "antillotyphlops", "xerotyphlops", "myriopholis", "leptotyphlops", "epictia", "trilepida", "liotyphlops", "gerrhopilus") and a["t"] not in ("stripe",): a["t"] = "plain"
        if c["id"] in CURATED:  # v4.81: hand-checked against its photo
            a.update(CURATED[c["id"]]); a["x"] = a.get("x", "").replace("g", "").replace("l", "" if "L" in CURATED[c["id"]] else "l")
            if not a["x"]: a.pop("x")
        if c["family"] == "Uropeltidae" or c["family"] == "Cylindrophiidae" or c["family"] == "Aniliidae": a["o"] = 1  # short blunt tail
        # v5.18: the real number of scale rows (so scales are the right size), and granular or glassy skin where the genus has it
        if g in GENUS_ROWS and "rows" not in (a.get("sx") or {}): a["sx"] = dict(a.get("sx") or {}, rows=GENUS_ROWS[g])
        if g in GENUS_KIND: a["sx"] = dict(a.get("sx") or {}, kind=GENUS_KIND[g][0], rows=GENUS_KIND[g][1], aV=1.0 if g == "acrochordus" else (a.get("sx") or {}).get("aV", 0.8))
        if g == "acanthophis" and "bx" not in a: a["bx"] = {"ld": 14, "neck": 0.5, "tail": 0.11}; a.setdefault("h", {}).setdefault("pupil", "slit")  # v5.12: death adders are short and stout
        out[c["id"]] = {"name": c["sci"] if c["is_sci"] else c["name"], "auto": a}
    return out
