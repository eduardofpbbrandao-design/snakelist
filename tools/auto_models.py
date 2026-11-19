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
# v5.62: typical adult total length (m) for the living genera that had no entry and fell back to a family or kind
# placeholder (0.8 m for every colubrid, 1.0 m for every elapid): field-guide adult sizes for each genus, approximate
GENUS_LEN.update({"rhadinella": 0.35, "tropidonophis": 0.6, "phalotris": 0.45, "madatyphlops": 0.2, "dendrophidion": 1.0, "polemon": 0.5, "telescopus": 0.8, "argyrophis": 0.25, "mastigodryas": 1.2, "malayotyphlops": 0.25, "antillotyphlops": 0.25, "cubatyphlops": 0.25, "aparallactus": 0.3, "pseudalsophis": 0.8, "dipsadoboa": 0.7, "lycodryas": 0.8, "aspidura": 0.3, "lycodonomorphus": 0.6, "asthenodipsas": 0.45, "adelphicos": 0.3, "arrhyton": 0.3, "tropidodipsas": 0.45, "synophis": 0.45, "alsophis": 0.9, "macrocalamus": 0.3, "liopholidophis": 0.8, "urotheca": 0.4, "hypsirhynchus": 0.6, "ficimia": 0.3, "compsophis": 0.35, "coelognathus": 1.5, "rhinotyphlops": 0.3, "siphlophis": 0.8, "trimerodytes": 0.7, "limaformosa": 0.7, "herpetoreas": 0.6, "brachyurophis": 0.3, "pseudoxenodon": 0.7, "trimetopon": 0.3, "crotaphopeltis": 0.6, "natriciteres": 0.4, "lytorhynchus": 0.4, "spalerosophis": 1.4, "conopsis": 0.3, "thamnosophis": 0.7, "cubophis": 0.8, "xylophis": 0.2, "rhynchocalamus": 0.4, "thrasops": 1.5, "siagonodon": 0.2, "gongylosoma": 0.5, "meizodon": 0.6, "saphenophis": 0.5, "chrysopelea": 1.0, "acutotyphlops": 0.3, "xenocalamus": 0.5, "namibiana": 0.2, "toxicodryas": 1.8, "borikenophis": 0.9, "dolichophis": 1.8, "brachyorrhos": 0.5, "tretanorhinus": 0.6, "duberria": 0.35, "plagiopholis": 0.35, "drymobius": 1.0, "ialtris": 0.8, "macroprotodon": 0.5, "chersodromus": 0.3, "pseudoboodon": 0.6, "hemorrhois": 1.4, "hemirhagerrhis": 0.4, "enulius": 0.3, "anomalepis": 0.2, "grayia": 1.5, "phisalixella": 0.7, "mitophis": 0.15, "calamophis": 0.3, "incaspis": 0.6, "limnophis": 0.4, "hemibungarus": 0.6, "stoliczkia": 0.6, "drysdalia": 0.4, "austrelaps": 1.2, "aspidomorphus": 0.5, "anomochilus": 0.3, "drymoluber": 1.0, "psomophis": 0.4, "phimophis": 0.7, "heteroliodon": 0.3, "uromacer": 1.0, "thermophis": 0.7, "omoadiphas": 0.35, "phrynonax": 1.8, "tantillita": 0.2, "buhoma": 0.3, "chamaelycus": 0.35, "myron": 0.5, "helminthophis": 0.2, "micrelaps": 0.4, "plectrurus": 0.3, "liodytes": 0.4, "tomodon": 0.6, "xenopholis": 0.3, "mussurana": 1.2, "rodriguesophis": 0.5, "tetracheilostoma": 0.12, "epacrophis": 0.2, "gyiophis": 0.6, "pseudelaphe": 1.2, "parafimbrios": 0.35, "contia": 0.35, "elapoidis": 0.5, "kladirostratus": 0.9, "cemophora": 0.5, "chlorosoma": 1.0, "farancia": 1.3, "platyplectrurus": 0.3, "teretrurus": 0.25, "elapognathus": 0.5, "ephalophis": 0.5, "neelaps": 0.3, "trachyboa": 0.35, "xenophidion": 0.3, "amastridium": 0.6, "symphimus": 0.7, "dromicodryas": 0.9, "phyllorhynchus": 0.4, "rhabdops": 0.8, "xenelaphis": 1.5, "boiruna": 2.0, "hydrodynastes": 2.0, "hydraethiops": 0.6, "stenorrhina": 0.6, "mimophis": 0.8, "pliocercus": 0.6, "dryophiops": 0.8, "rabdion": 0.3, "scaphiophis": 1.3, "fimbrios": 0.4, "bothrophthalmus": 1.0, "gyalopion": 0.23, "xenoxybelis": 1.0, "psammodynastes": 0.5, "diaphorolepis": 0.6, "scaphiodontophis": 0.7, "hydromorphus": 0.5, "adelophis": 0.35, "alluaudina": 0.4, "hydrablabes": 0.4, "argyrogena": 1.5, "pseudohaje": 2.2, "homoroselaps": 0.4, "chilorhinophis": 0.4, "homalophis": 0.6, "antaioserpens": 0.4, "hemiaspis": 0.5, "regina": 0.6, "elapomorphus": 0.5, "tropidodryas": 0.8, "pseudoeryx": 0.7, "myrrophis": 0.5, "magliophis": 0.6, "plecturus": 0.3, "chionactis": 0.3, "tropidoclonion": 0.4, "cantoria": 1.0, "fordonia": 0.6, "pseudaspis": 1.4, "echiopsis": 0.4, "blythia": 0.3, "atretium": 0.6, "pseudagkistrodon": 0.7, "haldea": 0.25, "clonophis": 0.5, "micropechis": 1.5, "tropidechis": 0.7, "paroplocephalus": 0.5, "rhinoplocephalus": 0.4, "hydrelaps": 0.5, "microcephalophis": 1.0, "parahydrophis": 0.5, "salomonelaps": 0.7, "loveridgelaps": 0.8, "ogmodon": 0.4, "parapistocalamus": 0.5, "bolyeria": 1.0, "casarea": 1.2, "popeia": 0.7, "cryptelytrops": 0.7, "montatheris": 0.35, "garthius": 0.5, "zaocys": 2.0, "oocatochus": 0.8, "dinodon": 1.0, "archelaphe": 0.8, "erpeton": 0.6, "bitia": 0.6, "gerarda": 0.5, "amplorhinus": 0.5, "inyoka": 0.6, "hormonotus": 0.7, "pythonodipsas": 0.6, "dipsina": 0.4, "rhamnophis": 1.2, "rhinobothryum": 1.2, "crisantophis": 0.6, "nothopsis": 0.4, "leptodrymus": 1.2, "simophis": 0.5, "scolecophis": 0.4, "geagras": 0.25, "manolepis": 0.6, "sympholis": 0.35, "enuliophis": 0.35, "cercophis": 1.0, "sordellina": 0.4, "ptychophis": 0.5, "drepanoides": 0.6, "macrelaps": 0.8, "brachyophis": 0.3, "aeluroglena": 0.8, "afronatrix": 0.6, "helophis": 0.4, "ditypophis": 0.4, "micropisthodon": 0.5, "heurnia": 0.5, "cyclotyphlops": 0.2, "xenotyphlops": 0.25, "grypotyphlops": 0.4, "typhlophis": 0.2, "rhinoleptus": 0.3, "sundatyphlops": 0.2, "rhinoguinea": 0.15, "habrophallos": 0.12, "cathetorhinus": 0.15, "iguanognathus": 0.3, "elapotinus": 0.3, "uromacerina": 0.6, "lycognathophis": 0.6, "etheridgeum": 0.3, "anoplohydrus": 0.4, "lioheterophis": 0.6, "cryophis": 0.6, "hemerophis": 0.8, "chapinophis": 0.3, "tantalophis": 0.5, "gomesophis": 0.4, "ferania": 0.6, "raclitia": 0.4, "phytolopsis": 0.6, "miralia": 0.6, "collorhabdium": 0.3, "pararhadinaea": 0.3, "montaspis": 0.4, "pseudotomodon": 0.5, "amphiesmoides": 0.6, "dendrolycus": 0.5, "pseudoleptodeira": 0.6, "bothrolycus": 0.6, "tetralepis": 0.3, "oreocalamus": 0.3, "plesiodipsas": 0.5, "eridiphas": 0.6, "caraiba": 0.8, "bamanophis": 0.6, "haitiophis": 1.0, "pseudoferania": 0.6, "coronelaps": 0.5, "colubroelaps": 0.4, "hypoptophis": 0.5, "djokoiskandarus": 0.5, "kualatahan": 0.6, "subsessor": 0.7, "sumatranus": 0.6, "mintonophis": 0.5, "isanophis": 0.5, "holarchus": 0.6, "wallaceophis": 0.6, "sivaophis": 0.4, "gansophis": 0.5, "stichophanes": 0.6, "paraphimophis": 0.6, "rhachidelus": 1.2, "parastenophis": 0.5, "dieurostus": 0.5, "paratapinophis": 0.5, "pollackophis": 0.4, "amnesteophis": 0.3, "aprosdoketophis": 0.4, "calamorhabdium": 0.3, "rhadinophanes": 0.4, "xyelodontophis": 0.8, "gracililima": 0.6, "myanophis": 0.4, "borealilysia": 0.2, "arcanumophis": 0.5, "palusophis": 0.8, "persiophis": 0.5, "paraxenophis": 0.5, "periergophis": 0.6, "proahaetulla": 0.8, "cenaspis": 0.4, "baliodryas": 0.8, "mopanveldophis": 1.2, "pseudoplectrurus": 0.3, "paraxenodermus": 0.4, "brygophis": 0.6, "micronatrix": 0.4, "eutrachelophis": 0.5, "caaeteboia": 0.5, "calamodontophis": 0.5, "emmochliophis": 0.4, "pseudoficimia": 0.35})
# v5.62: species whose size differs from their genus. Western hooknose snake: adults 18-28 cm, record 38.4 cm (Arizona Game
# and Fish Dept. abstract "Gyalopion canum", after Degenhardt et al. 1996); Mexican hooknose: the genus rarely exceeds 25.5 cm
SPECIES_LEN = {"gyalopion-canum": 0.23, "gyalopion-quadrangulare": 0.25}
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
    if c["id"] in SPECIES_LEN: return SPECIES_LEN[c["id"]], False
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
        sp = c["id"].split("-")[1]
        if sp in ("durissus", "simus", "culminatus", "totonacus", "tzabcan", "vegrandis", "unicolor"): return "diamond"  # neotropical rattlesnakes: rhombic blotches
        if sp in ("molossus", "basiliscus", "ornatus", "estebanensis", "oaxacus", "polystictus"): return "hourglass"  # black-tailed group: dark pale-centred blotches
        if sp in ("cerastes",): return "spot"  # sidewinder: rows of small spots
        return "rblotch"
    if g == "daboia": return "daboia"
    if g == "bothrops": return "trap"
    if g == "telescopus": return "blotch"
    if g == "corallus" and green: return "crossbar"
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
    # v5.58: re-checked against its SnakeList photo (kha, iNaturalist photo 10109512): one even grass green from head to tail (no
    # darker tail), the green running down to the edge of the belly, pale yellow-green lip scales, a long head (about three times as
    # long as the neck is deep) only a little wider than the neck, a big eye - about half the head's depth - set high, halfway along
    # the mouth line, black with a round pupil and a thin pale rim; glossy smooth scales with no flecks; adults 36-51 cm, record ~66 cm;
    # the tail about 31% of the total length (Virginia Herpetological Society: 25-37%, average 31.5%)
    "opheodrys-vernalis": {"d": "#79bd45", "lat": "#86c650", "b": "#eef0c8", "t": "uniform", "s": "grass", "L": 0.45, "mx": "about 66 cm", "k": 0, "sp": {"grassA": "#55803a", "grassB": "#9ab860"},
                           "h": dict(DARK_EYE, iris="#1c140c", irisInner="#4a3a22", eyeRing="#d2c99c", pupilW=0.26, eye=0.43, eyeX=0.4, eyeA=56, len=0.036, w=0.95, h=0.8, snoutH=0.74, jaw=0.8,
                                     lips="pale", lipColor="#c8d968", bulge=0.16, brow=0.01, headRelief=0.3, groove=0.5), "bx": {"ld": 62, "neck": 0.78, "tail": 0.31},
                           "sx": {"gloss": 0.68, "rows": 15, "keel": 0, "relief": 0.7}, "cx": {"bellyA": 0.7, "bellySharp": 0.045, "mottle": 0.02, "var": 0.02, "flecks": 0, "edgeK": 0.55}},
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
    "natrix-natrix": {"d": "#6e624a", "lat": "#74684e", "b": "#d8d2bf", "c": "#f0c23a", "t": "collar2", "k": 1, "s": "riverbank",
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
    "xenopeltis-unicolor": {"d": "#3a2a24", "lat": "#3d2e28", "b": "#e6e2d6", "t": "plain", "sx": {"gloss": 1, "iridescence": 1}, "h": dict(DARK_EYE, iris="#2a1e18", irisInner="#3e2c22", plates=True)},
    "acanthophis-antarcticus": {"d": "#8a6e5a", "c": "#5a4234", "b": "#e3d6c0", "t": "band", "n": 50, "tt": "#e8dcc0", "bx": {"ld": 14, "neck": 0.5, "tail": 0.11}, "h": {"pupil": "slit", "iris": "#b9915a", "irisInner": "#dcb880", "w": 1.3}},
    "aspidites-ramsayi": {"d": "#d7964a", "c": "#8a5428", "b": "#f0e2c0", "t": "band", "n": 50, "hc": "#e2b070", "h": {"iris": "#5a3a22", "irisInner": "#7a5432"}},
    "boiga-dendrophila": {"d": "#141414", "lat": "#181816", "c": "#f0d040", "b": "#2c2c26", "t": "band", "n": 44, "lip": "#f2d84a", "h": {"iris": "#2a2018", "irisInner": "#3a2c20", "irisDark": 1, "pupil": "slit"}, "sx": {"gloss": 0.75}},
    "hierophis-viridiflavus": {"d": "#1b1d16", "lat": "#1f2118", "c": "#c9c24a", "b": "#d8d4a0", "t": "plain", "cx": {"speckle": {"p": 0.5, "color": "#c9c24a", "k": 0.75}}, "h": {"iris": "#7a6a3a", "irisInner": "#b49a50"}},
    "crotalus-scutulatus": {"d": "#a39a6c", "c": "#5a4a32", "b": "#e2dcc0", "t": "diamond"},
    "tropidolaemus-wagleri": {"d": "#2f8a2a", "lat": "#3a942e", "c": "#e6dc5a", "b": "#c8d880", "t": "band", "n": 36, "h": {"iris": "#c8b040", "irisInner": "#e6d070"}},
    "sistrurus-miliarius": {"d": "#8a7a6a", "c": "#2a2420", "b": "#e2d8c8", "t": "spot", "vs": ["#c26a3a", 0.035]},
    "bothrops-atrox": {"d": "#8a7a5a", "c": "#3a2e20", "b": "#ddd2b6"},
    "chrysopelea-ornata": {"d": "#8fb03a", "lat": "#98b844", "c": "#141a0c", "b": "#d8e0a0", "t": "band", "n": 60, "cx": {"scaleEdge": {"color": "#141a0c", "k": 0.7}}},
    # v5.25: from the round-B photo checks
    "pantherophis-bairdi": {"d": "#8a7a62", "c": "#3e3428", "b": "#e6d8b8", "t": "stripe", "s": "arid"},
    "masticophis-taeniatus": {"d": "#2a2a26", "lat": "#33312a", "c": "#e8e2c8", "b": "#e8dcc8", "t": "stripe"},
    "calamaria-yunnanensis": {"d": "#18171a", "lat": "#1a191c", "b": "#e0782a", "t": "plain", "ls": ["#e0782a", 0.56, 0.09]},
    # v5.34: a random sample of 80 photos against their models
    # v5.35: an audit of 30 well-known and 60 random species against their photos
    "chrysopelea-paradisi": {"d": "#16180f", "lat": "#16180f", "c": "#c4402a", "b": "#b8d060", "t": "plain", "cx": {"speckle": {"p": 1.0, "dot": 0.45, "color": "#a8cc3a", "k": 0.92}, "noEdge": 1}, "vs": ["#c4402a", 0.025]},
    "tropidonophis-elongatus": {"d": "#a0502c", "lat": "#a0502c", "t": "plain"},
    "boaedon-capensis": {"d": "#6a4a32", "lat": "#6a4a32", "t": "plain", "ls": ["#e2d2b0", 0.42, 0.03], "lip": "#e2d2b0"},
    "tropidodipsas-tricolor": {"d": "#141210", "lat": "#141210", "c": "#e08a3a", "b": "#e0d8c8", "t": "band"},
    "oxyrhopus-vanidicus": {"d": "#18181a", "lat": "#18181a", "c": "#e8c440", "t": "band"},
    "lycophidion-variegatum": {"d": "#1c1c20", "lat": "#1c1c20", "t": "plain", "cx": {"speckle": {"p": 0.45, "color": "#e6e2da", "k": 0.85}, "mottle": 0.05}},
    "xenophidion-acanthognathus": {"d": "#7a5a48", "lat": "#7a5a48", "c": "#3a2a20", "t": "blotch"},
    "rhabdophis-chrysargos": {"d": "#8a4a2a", "lat": "#8a4a2a"},
    "masticophis-schotti": {"d": "#6a9a98", "lat": "#6a9a98", "ls": ["#e2a080", 0.6, 0.03]},
    "rhabdophis-himalayanus": {"d": "#2c3226", "lat": "#2c3226", "c": "#e0702a", "t": "spot"},
    "laticauda-crockeri": {"d": "#2a2226", "lat": "#2a2226", "t": "plain"},
    "uropeltis-bhupathyi": {"d": "#24262c", "lat": "#26282e", "t": "plain"},
    "uropeltis-macrolepis": {"d": "#1e2026", "lat": "#1e2026", "b": "#e8b830", "t": "plain", "ls": ["#e8b830", 0.66, 0.12]},
    "hydrophis-cyanocinctus": {"d": "#c4c2a4", "lat": "#c4c2a4"},
    "bungarus-flaviceps": {"d": "#151416", "lat": "#151416", "t": "plain", "hc": "#c8402a", "hcx": 1.1, "tt": "#c8402a"},
    "pseudoboa-serrana": {"d": "#c8743a", "lat": "#c8743a", "t": "plain"},
    "clonophis-kirtlandii": {"d": "#9a5a3a", "lat": "#9a5a3a", "c": "#2a1a14", "t": "spot"},
    "drymobius-margaritiferus": {"d": "#2a2a1e", "lat": "#2a2a1e", "c": "#d8c44a", "t": "speckle"},
    "oreocryptophis-porphyraceus": {"d": "#b8452c", "lat": "#b8452c", "c": "#2a1a14", "t": "band"},
    "sinomicrurus-swinhoei": {"d": "#7a4a30", "lat": "#7a4a30", "c": "#141110", "b": "#d8c8a0", "t": "band"},
    "erythrolamprus-frenatus": {"d": "#232325", "lat": "#232325", "c": "#c0442c", "t": "speckle"},
    "scolecophis-atrocinctus": {"d": "#c84a32", "lat": "#c84a32", "c": "#141110", "t": "band"},
    "atractus-tartarus": {"d": "#d8d2c4", "lat": "#d8d2c4", "t": "plain"},
    "dasypeltis-gansi": {"d": "#c89a72", "lat": "#c89a72", "t": "plain"},
    "dendrelaphis-nigroserratus": {"d": "#3a3630", "lat": "#3a3630"},
    "spalerosophis-arenarius": {"d": "#d9a27a", "lat": "#d8a07a", "c": "#a8432c", "t": "spot"},
    "synophis-niceforomariae": {"ls": ["#d8b040", 0.55, 0.04]},
    "cemophora-lineri": {"d": "#e6d9bd", "lat": "#e6d9bd", "c": "#b8382a", "t": "saddle"},
    "calamaria-banggaiensis": {"d": "#1e1e22", "lat": "#222226", "t": "plain"},
    "lycodon-semicarinatus": {"d": "#c46a2a", "lat": "#c46a2a", "c": "#1a1614", "t": "band"},
    "ninia-atrata": {"d": "#2a2a2e", "lat": "#2c2c30", "c": "#c0442c", "t": "collar"},
    "mussurana-bicolor": {"hc": "#151414", "hcx": 1.0},
    "enuliophis-sclateri": {"d": "#202022", "lat": "#232325", "t": "plain"},
    "sonora-michoacanensis": {"d": "#c8402c", "lat": "#c8402c", "c": "#141110", "t": "band"},
    "bothriechis-nigroviridis": {"d": "#5a9a3a", "lat": "#5e9e3e", "c": "#141812", "t": "speckle"},
    "helicops-apiaka": {"d": "#7a6a52", "lat": "#7a6a52", "c": "#2a2018", "t": "band"},
    "crotalus-totonacus": {"d": "#6a5a44", "lat": "#6e5e48", "c": "#2a2018"},
    "prosymna-pitmani": {"d": "#3a3a3e", "lat": "#3c3c40", "b": "#e0dcd0"},
    "sibynophis-sagittarius": {"d": "#8a6a48", "lat": "#8a6a48", "ls": ["#2a2018", 0.5, 0.04]},
    "oligodon-erythrogaster": {"d": "#6a6660", "lat": "#6a6660", "c": "#2a2622", "t": "stripe"},
    "sibynophis-triangularis": {"d": "#9a8a70", "lat": "#9a8a70"},
    "micrurus-hemprichii": {"d": "#141110", "lat": "#141110", "c": "#e07a2a", "b": "#e07a2a", "t": "band"},
    "gloydius-liupanensis": {"d": "#7a6650", "lat": "#7a6650", "c": "#3a2c20", "t": "blotch"},
    "anilios-affinis": {"d": "#b08070", "lat": "#b08070"},
    "antillotyphlops-catapontus": {"d": "#d89a88", "lat": "#d89a88"},
    "erythrolamprus-sagittifer": {"d": "#d8ccb0", "lat": "#d8ccb0", "c": "#2a2420", "t": "spot"},
    "hebius-atemporalis": {"d": "#5a2e24", "lat": "#5a2e24", "lip": "#e0d0a0"},
    "aspidites-melanocephalus": {"d": "#c89a60", "lat": "#c89a60", "c": "#5a3a22"},
    "lycodryas-pseudogranuliceps": {"d": "#c8a070", "lat": "#c8a070", "c": "#4a2a1a"},
    "lycophidion-meleagre": {"d": "#2a2420", "lat": "#2a2420", "c": "#d8c8a8", "t": "speckle"},
    "vermicella-parscauda": {"c": "#e8e8e0"},
    "atheris-rungweensis": {"c": "#2a3a1a", "t": "speckle"},
    # v5.31: species whose photos showed the generated pattern was wrong
    "bungarus-fasciatus": {"d": "#dcc66e", "lat": "#dcc66e", "c": "#141313", "b": "#ead9a0", "t": "band", "n": 36, "hc": "#161514", "hcx": 0.85},  # black and yellow bands
    "trimetopon-slevini": {"d": "#7a4a2e", "lat": "#6e4430", "c": "#3a2418", "t": "stripe"},
    "amastridium-sapperi": {"d": "#1d1b19", "lat": "#211e1b", "c": "#121110", "t": "plain", "hc": "#8e4426", "hcx": 0.9},  # black, rusty head
    "lygophis-elegantissimus": {"d": "#1f1c1a", "c": "#e6dcc4", "t": "stripe", "ls": ["#c4442c", 0.26, 0.045]},
    "limaformosa-capensis": {"d": "#7a7470", "lat": "#8e8280", "c": "#3c3a38", "t": "net", "vs": ["#d9d5ca", 0.04]},  # grey, pale keeled spine line
    "epictia-tricolor": {"d": "#5a3a2a", "c": "#e0a850", "t": "stripe"},
    "philodryas-patagoniensis": {"d": "#9a7a48", "c": "#4a3a22", "t": "net"},
    "hemirhagerrhis-nototaenia": {"d": "#c4c6bf", "lat": "#c9cbc4", "c": "#3a3632", "t": "speckle"},  # mopane snake: pale speckles
    "atretium-schistosum": {"d": "#5e6a3e", "lat": "#66703f", "b": "#e0b850", "t": "plain"},
    "rhadinella-kinkelini": {"d": "#8a4a32", "lat": "#8e4e36", "b": "#e8c8a8", "t": "plain"},
    "ninia-psephota": {"d": "#2a2826", "lat": "#2e2c2a", "b": "#d8cfc0", "t": "plain"},
    "masticophis-barbouri": {"d": "#2c2a26", "lat": "#34302a", "c": "#d8d0b8", "b": "#e2dac4", "t": "stripe"},
    "hierophis-cypriensis": {"d": "#18181a", "lat": "#1c1c1e", "b": "#5a5a58", "t": "plain"},
    "malpolon-insignitus": {"d": "#8a7458", "lat": "#8e7a5e", "b": "#e0d8c4", "t": "plain"},
    "erythrolamprus-andinus": {"d": "#7a3a2a", "lat": "#80402e", "b": "#d8c0a0", "t": "plain"},
    "leptodeira-septentrionalis": {"d": "#c88a52", "c": "#2a1e16", "b": "#efe0c6", "t": "blotch", "n": 30},
    "corallus-cropanii": {"d": "#8a7a5a", "c": "#2a2218", "b": "#d8cca8", "t": "blotch", "n": 40},
    "hoplocephalus-bungaroides": {"d": "#151513", "lat": "#171715", "b": "#7a7462", "t": "plain", "cx": {"speckle": {"p": 0.35, "color": "#e8d870", "k": 0.85}}},
    "aspidelaps-lubricus": {"d": "#d8743a", "c": "#151210", "b": "#efe0c6", "t": "band", "n": 30},
    "aspidelaps-scutatus": {"d": "#b8824e", "c": "#151210", "b": "#e2d2b0", "t": "plain", "cx": {"speckle": {"p": 0.3, "color": "#3a2a1e", "k": 0.6}}, "pat": [{"type": "band", "t": [0.07, 0.17], "count": 1, "len": 0.9, "color": "#151210", "warp": 0.1, "jit": 0}]},
    "atheris-matildae": {"d": "#1c1c14", "lat": "#20201a", "b": "#c8c070", "t": "plain", "k": 1, "cx": {"speckle": {"p": 0.6, "color": "#d8d040", "k": 0.85}}},
    "atheris-subocularis": {"d": "#d8a250", "lat": "#dca856", "b": "#ecd8a8", "t": "plain", "k": 1},
    # v5.22: fixes from photo checks
    "atractus-modestus": {"d": "#d8d23a", "lat": "#dcd640", "b": "#e8e070", "t": "plain"},
    "atractus-ukupacha": {"d": "#1c1816", "c": "#d2703a", "b": "#d8b090", "t": "xband"},
    "atractus-medusa": {"d": "#a8462c", "lat": "#ac4a30", "c": "#2a1e18", "b": "#d8a080", "t": "blotch"},
    "causus-lichtensteinii": {"d": "#5a6e2e", "lat": "#627634", "b": "#c8d0a0", "t": "plain"},
    "morelia-spilota": {"d": "#b4ab92", "lat": "#aca286", "c": "#1e1c18", "b": "#e2dcc6", "t": "blotch", "n": 50, "L": 2.0, "s": "forest", "sx": {"gloss": 0.5, "iridescence": 0.1}},
    # v5.19: patterns checked against photos
    "crotalus-ruber": {"d": "#b5826a", "c": "#7a3c2a", "b": "#e8dccb", "t": "diamond", "n": 34, "L": 1.1, "s": "arid", "tl": {"rattle": 7}, "pat": [{"type": "band", "t": [0.88, 0.985], "count": 5, "len": 0.5, "color": "#1a1512", "warp": 0.2, "jit": 0.02}]},
    "nerodia-sipedon": {"d": "#5e4a3a", "lat": "#624e3c", "c": "#2a1a14", "b": "#e2d6c0", "t": "band", "n": 32, "L": 0.9, "s": "riverbank", "k": 1, "ck": "#7a3a2a"},
    "laticauda-laticaudata": {"d": "#5f7fa6", "lat": "#6a88ac", "c": "#121214", "b": "#d8d8c8", "t": "band", "n": 40, "L": 1.0, "s": "sea"},
    "thamnophis-sirtalis": {"d": "#2a2a22", "lat": "#36322a", "b": "#d3cb9c", "c": "#121110", "t": "plain", "vs": ["#e4cf62", 0.045], "ls": ["#e8d77a", 0.52, 0.05], "k": 1, "L": 0.7, "s": "grass", "h": {"iris": "#c8a050", "irisInner": "#e6c878"}, "pat": [{"type": "blotch", "count": 70, "a": 0.3, "mirror": True, "alt": True, "wid": 0.07, "len": 0.35, "shape": "rect", "color": "#121110"}]},
    # v5.18: iconic species checked against their photos
    # (heterodon-nasicus: see GENUS_LOOK)
    # v5.43: a second audit - well-known species re-rendered and compared with their photos
    "crotalus-viridis": {"d": "#8e7c5e", "lat": "#8a785c", "c": "#4a3424", "b": "#e2dcc0", "t": "rblotch", "n": 40},
    "crotalus-oreganus": {"d": "#9a8e78", "lat": "#968a74", "c": "#3e2e22", "b": "#e2d8c4", "t": "rblotch", "n": 36},
    "sistrurus-catenatus": {"d": "#958670", "lat": "#90826c", "c": "#45301f", "b": "#d8d0c0", "t": "rblotch", "n": 42},
    "pantherophis-emoryi": {"d": "#a39279", "lat": "#9e8d74", "c": "#6a4630", "b": "#e6dcc6"},
    "elaphe-carinata": {"d": "#8a7a3a", "lat": "#86763a", "c": "#1e1a12", "b": "#e0cf6a", "t": "net", "n": 44},
    "elaphe-climacophora": {"d": "#7e7a64", "lat": "#7a7660", "c": "#4a4a36", "b": "#e0dcbc", "t": "stripe"},
    "masticophis-flagellum": {"d": "#a07050", "lat": "#a07254", "b": "#e8cfc0", "t": "plain"},
    "hemachatus-haemachatus": {"d": "#2a2826", "lat": "#2c2a28", "c": "#b8b2a4", "b": "#1e1c1a", "t": "band", "n": 44},
    "bungarus-multicinctus": {"d": "#141416", "lat": "#161618", "c": "#e6e4dc", "b": "#e8e4d8", "t": "band", "n": 60},
    "pseudonaja-nuchalis": {"d": "#b8962e", "lat": "#b4922e", "b": "#e8d8a0", "t": "plain"},
    "vipera-aspis": {"d": "#a07a58", "lat": "#9c7656", "c": "#4a2e1e", "b": "#4a403a"},
    "vipera-ammodytes": {"c": "#3a2a1e"},
    "bitis-nasicornis": {"d": "#5a6268", "lat": "#586066", "c": "#1a1a1c", "b": "#5a6a5a", "t": "chevron", "n": 34},
    "python-sebae": {"d": "#9a845e", "lat": "#94805c", "c": "#4a3622", "b": "#e2d6b8", "t": "blotch", "n": 44},
    "corallus-hortulana": {"d": "#b89a72", "lat": "#b4966e", "c": "#7a5a3c", "b": "#e6dcc4", "t": "blotch", "n": 40},
    "aipysurus-laevis": {"d": "#9aa8a6", "lat": "#9eaca8", "b": "#d8dcd0", "t": "plain"},
    "eryx-johnii": {"d": "#7a4a32", "lat": "#7e4e36", "b": "#c89a80", "t": "plain"},
    "eryx-jaculus": {"d": "#b8946a", "lat": "#b4906a", "c": "#5a3c26", "b": "#e6d8c0", "t": "blotch", "n": 40},
    "charina-bottae": {"d": "#9a8462", "lat": "#988262", "b": "#d8c890", "t": "plain"},
    "nerodia-fasciata": {"d": "#8a5a3e", "lat": "#86583c", "c": "#2a2420", "b": "#e0c8a0", "t": "band", "n": 30, "k": 1},
    "diadophis-punctatus": {"d": "#2e3034", "lat": "#303236", "c": "#e8a030", "b": "#e8b040", "t": "collar"},
    "storeria-dekayi": {"d": "#7a6650", "lat": "#7a6650", "b": "#e0d0b8", "t": "plain", "vs": ["#a8987c", 0.05]},
    "carphophis-amoenus": {"d": "#6a4e42", "lat": "#6e5246", "b": "#e09a8a", "t": "plain"},
    "farancia-abacura": {"d": "#141416", "lat": "#161618", "b": "#d8402e", "t": "plain", "sx": {"gloss": 0.85},
                         "pat": [{"type": "blotch", "t": [0.05, 0.98], "count": 40, "a": 0.72, "mirror": True, "alt": True, "wid": 0.3, "len": 0.5, "shape": "rect", "color": "#d8402e", "warp": 0.3}]},
    "calloselasma-rhodostoma": {"d": "#b88a68", "lat": "#b48666", "c": "#5a2e1e", "b": "#e6d8c4", "t": "trap", "vs": ["#4a2618", 0.03], "h": {"iris": "#a07040", "irisInner": "#c8985a"}},
    "deinagkistrodon-acutus": {"d": "#b8aa94", "lat": "#b4a690", "c": "#5a4030", "b": "#e2dccc", "t": "trap"},
    "gloydius-halys": {"d": "#8a7a62", "lat": "#86765e", "c": "#4a3a2a", "b": "#d8d0bc", "t": "rblotch"},
    "protobothrops-mucrosquamatus": {"d": "#9a7e5e", "lat": "#967a5a", "c": "#4a3020", "b": "#e2d8c4", "t": "blotch", "n": 50},
    "antaresia-childreni": {"d": "#8a7660", "lat": "#86725c", "c": "#4a3a2a", "b": "#e2d8c4", "t": "blotch", "n": 50},
    "liasis-mackloti": {"d": "#9c9a8c", "lat": "#989688", "c": "#5a5850", "b": "#e2e0d4", "t": "speckle"},
    "candoia-carinata": {"d": "#7a6a58", "lat": "#766654", "c": "#2a241e", "b": "#d8ccb8", "t": "blotch", "n": 40},
    "sanzinia-madagascariensis": {"d": "#8a6a40", "lat": "#86663e", "c": "#3a2a1a", "b": "#e0d0b0", "t": "blotch", "n": 36},
    "acrantophis-madagascariensis": {"d": "#a89070", "lat": "#a48c6c", "c": "#3a2a1e", "b": "#e2d6c0", "t": "blotch", "n": 34},
    # the v5.35 audit fixes, re-rendered
    "enulius-oligostichus": {"d": "#4a3a32", "lat": "#4a3a32", "t": "plain"},
    "lytorhynchus-paradoxus": {"d": "#c8ad84", "lat": "#c4a980", "c": "#5a4030", "t": "blotch"},
    "apostolepis-flavotorquata": {"d": "#8a4a32", "lat": "#8a4a32", "t": "collar", "c": "#e8d060"},
    "arizona-elegans": {"d": "#c2a37c", "lat": "#be9f78", "c": "#6e4a2c", "t": "blotch"},
    "rhinophis-karinthandani": {"d": "#3a2a2e", "lat": "#3a2a2e"},
    "hypnale-nepa": {"d": "#7a7068", "lat": "#7a7068", "c": "#55524c", "t": "speckle"},
    "micrurus-medemi": {"d": "#141416", "lat": "#141416", "b": "#d8dce0", "t": "plain", "pat": [{"type": "band", "t": [0.06, 0.98], "count": 44, "len": 0.2, "color": "#d8dce0", "warp": 0.2, "jit": 0.04}]},
    "pantherophis-slowinskii": {"d": "#9a8a74", "lat": "#968670", "c": "#4a3628"},
    "ophryacus-sphenophrys": {"d": "#b07a40", "lat": "#b07a40", "c": "#94602c", "t": "blotch"},
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
    # v5.35: glossy black, one small yellow-white spot in the middle of every scale, yellow lips and chin, yellow belly chequered black
    'lampropeltis-holbrooki': {'d': '#111210', 'lat': '#121310', 'b': '#e2d47a', 't': 'plain', 'L': 1.1, 's': 'grass', 'lip': '#e2d47a', 'cx': {'speckle': {'p': 1.0, 'dot': 0.72, 'color': '#efe39a', 'k': 0.95}, 'mottle': 0.02, 'bellyA': 0.8, 'noEdge': 0}, 'k': 0, 'sx': {'gloss': 0.75}},
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
    # v5.43: hand-made profiles that rendered much paler or greyer than their photos
    "indotyphlops-braminus": [(("colors", "dorsal"), "#5a3428"), (("colors", "lateral"), "#5e382c")],
    "vipera-berus": [(("colors", "dorsal"), "#6a5a44"), (("colors", "lateral"), "#665640")],
    "vipera-latastei": [(("colors", "dorsal"), "#8a7660"), (("colors", "lateral"), "#86725c"), (("pattern", 0, "color"), "#4a3628")],
    "bothrops-asper": [(("colors", "dorsal"), "#8e6648"), (("colors", "lateral"), "#8a6446"), (("pattern", 0, "color"), "#3a2418")],
    # v5.43: eastern hognose - the upturned, keeled shovel snout of the genus (see GENUS_LOOK), short stout body; its photo
    # shows the common grey phase: pale grey ground with big black blotches, black side blotches, dark head band and neck spots
    "heterodon-platirhinos": [(("head",), {"w": 1.02, "h": 0.6, "snout": 0.42, "snoutH": 0.5, "snoutUp": 0.45, "upturn": 0.62, "upLen": 0.34, "eyeX": 0.36, "tip": 0.25, "tipR": 0.08,
                                           "len": 0.036, "eye": 0.14, "iris": "#7a6040", "irisInner": "#b08a50"}),
                              (("body",), {"ld": 19, "neck": 0.86, "tail": 0.15, "peak": 0.45}),
                              (("colors",), {"dorsal": "#8f8a80", "lateral": "#88837a", "belly": "#8a857c", "mottle": 0.08}),
                              (("pattern",), [{"type": "blotch", "t": [0.08, 0.93], "count": 26, "a": 0, "wid": 0.36, "len": 0.72, "shape": "rect", "color": "#1d1b19", "edgeColor": "#0e0d0c", "edge": 0.1, "warp": 0.6},
                                              {"type": "blotch", "t": [0.08, 0.93], "count": 26, "phase": 0.5, "a": 0.62, "mirror": True, "alt": True, "wid": 0.18, "len": 0.62, "shape": "round", "color": "#1d1b19", "warp": 0.5},
                                              {"type": "line", "p0": [0.2, 0.0], "p1": [0.27, 0.32], "wid": 0.045, "color": "#1d1b19", "mirror": True, "aa": 0.35},
                                              {"type": "line", "p0": [0.36, 0.37], "p1": [0.82, 0.56], "wid": 0.045, "color": "#1d1b19", "mirror": True, "aa": 0.35},
                                              {"type": "spot", "p": [1.4, 0.3], "r": [0.38, 0.15], "color": "#1d1b19", "mirror": True}])],
    'bungarus-caeruleus': [(('scales', 'vert'), 2.2)],  # v5.23: enlarged hexagonal middle row
    # v5.19: patterns checked against photos (chequered bellies, reticulated net, copperhead hourglasses, timber chevrons, diamond chain, kingsnake chain, bushmaster rhomboids)
    'pantherophis-guttatus': [(('pattern',), [{'type': 'blotch', 't': [0.06, 0.95], 'count': 36, 'a': 0, 'wid': 0.3, 'len': 0.62, 'shape': 'round', 'color': '#a8331f', 'edgeColor': '#1a1210', 'edge': 0.15, 'warp': 0.3}, {'type': 'blotch', 't': [0.06, 0.95], 'count': 36, 'phase': 0.5, 'a': 0.6, 'mirror': True, 'alt': True, 'wid': 0.1, 'len': 0.4, 'color': '#a8331f', 'edgeColor': '#2a1a14', 'edge': 0.2}, {'type': 'blotch', 't': [0.06, 0.97], 'count': 70, 'a': 0.9, 'mirror': True, 'alt': True, 'belly': True, 'wid': 0.06, 'len': 0.5, 'shape': 'rect', 'color': '#1a1512'}, {'type': 'poly', 'pts': [[0.25, 0], [0.6, 0.12], [1.3, 0.14], [1.3, -0.14], [0.6, -0.12]], 'color': '#b03a22'}, {'type': 'line', 'p0': [0.3, 0.4], 'p1': [1.0, 0.62], 'wid': 0.06, 'color': '#a8331f', 'mirror': True}, {'type': 'checker', 'belly': True, 'color': '#141210', 'alpha': 0.9, 'skip': 0.1}])],
    'pantherophis-obsoletus': [(('pattern',), [{'type': 'blotch', 't': [0.06, 0.95], 'count': 34, 'a': 0, 'wid': 0.3, 'len': 0.6, 'color': '#2c2824', 'alpha': 0.8}, {'type': 'line', 'p0': [0.05, 0.66], 'p1': [0.9, 0.64], 'wid': 0.1, 'color': '#d8d2c2', 'mirror': True}, {'type': 'checker', 'belly': True, 'color': '#2a2824', 'alpha': 0.6, 'skip': 0.1}])],
    'malayopython-reticulatus': [(('colors', 'dorsal'), '#9a7c44'), (('colors', 'lateral'), '#a08040'), (('pattern',), [{'type': 'net', 't': [0.05, 0.97], 'count': 46, 'na': 2.1, 'wid': 0.11, 'color': '#15100a', 'edgeColor': '#e0cc8e', 'edge': 0.4, 'warp': 0.7}, {'type': 'blotch', 't': [0.05, 0.97], 'count': 46, 'phase': 0.5, 'a': 0.62, 'mirror': True, 'wid': 0.08, 'len': 0.3, 'shape': 'diamond', 'color': '#e2dccb', 'warp': 0.4}, {'type': 'cap', 'x0': 0, 'x1': 1.04, 'wid': 0.6, 'color': '#9a7a40'}, {'type': 'line', 'p0': [0.04, 0], 'p1': [1.2, 0], 'wid': 0.018, 'color': '#120c06'}, {'type': 'line', 'p0': [0.33, 0.37], 'p1': [1.0, 0.54], 'wid': 0.03, 'color': '#120c06', 'mirror': True}, {'type': 'line', 'p0': [0.04, 0.64], 'p1': [0.82, 0.63], 'wid': 0.06, 'color': '#d6c48c', 'mirror': True}])],
    'agkistrodon-contortrix': [(('pattern', 0, 'shape'), 'hourglass2'), (('pattern', 0, 'wid'), 0.98), (('pattern', 0, 'len'), 1.05), (('colors', 'dorsal'), '#9a7050'), (('colors', 'lateral'), '#966c4e'), (('pattern', 0, 'color'), '#6a3420')],
    'agkistrodon-piscivorus': [(('pattern', 0, 'shape'), 'hourglass2'), (('pattern', 0, 'alpha'), 0.7), (('pattern', 0, 'wid'), 0.98)],
    'crotalus-horridus': [(('pattern', 1, 'wid'), 0.55), (('pattern', 1, 'len'), 0.42), (('pattern', 1, 'warp'), 0.3)],
    'crotalus-adamanteus': [(('pattern', 0, 'len'), 1.25), (('pattern', 0, 'wid'), 0.19), (('pattern', 0, 'edge'), 0.2)],
    'crotalus-atrox': [(('pattern', 0, 'len'), 1.25), (('pattern', 0, 'wid'), 0.19), (('pattern', 0, 'edge'), 0.2), (('pattern', 1, 'a'), 0.52)],
    'lampropeltis-getula': [(('pattern',), [{'type': 'chain', 't': [0.05, 0.96], 'count': 24, 'na': 1.5, 'wid': 0.065, 'color': '#ece6cf', 'warp': 0.25, 'a0': 0.3, 'a1': 0.86}, {'type': 'checker', 'belly': True, 'color': '#ece6cf', 'alpha': 0.7, 'skip': 0.1}])],
    'lachesis-muta': [(('colors', 'dorsal'), '#c9a37e'), (('colors', 'lateral'), '#c8a27c'), (('pattern', 0, 'warp'), 0.12), (('pattern', 0, 'inner', 'r'), 0.4), (('pattern', 0, 'inner', 'color'), '#9a7652'), (('pattern', 0, 'len'), 0.72), (('pattern', 0, 'wid'), 0.32), (('pattern', 0, 'count'), 28)],
    # v5.18: eastern milksnake - wider red-brown saddles edged in black on a grey-tan ground
    "lampropeltis-triangulum": [(("pattern", 0, "wid"), 0.46), (("pattern", 0, "color"), "#8e3a26"), (("pattern", 1, "color"), "#8e3a26"), (("colors", "dorsal"), "#857d6e"), (("colors", "lateral"), "#80786a")],
    # v5.16: bushmaster - separate dark rhomboid blotches (pale centres) on a pinkish tan ground; they had merged into bands
    # v5.16: yellow-bellied sea snake - the water line lower on its body, so the bright yellow lower flanks show above the water line
    "hydrophis-platurus": [(("colors", "belly"), "#f0c23a"), (("colors", "bellyA"), 0.34), (("scene", "float"), 0.3)],
    "bitis-gabonica": [(("head", "iris"), "#b49f74"), (("head", "irisInner"), "#d6c8a2"), (("pattern", 2, "color"), "#634842"),
                       (("pattern", 2, "inner", "color"), "#8a6a58"), (("pattern", 5, "color"), "#b8a079")],
}


# ---------- v5.62: model accuracy (the 92-species audit, see the notes on each table) ----------
# Body and tail by genus: girth (ld: length over diameter), head length (len, of total length), head/neck width (hn, the
# documented ratio sets the neck), tail (fraction of total length) and its shape (ts: whip, taper, abrupt, blunt,
# prehensile, lure). Tail ratios from published measurements (Virginia Herpetological Society samples: rough green 37.5%,
# ribbon 32.5%, garter 22%, corn 15%, kingsnake 11.8%, copperhead 13.3%, timber rattlesnake 7.6%) and species accounts.
GENUS_BODY = {
    # colubrids
    "lampropeltis": {"tail": 0.13, "ld": 30, "hn": 1.1}, "pantherophis": {"tail": 0.16, "hn": 1.3}, "pituophis": {"tail": 0.13, "ld": 28, "hn": 1.1},
    "drymarchon": {"tail": 0.18, "hn": 1.15}, "thamnophis": {"tail": 0.23, "hn": 1.3}, "nerodia": {"tail": 0.22, "ld": 24, "hn": 1.35},
    "natrix": {"tail": 0.19}, "dasypeltis": {"tail": 0.15, "hn": 1.15}, "rhinocheilus": {"tail": 0.13, "hn": 1.0}, "coluber": {"tail": 0.25, "ts": "whip"},
    "masticophis": {"tail": 0.26, "ts": "whip"}, "dispholidus": {"tail": 0.27, "ts": "whip", "hn": 1.4}, "thelotornis": {"ts": "whip"},
    "oxybelis": {"ts": "whip"}, "langaha": {"ts": "whip"}, "ahaetulla": {"ts": "whip", "tail": 0.34}, "chrysopelea": {"tail": 0.29}, "boiga": {"tail": 0.22, "hn": 1.6}, "malpolon": {"tail": 0.2},
    "zamenis": {"tail": 0.18}, "myron": {"tail": 0.14, "ld": 28}, "erpeton": {"tail": 0.3, "ld": 20, "xs": 0.9}, "diadophis": {"tail": 0.2},
    "cylindrophis": {"tail": 0.04, "ts": "blunt", "tailFlat": 0.7, "hn": 1.0, "ld": 30},
    # elapids
    "bungarus": {"tail": 0.11, "ts": "blunt", "hn": 1.0}, "vermicella": {"tail": 0.06, "ts": "blunt", "hn": 1.0}, "notechis": {"tail": 0.13},
    "naja": {"tail": 0.16, "hn": 1.15}, "hemachatus": {"tail": 0.15}, "aspidelaps": {"tail": 0.12}, "pseudonaja": {"tail": 0.17, "hn": 1.05},
    "oxyuranus": {"tail": 0.16}, "acanthophis": {"tail": 0.14, "ts": "lure", "hn": 1.75}, "micrurus": {"tail": 0.1, "ts": "blunt"}, "micruroides": {"tail": 0.1, "ts": "blunt"},
    "pseudechis": {"tail": 0.17}, "dendroaspis": {"ts": "whip"},
    # vipers and pit vipers (abrupt behind the vent; tree vipers prehensile)
    "agkistrodon": {"tail": 0.13, "ts": "abrupt"}, "bothrops": {"tail": 0.13, "ts": "abrupt"}, "bothriechis": {"tail": 0.16, "ts": "prehensile"},
    "trimeresurus": {"tail": 0.17, "ts": "prehensile"}, "tropidolaemus": {"tail": 0.15, "ts": "prehensile"}, "atheris": {"tail": 0.17, "ts": "prehensile"},
    "lachesis": {"tail": 0.1}, "calloselasma": {"tail": 0.12, "ts": "abrupt"}, "bitis": {"tail": 0.1, "ts": "abrupt"}, "vipera": {"tail": 0.12, "ts": "abrupt"},
    "echis": {"tail": 0.1, "ts": "abrupt"}, "cerastes": {"tail": 0.1, "ts": "abrupt"}, "daboia": {"tail": 0.13, "ts": "abrupt"},
    # pythons and boas
    "corallus": {"tail": 0.17, "ts": "prehensile", "hn": 1.9}, "eunectes": {"ld": 21, "tail": 0.11}, "python": {"tail": 0.11}, "candoia": {"tail": 0.1},
    "charina": {"tail": 0.12, "ts": "blunt", "hn": 1.0}, "lichanura": {"tail": 0.12, "ts": "blunt", "hn": 1.05}, "eryx": {"ts": "blunt"}, "calabaria": {"ts": "blunt"},
    "aspidites": {"tail": 0.1, "hn": 1.0}, "acrantophis": {"ld": 18}, "sanzinia": {"tail": 0.12, "hn": 1.5}, "morelia": {"tail": 0.15, "hn": 1.7},
}
SPECIES_BODY = {
    "opheodrys-aestivus": {"tail": 0.375, "ld": 70, "ts": "whip", "hn": 1.2}, "thamnophis-saurita": {"tail": 0.325, "ts": "whip"}, "thamnophis-proximus": {"tail": 0.32, "ts": "whip"},
    "thamnophis-sirtalis": {"tail": 0.22}, "pantherophis-guttatus": {"tail": 0.15}, "lampropeltis-getula": {"tail": 0.12}, "zamenis-situla": {"tail": 0.17},
    "python-brongersmai": {"ld": 14, "tail": 0.09, "hn": 1.35}, "python-curtus": {"ld": 14, "tail": 0.09}, "python-breitensteini": {"ld": 14, "tail": 0.09},
    "candoia-aspera": {"ld": 14, "tail": 0.08, "hn": 1.6, "ts": "abrupt"}, "morelia-viridis": {"tail": 0.17, "ts": "prehensile", "hn": 1.9}, "morelia-azurea": {"tail": 0.17, "ts": "prehensile", "hn": 1.9},
    "python-sebae": {"tail": 0.13}, "bitis-arietans": {"tail": 0.1}, "dendroaspis-angusticeps": {"tail": 0.23},
}
# Eye diameter over head length (Z3): the family defaults are in viewer.js (EYE_L); these are genera that differ
GENUS_EYE = {"ahaetulla": 0.19, "thelotornis": 0.18, "oxybelis": 0.16, "langaha": 0.15, "imantodes": 0.22, "dispholidus": 0.2, "boiga": 0.17, "chrysopelea": 0.16,
             "dendrelaphis": 0.2, "leptophis": 0.18, "philothamnus": 0.18, "coluber": 0.17, "masticophis": 0.18, "malpolon": 0.2,
             "cylindrophis": 0.04, "anilius": 0.04, "naja": 0.12, "hemachatus": 0.11, "dendroaspis": 0.11, "pseudonaja": 0.12, "oxyuranus": 0.11,
             "acanthophis": 0.1, "vermicella": 0.05, "bungarus": 0.08, "micrurus": 0.08, "micruroides": 0.08, "laticauda": 0.07, "charina": 0.07, "lichanura": 0.07,
             "eunectes": 0.07, "corallus": 0.1, "bothriechis": 0.11, "echis": 0.11, "lachesis": 0.07, "dasypeltis": 0.13, "myron": 0.1, "erpeton": 0.08,
             "thamnophis": 0.15, "nerodia": 0.13, "crotalus": 0.09, "sistrurus": 0.1, "vipera": 0.1, "atheris": 0.11, "trimeresurus": 0.1}
SPECIES_EYE = {"morelia-viridis": 0.1, "morelia-azurea": 0.1, "thamnophis-saurita": 0.16, "opheodrys-aestivus": 0.18, "pantherophis-guttatus": 0.14}
# Fang length in mm (documented adult sizes, Z9), and rear fangs (opisthoglyphous snakes)
GENUS_FANG = {"crotalus": 9, "sistrurus": 4, "agkistrodon": 7, "bitis": 15, "daboia": 16, "echis": 4.5, "vipera": 5, "cerastes": 5, "bothriechis": 5, "bothrops": 20,
              "lachesis": 35, "trimeresurus": 6, "tropidolaemus": 7, "calloselasma": 8, "atheris": 5, "naja": 6.5, "ophiophagus": 11, "hemachatus": 4,
              "dendroaspis": 6, "pseudonaja": 3, "oxyuranus": 11, "notechis": 3.5, "acanthophis": 7, "bungarus": 3, "micrurus": 1.5, "micruroides": 1.2,
              "vermicella": 1, "laticauda": 2, "hydrophis": 1.5, "pseudechis": 4}
SPECIES_FANG = {"crotalus-atrox": 10, "crotalus-adamanteus": 18, "crotalus-horridus": 11, "crotalus-viridis": 8, "crotalus-cerastes": 5, "crotalus-scutulatus": 8,
                "agkistrodon-contortrix": 6, "agkistrodon-piscivorus": 10, "bitis-gabonica": 50, "bitis-arietans": 15, "bothrops-asper": 25, "dendroaspis-polylepis": 6.5,
                "dendroaspis-angusticeps": 5, "naja-haje": 7, "hydrophis-platurus": 1}
REAR_FANG = {"dispholidus": 4, "thelotornis": 3, "boiga": 3, "ahaetulla": 2, "oxybelis": 2, "malpolon": 4, "myron": 1.5, "erpeton": 1.5, "chrysopelea": 1.5,
             "langaha": 2, "heterodon": 2.5, "philodryas": 3, "psammophis": 3, "rhamphiophis": 3, "imantodes": 1.5, "telescopus": 2}
# Resting poses (S16): tree boas, tree pythons and tree vipers drape over a branch; cobras rise with the hood spread (S4)
DRAPE = {"corallus", "bothriechis", "atheris", "tropidolaemus"}
DRAPE_SP = {"morelia-viridis", "morelia-azurea", "trimeresurus-albolabris", "trimeresurus-stejnegeri", "trimeresurus-gramineus", "trimeresurus-macrops", "trimeresurus-insularis", "trimeresurus-popeiorum"}
HOODED = {"naja": {"x0": 1.2, "xm": 2.7, "x1": 6.5, "w": 2.7, "flat": 0.45}, "hemachatus": {"x0": 1.2, "xm": 2.6, "x1": 6, "w": 2.3, "flat": 0.5},
          "aspidelaps": {"x0": 1.3, "xm": 2.8, "x1": 5.5, "w": 1.9, "flat": 0.55}, "pseudohaje": {"x0": 1.4, "xm": 3.2, "x1": 7, "w": 1.8, "flat": 0.55},
          "walterinnesia": {"x0": 1.4, "xm": 3, "x1": 6, "w": 1.6, "flat": 0.6}}
# true rings (round the belly too); every other generated band or crossband stops at the belly (S6)
RINGED = {"bungarus", "vermicella", "laticauda", "micrurus", "micruroides", "calliophis", "sinomicrurus", "leptomicrurus", "hydrophis", "aipysurus", "emydocephalus",
          "simoselaps", "brachyurophis", "furina", "neelaps", "elapsoidea", "lycodon", "oligodon", "chilomeniscus", "chionactis", "sonora", "cemophora", "boiga"}


# Species fixes from the audit's ranked table (worst first), checked against each species' SnakeList photo and the
# documented look of one form (named in the note). Keys are the generated profile's keys; dicts (h, bx, sx, cx) merge.
AUDIT_FIX = {
    # 1 red-tailed pipe snake: a stout glossy cylinder, head no wider than the neck, tiny eyes; black with orange-red bars low on
    # the flanks (as in its photo), red under the flattened tail
    "cylindrophis-ruffus": {"d": "#18181c", "lat": "#1c1c20", "c": "#d2502a", "b": "#e9e2d0", "t": "none", "s": "litter",
        "h": {"w": 0.92, "snout": 0.85, "tip": 0.75, "len": 0.03, "shape": "blunt", "brow": 0, "pupil": "round", "iris": "#1a1614", "irisInner": "#2a2420", "irisDark": 1},
        "pat": [{"type": "blotch", "t": [0.05, 0.95], "count": 34, "a": 0.6, "mirror": True, "alt": True, "wid": 0.16, "len": 0.32, "shape": "rect", "color": "#d2502a", "warp": 0.4, "jit": 0.2, "sj": 0.3, "belly": True},
                {"type": "band", "t": [0.05, 0.95], "count": 30, "len": 0.3, "color": "#efe8d6", "aMin": 0.8, "belly": True, "warp": 0.3, "jit": 0.2},
                {"type": "tint", "t": [0.95, 1], "ramp": 0.02, "aRange": [0.45, 1], "color": "#d2502a"}]},
    # 2 tentacled snake: two soft tentacles on the snout, stiff keeled body, small upward eyes; dark brown with darker stripes
    "erpeton-tentaculatum": {"d": "#5a4a32", "lat": "#55462f", "c": "#2e2416", "b": "#b8ad92", "t": "none", "k": 1,
        "h": {"horns": "tentacles", "hornLen": 0.26, "hornColor": "#5a4a32", "eyeA": 42, "nostrilA": 22, "w": 1.0},
        "sx": {"keel": 1, "rows": 37, "gloss": 0.15}, "ls": ["#2e2416", 0.42, 0.09], "vs": ["#3a2e1c", 0.05]},
    # 3 longnose snake (tricolour form): black saddles flecked cream, red interspaces, cream belly, long pointed snout
    "rhinocheilus-lecontei": {"d": "#c8413a", "lat": "#cc5040", "c": "#141210", "b": "#efe6d0", "t": "tsaddle", "n": 32, "sc": "#e8dcc0", "hc": "#141210", "hcx": 0.95,
        "h": {"snout": 0.5, "tip": 0.3, "len": 0.038}, "sx": {"rows": 23}, "cx": {"speckle": {"p": 0.12, "color": "#2a1e18", "k": 0.6}}},
    # 4 common egg-eater (grey form, as in its photo): grey with dark rhombs, dark flank bars, a V on the neck, vertical pupil, few tiny teeth
    "dasypeltis-scabra": {"d": "#8a8a86", "lat": "#86857f", "c": "#3c3a36", "b": "#dcd8cc", "t": "rhomb", "n": 50,
        "h": {"pupil": "slit", "teeth": {"n": 0.2, "len": 0.5}, "iris": "#8a8478", "irisInner": "#b8b0a0"},
        "pat": [{"type": "line", "p0": [1.15, 0.0], "p1": [2.4, 0.3], "wid": 0.12, "color": "#3c3a36", "mirror": True, "xMax": 2.8, "aa": 0.3},
                {"type": "line", "p0": [0.75, 0.0], "p1": [1.6, 0.24], "wid": 0.09, "color": "#3c3a36", "mirror": True, "aa": 0.3},
                # v5.68 (references: species accounts - two V marks on top of the head and another on the neck)
                {"type": "line", "p0": [0.36, 0.0], "p1": [0.95, 0.2], "wid": 0.07, "color": "#3c3a36", "mirror": True, "aa": 0.3}]},
    # 5 Madagascar leaf-nosed snake (the long-nosed form in its photo): pale brown, a long flat nasal blade, pale lateral line
    "langaha-madagascariensis": {"d": "#a07c56", "lat": "#a68560", "c": "#5a4028", "b": "#e6dcb0", "t": "none", "ls": ["#e8e0c0", 0.6, 0.03],
        "h": {"horns": "rostral", "hornLen": 0.55, "hornUp": 0.05, "hornFlat": 0.35, "hornColor": "#9a7650", "w": 1.3}},
    # 6 carpet python (jungle-type, as in its photo): pale-centred blotches with heavy black rims on a dark ground, a dark eye stripe
    "morelia-spilota": {"d": "#2e2a22", "lat": "#34302a", "c": "#141210", "ic": "#c8c0a0", "b": "#e2dcc6", "t": "carpet", "n": 52,
        "es": ["#141210", 0.06], "h": {"iris": "#a89878", "irisInner": "#cfc3a0"}},
    # 7 monocled cobra (the common brown form): the O-shaped monocle on the back of the hood, pale throat, a dark band across it
    "naja-kaouthia": {"d": "#5e5242", "lat": "#625646", "c": "#2a221a", "b": "#e2d8bc", "t": "plain",
        "pat": [{"type": "ring", "p": [3.15, 0.0], "r": [0.45, 0.14], "w": 0.34, "color": "#1c1610", "fill": "#e6d8b0", "falpha": 0.95, "xMax": 4.0, "aa": 0.25, "warp": 0.15},
                {"type": "spot", "p": [3.15, 0.0], "r": [0.12, 0.035], "color": "#1c1610", "xMax": 4.0},
                {"type": "hband", "x0": 1.0, "x1": 2.4, "aMin": 0.42, "belly": True, "color": "#ece2c8", "xMax": 3.0, "alpha": 0.9, "warp": 0.2},
                {"type": "hband", "x0": 2.7, "x1": 3.4, "aMin": 0.5, "belly": True, "color": "#2a221a", "xMax": 3.9, "warp": 0.2},
                {"type": "spot", "p": [2.3, 0.6], "r": [0.28, 0.07], "mirror": True, "color": "#2a221a", "xMax": 3.2}]},
    # 8 Egyptian cobra: the broad dark throat band and the dark "tear" under the eye
    "naja-haje": {"d": "#6a5a44", "lat": "#6e5e48", "b": "#d6c8a6", "t": "plain", "ub": ["#2a221a", 0.1],
        "tb": [["#2a221a", 2.6, 4.2, 0.42]], "pat": [{"type": "hband", "x0": 1.0, "x1": 2.5, "aMin": 0.45, "belly": True, "color": "#e0d2b0", "xMax": 3.0, "alpha": 0.8, "warp": 0.2}]},
    # 9 blood python: blood-red to orange-brown, pale irregular blotches and dark flank marks, very stout, a pale crown line
    "python-brongersmai": {"d": "#a0482e", "lat": "#a24c30", "c": "#e2c49a", "lc": "#3a1e14", "ec": "#5a2a1a", "b": "#e6d6b6", "t": "irregular", "n": 30,
        "vs": ["#d8b48a", 0.03],
        # v5.68 (reference: the species account - the head is usually grey, a white stripe runs down and back from the rear edge of the eye)
        "hc": "#7c7470", "hcx": 1.0, "pat": [{"type": "line", "p0": [0.46, 0.4], "p1": [1.12, 0.66], "wid": 0.05, "color": "#ece6da", "mirror": True}]},
    # 10 rinkhals (banded form, as in its photo): dark with pale crossbands that stop at the belly, two pale bands across the dark throat, keeled
    "hemachatus-haemachatus": {"d": "#2a2826", "lat": "#2c2a28", "c": "#a8a294", "b": "#1e1c1a", "t": "band", "n": 46, "sx": {"keel": 0.8},
        "tb": [["#e6e0d0", 2.2, 2.7, 0.45], ["#e6e0d0", 3.3, 3.8, 0.45]]},
    # 11 Richardson's mangrove snake: grey-green with dark crossbands (its photo)
    "myron-richardsonii": {"d": "#7c8468", "lat": "#80886c", "c": "#2e3226", "b": "#dcdcc8", "t": "xband", "n": 44},
    # 12 Indian cobra (spectacled): the spectacle mark on the back of the hood, dark bands across the throat only
    "naja-naja": {"pat": [{"type": "ring", "p": [3.15, 0.17], "r": [0.46, 0.12], "w": 0.36, "color": "#1e1610", "fill": "#ead8a8", "falpha": 0.9, "mirror": True, "xMax": 4.0, "aa": 0.25, "warp": 0.15},
                          {"type": "line", "p0": [2.7, 0.0], "p1": [2.8, 0.12], "wid": 0.06, "color": "#1e1610", "mirror": True, "xMax": 4.0},
                          {"type": "hband", "x0": 1.0, "x1": 2.2, "aMin": 0.45, "belly": True, "color": "#ecdcb4", "xMax": 2.7, "alpha": 0.85, "warp": 0.2}],
                  "tb": [["#3a2818", 2.4, 2.9, 0.45], ["#3a2818", 3.7, 4.1, 0.5, 0.8]]},
    # 13 bandy-bandy: stark black and white rings of about equal width, a short blunt tail
    "vermicella-annulata": {"d": "#f0ede4", "lat": "#f0ede4", "b": "#f0ede4", "c": "#121212", "t": "band", "n": 82, "bl": 0.5, "sx": {"rows": 15, "gloss": 0.7}, "cx": {"mottle": 0.03}},
    # 14 New Guinea viper boa: short, very stout, viper-like; a dark zigzag on brown, keeled
    "candoia-aspera": {"t": "zigzag", "n": 40, "c": "#3a3026", "k": 1, "sx": {"keel": 0.8}, "h": {"shape": "tri", "w": 1.15}},
    # 15 common death adder: crossbands that stop at the belly, an ambush pile, only the lure tip pale
    "acanthophis-antarcticus": {"tt": "#e8dcc0", "tts": 0.965, "ps": {"kind": "stack", "pitch": 0.95, "lead": 0.26, "lift": 0.15, "tight": 0.55}, "h": {"w": 1.45}},
    # 16 African rock python: irregular dark-edged blotches merging into a wavy band, a dark spearhead and a dark mark under the eye
    "python-sebae": {"t": "irregular", "c": "#5a3e24", "ec": "#2a1c10", "lc": "#5a3e24", "sx": {"rows": 85}, "sp": ["#5a3e24", 1.25], "ub": ["#3a2614", 0.12]},
    # 17 Sanzinia: dark-rimmed, pale-centred saddles edged white, on grey-brown
    "sanzinia-madagascariensis": {"t": "esaddle", "d": "#7a6a4c", "lat": "#7e6e50", "c": "#2a2016",
        "pat": [{"type": "blotch", "count": 30, "a": 0, "wid": 0.44, "len": 0.6, "shape": "hourglass", "color": "#2a2016", "inner": {"r": 0.45, "color": "#a08860"}, "edgeColor": "#e8e0c8", "edge": 0.12, "edgeOut": True, "warp": 0.5, "jit": 0.15, "sj": 0.2}]},
    # 18 leopard snake: red, black-edged blotches on pale grey
    "zamenis-situla": {"d": "#b8b2a6", "lat": "#b4aea2", "c": "#b0402a", "b": "#e2dccc", "t": "none", "sx": {"rows": 25},
        "pat": [{"type": "blotch", "count": 44, "a": 0, "wid": 0.3, "len": 0.6, "shape": "round", "color": "#b0402a", "edgeColor": "#141210", "edge": 0.2, "warp": 0.35, "jit": 0.1},
                {"type": "blotch", "count": 44, "phase": 0.5, "a": 0.58, "mirror": True, "wid": 0.09, "len": 0.4, "shape": "round", "color": "#2a2420", "alpha": 0.85}], "es": ["#141210", 0.045]},
    # 19 Mojave rattlesnake: broad diamonds, white tail rings wider than the black, pale facial stripes
    "crotalus-scutulatus": {"bl": 0.35, "pat": [{"type": "line", "p0": [0.26, 0.4], "p1": [0.16, 0.62], "wid": 0.035, "color": "#e8e2cc", "mirror": True},
                                                {"type": "line", "p0": [0.4, 0.42], "p1": [0.85, 0.64], "wid": 0.04, "color": "#e8e2cc", "mirror": True}]},
    # 20 Montpellier snake (adult male): olive with a darker saddle on the forebody, a concave brow over a big eye
    "malpolon-monspessulanus": {"d": "#6e7046", "lat": "#72744a", "b": "#d8d0a0", "h": {"brow": 0.12},
        "pat": [{"type": "tint", "t": [0.08, 0.3], "ramp": 0.05, "aRange": [0, 0.6], "color": "#3a3a26", "alpha": 0.6}]},
    # 22 bushmaster: see the hand fix; 23 eyelash viper on a branch; 24 prairie rattlesnake: white-edged blotches and facial stripes
    "bothriechis-schlegelii": {},
    "crotalus-viridis": {"pe": "#efe8d8", "pat": [{"type": "line", "p0": [0.26, 0.4], "p1": [0.16, 0.62], "wid": 0.035, "color": "#ece6d4", "mirror": True},
                                 {"type": "line", "p0": [0.4, 0.42], "p1": [0.85, 0.64], "wid": 0.04, "color": "#ece6d4", "mirror": True}]},
    # 25 green anaconda: the heaviest snake; large paired black ovals, eyes and nostrils on top of the head
    "eunectes-murinus": {"h": {"eyeA": 40, "nostrilA": 22}},
    # 26 Cape cobra: colour fine; the hood and raised pose come from the genus
    # 28 nose-horned viper: the single horn on the snout, a bolder zigzag
    "vipera-ammodytes": {"h": {"horns": "rostral", "hornLen": 0.24, "hornUp": 1.6}},
    # 30 northern water snake: crossbands on the forebody, then alternating blotches
    "nerodia-sipedon": {"t": "nerodia", "n": 40},
    # 32 eastern ribbon snake: near-black with bright yellow stripes, a white spot before the eye
    "thamnophis-saurita": {"d": "#2a2620", "lat": "#2c2822", "c": "#f0d850", "b": "#eef0d8",
        "pat": [{"type": "spot", "p": [0.22, 0.42], "r": [0.06, 0.05], "color": "#f4f2e6", "mirror": True}]},
    # 35 Amazon tree boa: rhomboid marks; on a branch
    "corallus-hortulana": {"t": "none", "pat": [{"type": "blotch", "count": 36, "a": 0.3, "mirror": True, "alt": True, "wid": 0.32, "len": 0.8, "shape": "diamond", "color": "#7a5a3c", "edgeColor": "#d8c8a8", "edge": 0.1, "edgeOut": True, "warp": 0.4}]},
    # 36 Sonoran coral snake: broad white or yellow rings about as wide as the black
    "micruroides-euryxanthus": {"pat": [{"type": "band", "count": 20, "len": 0.36, "color": "#f0ead0", "warp": 0.15, "jit": 0.04, "phase": 0.5}]},
    # 37 bullsnake: bigger squarish blotches, a dark line across the crown and through the eye
    "pituophis-catenifer": {"t": "saddle", "n": 50, "es": ["#3a2a1a", 0.05], "pat": [{"type": "line", "p0": [0.3, 0.0], "p1": [0.32, 0.36], "wid": 0.045, "color": "#3a2a1a", "mirror": True}]},
    # 38 Wagler's pit viper (adult female): black and yellow-green bands that stop at the belly
    "tropidolaemus-wagleri": {"d": "#1c2416", "lat": "#1e2618", "c": "#c8d24a", "b": "#d8d890", "es": ["#c8d24a", 0.04]},
    # 39 woma: broad, irregular bands, darker on the flanks
    "aspidites-ramsayi": {"t": "none", "pat": [{"type": "band", "count": 34, "len": 0.5, "color": "#8a5428", "warp": 0.8, "jit": 0.3, "sj": 0.35, "aMax": 0.75}]},
    # 40 emerald tree boa: draped over a branch, a big head on a thin neck, pale lips
    "corallus-caninus": {"sx": {"rows": 70}, "lip": "#f4f0c0"},
    # 43 coastal taipan: longer fangs (in GENUS_FANG); 44 eastern brown snake: orange spots on the belly
    "pseudonaja-textilis": {"pat": [{"type": "blotch", "count": 60, "a": 0.9, "mirror": True, "alt": True, "belly": True, "wid": 0.06, "len": 0.4, "shape": "round", "color": "#d88a4a", "alpha": 0.6, "jit": 0.4, "skip": 0.3}]},
    # 46 paradise tree snake: red spots in clusters, not a line
    "chrysopelea-paradisi": {"vs": None, "pat": [{"type": "blotch", "count": 50, "a": 0, "wid": 0.06, "len": 0.5, "shape": "round", "color": "#c4402a", "jit": 0.2},
                                                 {"type": "blotch", "count": 50, "phase": 0.15, "a": 0.08, "mirror": True, "wid": 0.04, "len": 0.4, "shape": "round", "color": "#c4402a", "alpha": 0.9, "jit": 0.2}]},
    # 51 banded krait: short blunt tail (body table); 52 rubber boa: blunt head-like tail (body table)
    # 55 rosy boa: contrasting stripes
    "lichanura-trivirgata": {"d": "#c8c0b0", "lat": "#c4bcac", "c": "#6a3a20"},
    # 67 common garter snake: the side stripe on scale rows 2-3, dark bars on the lips
    "thamnophis-sirtalis": {"ls": ["#e8d77a", 0.62, 0.05]},
    # 79 indigo snake: 17 rows
    "drymarchon-couperi": {"sx": {"rows": 17}},
    # 88 sea krait: lateral nostrils (it is amphibious)
    "laticauda-colubrina": {"h": {"nostrilA": 78}},
    # 89 rough green snake: a long whip tail (body table); big eye
    # Gaboon-like under-eye mark for the puff adder is in the hand fixes
}
# head shape by genus where the audit measured it wrong: sea kraits breathe through nostrils on the side of the snout (only
# true sea snakes have them on top); vine snakes' heads are shorter and deeper than drawn, so their big eyes fit
GENUS_H = {"laticauda": {"nostrilA": 78}, "ahaetulla": {"len": 0.032, "h": 0.74}, "thelotornis": {"len": 0.034, "h": 0.74}, "oxybelis": {"len": 0.036, "h": 0.72},
           "langaha": {"h": 0.72}, "cylindrophis": {"h": 0.8}}
# generated-species head extras by genus (S9): postocular stripes, lip bars
GENUS_HEADMARK = {"thamnophis": {"lb": ["#1a1612"]}, "nerodia": {"lb": ["#2a1e16"]}, "pantherophis": {"es": ["#2a1a12", 0.05]}, "elaphe": {"es": ["#2a1a12", 0.05]},
                  "crotalus": {}, "natrix": {}, "ahaetulla": {"es": ["#2a3a1a", 0.03]}}

# hand-made profiles (data/snake-models.json): fixes from the same audit, applied after HAND_FIXES
_STACK = {"kind": "stack", "pitch": 1.0, "lead": 0.3, "lift": 0.2, "tight": 0.6}
HAND_FIXES_562 = {
    # 21 king cobra: forward-pointing pale chevrons, strongest on the forebody; a narrow long hood, raised; 15 rows; pale throat
    "ophiophagus-hannah": [(("body", "hood"), {"x0": 1.4, "xm": 3.2, "x1": 7.5, "w": 1.8, "flat": 0.55}), (("body", "tail"), 0.21), (("scales", "rows"), 15),
                           (("pose",), {"kind": "raised", "rise": 0.22, "hood": 0.75}), (("head", "eyeL"), 0.11), (("head", "fangMm"), 11),
                           (("pattern",), [{"type": "blotch", "t": [0.07, 0.85], "count": 42, "a": 0, "wid": 0.62, "len": 0.3, "shape": "chevronF", "color": "#c8bc84", "alpha": 0.7, "warp": 0.35, "jit": 0.05},
                                           {"type": "tint", "t": [0.8, 1], "ramp": 0.15, "color": "#2a2820", "alpha": 0.6},
                                           {"type": "hband", "x0": 0.4, "x1": 3.6, "aMin": 0.42, "belly": True, "color": "#e6d8a4", "xMax": 4.0, "alpha": 0.85, "warp": 0.2}])],
    # 27 tiger snake: irregular narrow pale crossbands that fade on the belly; tail 13%
    "notechis-scutatus": [(("body", "tail"), 0.13), (("pattern", 0, "wid"), 0.75), (("pattern", 0, "jit"), 0.3), (("pattern", 0, "sj"), 0.4), (("pattern", 0, "warp"), 0.8)],
    # 29 cottonmouth: the white "cotton" mouth, a bold cheek stripe, stronger bands, tail 14%
    "agkistrodon-piscivorus": [(("head", "mouthColor"), "#f2efe6"), (("body", "tail"), 0.14), (("body", "tailShape"), "abrupt"), (("pattern", 0, "alpha"), 0.9),
                               (("pattern", 1, "wid"), 0.07), (("pattern", 2, "alpha"), 1.0), (("pose",), _STACK), (("head", "fangMm"), 10)],
    "agkistrodon-contortrix": [(("body", "tail"), 0.133), (("body", "tailShape"), "abrupt"), (("pose",), _STACK), (("head", "fangMm"), 6)],
    # 31 corn snake: large squarish black-bordered saddles, narrow orange gaps; tail 15%
    "pantherophis-guttatus": [(("pattern", 0, "shape"), "saddle"), (("pattern", 0, "wid"), 0.42), (("pattern", 0, "len"), 0.7), (("pattern", 0, "edge"), 0.18),
                              (("pattern", 1, "a"), 0.62), (("body", "tail"), 0.15), (("head", "eyeL"), 0.14)],
    # 41/42 diamondbacks: broad diamonds (were a thin chain)
    "crotalus-atrox": [(("pattern", 0, "wid"), 0.40), (("pattern", 0, "len"), 1.15), (("pattern", 1, "a"), 0.62), (("head", "eyeL"), 0.09), (("head", "fangMm"), 10)],
    "crotalus-adamanteus": [(("pattern", 0, "wid"), 0.42), (("pattern", 0, "len"), 1.15), (("pattern", 0, "edge"), 0.16), (("pose",), _STACK), (("head", "fangMm"), 18)],
    "crotalus-horridus": [(("pose",), _STACK), (("head", "fangMm"), 11), (("pattern",), "+", {"type": "line", "p0": [0.36, 0.4], "p1": [1.0, 0.6], "wid": 0.06, "color": "#2a2018", "mirror": True})],
    # 45 boa: pale-centred saddles, stouter
    "boa-constrictor": [(("pattern", 0, "inner"), {"r": 0.35, "color": "#8a7058"}), (("body", "ld"), 18), (("pose",), {"kind": "stack", "pitch": 1.05, "lead": 0.3, "lift": 0.2, "tight": 0.62})],
    # 47 black mamba: the inky-black mouth
    "dendroaspis-polylepis": [(("head", "mouthColor"), "#141414"), (("head", "eyeL"), 0.11), (("head", "fangMm"), 6.5), (("body", "tailShape"), "whip")],
    "dendroaspis-angusticeps": [(("head", "eyeL"), 0.11), (("body", "tail"), 0.23), (("body", "tailShape"), "whip")],
    # 48 saw-scaled viper: the cross on the crown
    "echis-carinatus": [(("pose",), _STACK), (("body", "tailShape"), "abrupt"), (("head", "fangMm"), 4.5),
                        (("pattern",), "+", {"type": "poly", "pts": [[0.32, 0.0], [0.42, 0.05], [0.6, 0.05], [0.62, 0.16], [0.7, 0.16], [0.7, 0.05], [0.95, 0.04], [0.95, 0.0]], "mirror": True, "color": "#e6d8b8", "alpha": 0.9})],
    # 49 reticulated python: a less regular net
    "malayopython-reticulatus": [(("pattern", 0, "warp"), 1.2), (("pattern", 0, "jit"), 0.15), (("pattern", 1, "wid"), 0.12), (("pattern", 1, "color"), "#f0ece0")],
    # 53 eastern hognose: more upturned snout
    "heterodon-platirhinos": [(("head", "snoutUp"), 0.55)],
    # 54/63/64 kingsnakes and milk snake: short tails
    "lampropeltis-getula": [(("body", "tail"), 0.12)], "lampropeltis-californiae": [(("body", "tail"), 0.13)], "lampropeltis-triangulum": [(("body", "tail"), 0.14)],
    # 56 Burmese python: big dark-edged blotches separated by a narrow pale net, on a pale tan ground
    "python-bivittatus": [(("pattern", 0, "wid"), 0.42), (("pattern", 0, "len"), 0.95), (("pattern", 0, "edge"), 0.2), (("pattern", 1, "wid"), 0.2),
                          (("colors", "dorsal"), "#c8b48a"), (("colors", "lateral"), "#c4b088"), (("pose",), {"kind": "stack", "pitch": 1.05, "lead": 0.3, "lift": 0.2, "tight": 0.62})],
    # 57 adder: bolder zigzag
    "vipera-berus": [(("pattern", 0, "wid"), 0.13), (("pattern", 0, "amp"), 0.18), (("pose",), _STACK), (("body", "tail"), 0.12), (("body", "tailShape"), "abrupt"), (("head", "fangMm"), 4.5)],
    # 58 Gaboon viper: the dark triangle under each eye
    "bitis-gabonica": [(("pattern",), "+", {"type": "poly", "mirror": True, "pts": [[0.24, 0.42], [0.36, 0.42], [0.5, 0.66], [0.2, 0.66]], "color": "#3a2418"}), (("head", "fangMm"), 50), (("body", "tailShape"), "abrupt")],
    "bitis-arietans": [(("pose",), {"kind": "stack", "pitch": 0.95, "lead": 0.3, "lift": 0.1, "tight": 0.62}), (("body", "tail"), 0.1), (("body", "tailShape"), "abrupt"), (("head", "fangMm"), 15)],
    # 59 fer-de-lance: tail 13%
    "bothrops-asper": [(("body", "tail"), 0.13), (("body", "tailShape"), "abrupt"), (("pose",), _STACK), (("head", "fangMm"), 25)],
    # 22 bushmaster: big black-brown rhombs reaching low on the flanks, light spots inside, a pinkish-tan ground; a bigger eye
    "lachesis-muta": [(("pattern", 0, "wid"), 0.55), (("pattern", 0, "len"), 1.0), (("pattern", 0, "inner", "r"), 0.35), (("colors", "dorsal"), "#c49a6c"), (("colors", "lateral"), "#c29a6e"),
                      (("head", "eyeL"), 0.07), (("pose",), _STACK), (("head", "fangMm"), 35)],
    # 75 Russell's viper: tail 13%
    "daboia-russelii": [(("body", "tail"), 0.13), (("body", "tailShape"), "abrupt"), (("pose",), _STACK), (("head", "fangMm"), 16)],
    "bungarus-caeruleus": [(("body", "tailShape"), "blunt"), (("body", "tail"), 0.12)],
    "epicrates-cenchria": [(("head", "eyeL"), 0.09)],
    "hydrophis-platurus": [(("head", "eyeL"), 0.06), (("head", "fangMm"), 1)],
}
SKIP_562 = {"opheodrys-vernalis", "oxyuranus-microlepidotus"}  # (being rebuilt separately)


def _merge_562(a, upd):
    for k, v in upd.items():
        if v is None: a.pop(k, None)
        elif isinstance(v, dict) and isinstance(a.get(k), dict): a[k] = dict(a[k], **v)
        else: a[k] = v


def apply_562(a, c, g):
    """v5.62: body and tail tables, eye size, fangs, poses, rings, head marks and the audit's species fixes."""
    sid = c["id"]
    if sid in SKIP_562 or c["fossil"]: return
    bt = dict(GENUS_BODY.get(g, {}), **SPECIES_BODY.get(sid, {}))
    if bt:
        bx = {("tailShape" if k == "ts" else k): v for k, v in bt.items() if k != "len"}
        a["bx"] = dict(a.get("bx") or {}, **bx)
        if "len" in bt: a["h"] = dict(a.get("h") or {}, len=bt["len"])
    e = SPECIES_EYE.get(sid, GENUS_EYE.get(g))
    if e: a["h"] = dict(a.get("h") or {}, eyeL=e)
    if a["p"] in ("viper", "pitviper", "elapid", "sea"):
        fm = SPECIES_FANG.get(sid, GENUS_FANG.get(g))
        if fm: a["h"] = dict(a.get("h") or {}, fangMm=fm)
    if g in REAR_FANG: a["h"] = dict(a.get("h") or {}, rearFang=REAR_FANG[g])
    if g in DRAPE or sid in DRAPE_SP: a["ps"] = {"kind": "drape"}
    if g in HOODED: a["bx"] = dict(a.get("bx") or {}, hood=HOODED[g]); a["ps"] = {"kind": "raised"}
    if g in RINGED: a["rg"] = 1
    for k, v in GENUS_HEADMARK.get(g, {}).items(): a.setdefault(k, v)
    if GENUS_H.get(g): a["h"] = dict(a.get("h") or {}, **GENUS_H[g])
    if sid in AUDIT_FIX: _merge_562(a, AUDIT_FIX[sid])


def apply_hand_562(existing):
    for sid, fix in HAND_FIXES_562.items():
        prof = existing.get(sid)
        if not prof: continue
        for f in fix:
            path, val = f[0], f[1]
            o = prof
            for k in path[:-1]: o = o.setdefault(k, {}) if isinstance(k, str) else o[k]
            if val == "+": o[path[-1]] = list(o.get(path[-1]) or []) + [f[2]]
            else: o[path[-1]] = val


REGIONLESS = {"Rainforests", "Forests & woodlands", "Savannas & grasslands", "Shrublands & heath", "Deserts & dunes", "Mountains & rocks",
              "Underground & forest floor", "Wetlands & swamps", "Rivers & lakes", "Coasts & sea", "Around people"}


# v5.31: head shape per family and group (from photos of each): width against the body, length, snout shape, where
# the eyes and nostrils sit (on top in water snakes), pits
def head_of(c, g, plan):
    f = c["family"]
    if f == "Viperidae":
        if g in ("causus", "azemiops"): return {"shape": "oval", "w": 0.95, "snout": 0.7}  # narrow, colubrid-like heads
        if g in ("bitis", "cerastes", "pseudocerastes", "eristicophis"): return {"w": 1.15, "len": 0.07}
        if g in ("atheris", "bothriechis", "tropidolaemus"): return {"w": 1.1}
        return {}
    if f == "Elapidae":
        if plan == "sea": return {"nostrilA": 22, "eyeA": 50, "w": 0.8}
        if g in ("naja", "ophiophagus", "hemachatus", "pseudohaje", "walterinnesia", "aspidelaps"): return {"w": 1.05, "snout": 0.7}
        if g in ("acanthophis",): return {"shape": "tri", "w": 1.2, "len": 0.06}
        return {"w": 0.92, "snout": 0.65}
    if f == "Pythonidae": return {"pits": "labial", "snout": 0.68, "w": 0.8}
    if f == "Boidae":
        if g in ("eryx", "gongylophis", "charina", "lichanura"): return {"len": 0.03, "snout": 0.85, "w": 0.95, "tip": 0.8}  # stubby, shovel snout
        if g in ("corallus", "epicrates", "chilabothrus"): return {"pits": "labial", "w": 0.95}
        return {}
    if f in ("Homalopsidae", "Acrochordidae"): return {"nostrilA": 25, "eyeA": 45}
    if f == "Xenopeltidae": return {"plates": True, "h": 0.52}
    if f in ("Uropeltidae",):  # small conical heads ending in a point (the rostral), tiny eyes, no neck
        return {"snout": 0.34 if g == "rhinophis" else 0.4, "tip": 0.28, "tipR": 0.07, "snoutH": 0.45, "chin": 0.6, "w": 0.8, "eye": 0.07, "len": 0.034, "minR": 1.4, "brow": 0}
    if f == "Atractaspididae": return {"w": 0.85, "snout": 0.75, "len": 0.028, "eye": 0.09}
    if f in ("Lamprophiidae", "Prosymnidae", "Pseudoxyrhophiidae"): return {"w": 0.95, "snout": 0.72, "len": 0.032}
    if f == "Colubridae" or plan == "colubrid":
        if g in ("pantherophis", "elaphe", "zamenis", "ptyas", "coluber", "masticophis", "hierophis", "platyceps"): return {"w": 1.05, "snout": 0.58}
        if g in ("natrix", "nerodia", "thamnophis", "hebius", "rhabdophis", "fowlea", "amphiesma", "regina", "trimerodytes", "sinonatrix", "tropidonophis"): return {"w": 1.12}
        if g in ("dasypeltis",): return {"snout": 0.85, "w": 1.0}
        if g in ("ahaetulla", "oxybelis", "langaha", "uromacer", "thelotornis", "imantodes"): return {"len": 0.045, "snout": 0.4, "tip": 0.3}
    return {}


GENUS_T = {"pareas": "xband", "protobothrops": "blotch", "ovophis": "blotch", "lycodryas": "blotch", "aspidites": "band", "helicops": "blotch",
           "hypsiglena": "blotch", "tropidophis": "blotch", "elapsoidea": "plain", "thamnodynastes": "stripe", "tropidonophis": "xband",
           "xenodon": "blotch", "liophidium": "stripe", "cemophora": "saddle", "gloydius": "hourglass", "sonora": "band", "bitia": "band"}


VINE = {
    "thelotornis": ({"ld": 105, "neck": 0.55, "tail": 0.38}, {"len": 0.04, "w": 1.5, "snout": 0.36, "tip": 0.24, "tipR": 0.1, "pupil": "hslit", "eye": 0.3, "iris": "#c9b86e", "irisInner": "#e6d896", "eyeStripe": "#2a2018"}),
    "oxybelis": ({"ld": 95, "neck": 0.85, "tail": 0.36}, {"len": 0.048, "w": 1.1, "snout": 0.32, "tip": 0.2, "tipR": 0.08}),
    "ahaetulla": ({"ld": 95, "neck": 0.75, "tail": 0.34}, {"len": 0.044, "w": 1.25, "snout": 0.32, "tip": 0.2, "tipR": 0.08, "pupil": "hslit", "eye": 0.18}),
    "imantodes": ({"ld": 100, "neck": 0.45, "tail": 0.3}, {"len": 0.032, "w": 1.6, "snout": 0.7, "eye": 0.24, "pupil": "slit"}),
    "langaha": ({"ld": 75, "neck": 0.75, "tail": 0.33}, {"len": 0.05, "w": 1.1, "snout": 0.3, "tip": 0.18, "tipR": 0.06, "pupil": "slit"}),
    "uromacer": ({"ld": 85, "neck": 0.8, "tail": 0.34}, {"len": 0.045, "snout": 0.36, "tip": 0.24}),
    "dryophiops": ({"ld": 85, "neck": 0.8, "tail": 0.33}, {"len": 0.044, "snout": 0.34, "tip": 0.22, "pupil": "hslit"}),
    "xenoxybelis": ({"ld": 90, "neck": 0.8, "tail": 0.35}, {"len": 0.046, "snout": 0.32, "tip": 0.2}),
    "dendrelaphis": ({"ld": 62, "neck": 0.8, "tail": 0.33}, {"eye": 0.2}),
}
ARBOREAL = {"boiga", "dendrelaphis", "ahaetulla", "chrysopelea", "imantodes", "oxybelis", "leptophis", "dispholidus", "thelotornis", "toxicodryas",
            "dipsadoboa", "philothamnus", "gonyosoma", "corallus", "uromacer", "langaha", "hapsidophrys", "rhamnophis", "thrasops", "xenoxybelis", "chironius"}


# v5.43: hognose snakes (Heterodon) - short, stout and heavy-bodied with a short tail; a broad head barely wider than the
# neck ending in an upturned, pointed, keeled rostral (a shovel snout); pale tan ground with rows of brown blotches finely
# edged darker (a big row down the back, smaller ones on the flanks), a dark band across the head between the eyes, a dark
# stripe from the eye to the angle of the jaw, and a pair of long dark blotches on the neck. Keeled scales, round pupils.
def _hog_marks(col, edge, n=42, wid=0.1, ln=0.55):
    # three rows of small squarish blotches each side of the spine (the middle one on the spine), alternating, finely edged darker
    return [{"type": "blotch", "t": [0.07, 0.9], "count": n, "a": 0, "wid": wid, "len": ln, "shape": "rect", "color": col, "edgeColor": edge, "edge": 0.14, "warp": 0.3, "jit": 0.08, "sj": 0.15, "aj": 0.02},
            {"type": "blotch", "t": [0.07, 0.9], "count": n, "phase": 0.5, "a": 0.36, "mirror": True, "wid": wid * 0.85, "len": ln * 0.95, "shape": "rect", "color": col, "edgeColor": edge, "edge": 0.14, "warp": 0.3, "jit": 0.12, "sj": 0.2},
            {"type": "blotch", "t": [0.08, 0.9], "count": n, "a": 0.66, "mirror": True, "wid": wid * 0.7, "len": ln * 0.85, "shape": "round", "color": col, "alpha": 0.85, "jit": 0.2, "sj": 0.25},
            {"type": "band", "t": [0.9, 0.99], "count": 5, "len": 0.45, "color": col, "warp": 0.25, "jit": 0.04},
            {"type": "line", "p0": [0.2, 0.0], "p1": [0.27, 0.32], "wid": 0.045, "color": edge, "mirror": True, "aa": 0.35},
            {"type": "line", "p0": [0.36, 0.37], "p1": [0.82, 0.56], "wid": 0.045, "color": edge, "mirror": True, "aa": 0.35},
            {"type": "spot", "p": [1.32, 0.2], "r": [0.32, 0.1], "color": edge, "mirror": True, "aa": 0.25}]
SHAPE_KEYS = {"h", "bx", "sx", "k", "L"}
GENUS_LOOK = {
    "heterodon": {
        "h": {"upturn": 0.62, "upLen": 0.34, "eyeX": 0.36, "snoutUp": 0.45, "tip": 0.25, "tipR": 0.08, "snout": 0.42, "snoutH": 0.5, "w": 1.02, "h": 0.6, "len": 0.036,
              "eye": 0.14, "iris": "#8a6232", "irisInner": "#c29452", "pupil": "round"},
        "bx": {"ld": 19, "neck": 0.86, "tail": 0.15, "peak": 0.45}, "sx": {"rows": 25, "keel": 0.7, "gloss": 0.25}, "k": 1,
        "d": "#bf9f74", "lat": "#b8996e", "c": "#8a5428", "b": "#2a2622", "t": "none", "n": 40, "cx": {"bellyA": 0.75, "mottle": 0.06},
        "pat": _hog_marks("#8a5428", "#4a2c18"),
        "sp": {
            # western hognose: pale tan to cream, rich orange-brown blotches; belly largely black
            "heterodon-nasicus": {"d": "#cdb08a", "lat": "#c8aa84", "c": "#8e4f22", "L": 0.55, "s": "grass", "pat": _hog_marks("#8e4f22", "#4a2814", 46)},
            # Mexican hognose: like the western, a little yellower, smaller blotches; belly black
            "heterodon-kennerlyi": {"d": "#b89a6c", "lat": "#b29466", "c": "#6e4424", "L": 0.55, "s": "arid", "pat": _hog_marks("#6e4424", "#3c2414", 46, 0.09, 0.5)},
            # southern hognose: pale grey-tan with dark brown to blackish blotches; the most sharply upturned snout; pale belly
            "heterodon-simus": {"d": "#ab9f8a", "lat": "#a69a86", "c": "#2e221a", "b": "#d0c8b8", "L": 0.5, "s": "sand",
                                "h": {"upturn": 0.8, "snoutUp": 0.5}, "pat": _hog_marks("#2e221a", "#1e1610", 34, 0.13, 0.6)},
        },
    },
}


PHOTO_MASK = {}
MASK_USED = []
try: PHOTO_MASK = json.load(open(os.path.join(ROOT, "data/snake-model-photo.json"), encoding="utf-8"))
except (OSError, ValueError): pass


# v5.68: a fossil snake is shown as it would have looked alive, built like its closest living relatives (Eduardo: "show how
# the snake would look like"): the model of a living species of the same genus, or of a genus its name is built on
# (Palaeoelaphe -> Elaphe, Paleoheterodon -> Heterodon, Tropidonotus -> Natrix), or else a typical living member of its
# family - Titanoboa as a giant boa, the madtsoiids as big pythons, the marine palaeophiids and simoliophiids like sea
# snakes. Its own length (from its bones), surroundings and name stay; colours are those of the living relative.
FOSSIL_ALIAS = {"tropidonotus": "natrix", "dinodon": "lycodon", "palaeoelaphe": "elaphe", "paleoheterodon": "heterodon", "miocoluber": "coluber",
                "paracoluber": "coluber", "micronatrix": "natrix", "paraungaliophis": "ungaliophis", "nanowana": "morelia", "bavarioboa": "boa"}
FOSSIL_FAMILY = {  # family -> living templates, in order of preference (the first that has a generated model)
    "Boidae": ["boa-imperator", "boa-constrictor", "eunectes-notaeus"], "Pythonidae": ["python-sebae", "morelia-spilota"],
    "Madtsoiidae": ["python-sebae", "liasis-olivaceus", "morelia-spilota"], "Dinilysiidae": ["boa-imperator", "eunectes-notaeus"],
    "Aniliidae": ["anilius-scytale"], "Tropidophiidae": ["tropidophis-melanurus", "tropidophis-pardalis"], "Acrochordidae": ["acrochordus-arafurae"],
    "Palaeophiidae": ["aipysurus-laevis", "acrochordus-granulatus"], "Simoliophiidae": ["aipysurus-laevis", "acrochordus-granulatus"], "Nigerophiidae": ["acrochordus-granulatus", "aipysurus-laevis"],
    "Viperidae": ["macrovipera-lebetina", "vipera-ammodytes"], "Elapidae": ["naja-haje", "pseudechis-australis"], "Typhlopidae": ["typhlops-vermicularis"],
    "Colubridae": ["elaphe-quatuorlineata", "zamenis-situla", "coluber-constrictor"], "Psammophiidae": ["psammophis-schokari"],
}
FOSSIL_SMALL_BOID = ["eryx-jaculus", "lichanura-trivirgata", "charina-bottae"]  # boids under a metre: sand boas and rosy boas
FOSSIL_TYPE = {"Watersnake": ["natrix-natrix", "nerodia-sipedon"], "Cobra": ["naja-haje"], "Elapid": ["pseudechis-australis"], "Viper": ["macrovipera-lebetina"],
               "Pit Viper": ["crotalus-viridis"], "Boa": ["boa-imperator"], "Python": ["python-sebae"], "Colubrid": ["elaphe-quatuorlineata"], "Other": ["elaphe-quatuorlineata"]}
FOSSIL_GENUS = {"python": "python-sebae", "morelia": "morelia-spilota", "naja": "naja-haje", "crotalus": "crotalus-viridis", "bungarus": "bungarus-fasciatus", "heterodon": "heterodon-nasicus", "lampropeltis": "lampropeltis-holbrooki", "micrurus": "micrurus-tener"}  # the typical living species of a genus
FOSSIL_KEEP = ("L", "s")  # its own: length from its bones, and its surroundings


def fossil_template(c, out, L):
    """the id of the living species whose model a fossil borrows, or None"""
    live = lambda k: k in out and "f" not in out[k]["auto"].get("x", "")
    g = c["genus"].lower(); g = FOSSIL_ALIAS.get(g, g)
    same = sorted(k for k in out if k.split("-")[0] == g and live(k))
    if FOSSIL_GENUS.get(g) in same: return FOSSIL_GENUS[g]
    if same:  # the best-known living species of the genus: on the ground, hand-checked first, then one coloured from a photo
        return sorted(same, key=lambda k: ((out[k]["auto"].get("ps") or {}).get("kind") == "drape", k not in CURATED and k not in AUDIT_FIX, "g" in out[k]["auto"].get("x", ""), k))[0]
    if c["family"] == "Boidae" and L < 1.0: cands = FOSSIL_SMALL_BOID
    elif c["family"] in ("Boidae", "Dinilysiidae") and L >= 5: cands = ["eunectes-murinus", "boa-imperator"]  # the giants (Titanoboa) as giant boas like the anaconda, their closest living size match
    else: cands = FOSSIL_FAMILY.get(c["family"], []) + FOSSIL_TYPE.get(c["type"], []) + ["elaphe-quatuorlineata"]
    for k in cands:
        if live(k): return k
    return None


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
    apply_hand_562(existing)  # v5.62
    out, names = {}, {}
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
        # v5.25: the snake cut out of its photo (tools/photo_mask.py): its colour replaces a dull grey reading only when the
        # cut-out is clean, the colour is clearly a coloured one, and it is neither leaf green nor skin (a holding hand)
        pmc = PHOTO_MASK.get(c["id"]) if not c["fossil"] else None
        if pmc and pmc["q"] >= 0.6:
            r_, g_, b_ = hx(d); _, _, S0 = colorsys.rgb_to_hls(r_, g_, b_)
            r2, g2, b2 = hx(pmc["d"]); H2, L2, S2 = colorsys.rgb_to_hls(r2, g2, b2)
            leafy = 70 / 360 <= H2 <= 170 / 360 and c["genus"].lower() not in GREEN_IN_LIFE
            skin = 10 / 360 <= H2 <= 35 / 360 and 0.45 < L2 < 0.8 and 0.2 < S2 < 0.55
            if S0 < 0.15 and S2 >= 0.25 and 0.1 < L2 < 0.8 and not leafy and not skin: d = pmc["d"]; MASK_USED.append(c["id"])
        green = is_green(d)
        if green and lum(d) < 0.55:  # photos make green snakes look dull and olive: a living green snake is vivid
            d = tone(d, 1.12, 1.35)
        nm = (c["name"] if not c["is_sci"] else "").lower()
        if (c["genus"].lower() in GREEN_IN_LIFE or (c["genus"].lower() == "dendroaspis" and "black" not in nm)) and not green and lum(d) < 0.3 and not re.search(r"brown|gr[ae]y|black|white|yellow|red|mangrove|bronze|spotted|striped|banded", nm):
            d, green = "#5aa63a", True  # v5.12: the photo read leaves or shade as its colour - in life it is green
        # v5.12: a near-black colour read from a photo is usually shadow, unless the snake's name says it is dark
        if not green and lum(d) < (0.15 if c["genus"].lower() in ("crotalus", "sistrurus") else 0.06) and not re.search(r"black|dark|melan|nigr|ebon|coal|ink|night|obscur|mole", nm + " " + c["id"]): d = mix(d, gd, 0.6)
        t = pattern_of(c, plan, con, green)
        # v5.25: a "pattern colour" much paler than the snake, read only from photo contrast, is mostly the ground behind a
        # dark snake (photo checks: plain snakes came out with pale bands) - such snakes are left plain
        if t in ("saddle", "speckle") and lum(p) > lum(d) + 0.18 and not (cc and cc.get("q", 0) >= 0.9 and con >= 0.7): t = "plain"
        if c["genus"].lower() == "arizona": t = "blotch"
        if c["genus"].lower() in ("ninia", "rhabdops", "achalinus", "rhadinella", "rhadinaea", "plagiopholis") and t in ("saddle", "speckle", "band"): t = "plain"
        # the belly: paler and less coloured than the back (a dark snake keeps a darker belly)
        # v5.25: most snakes' bellies are pale - cream, white or yellowish - whatever colour the back is; green snakes pale
        # yellow-green, kraits white; dark-bellied groups (and the blind snakes, coloured all round) keep a darker belly
        g0 = c["genus"].lower()
        if plan == "blind": b = tone(d, 1.2, 0.8)
        elif g0 in ("bungarus",): b = "#ece8dc"
        elif green: b = mix(d, "#f2efc8", 0.75)
        elif re.search(r"black-bellied|dark-bellied|blackbelly|red-bellied|redbelly|orange-bellied|blue-bellied|yellow-bellied", (c["name"] if not c["is_sci"] else "").lower()) or g0 in ("pseudechis", "storeria", "farancia", "regina", "liodytes", "carphophis", "diadophis", "calamaria", "atractus", "geophis", "pseudorabdion", "tantilla", "apostolepis", "micrurus", "calliophis", "oxyrhopus"):
            b = mix(tone(d, 1.45 if lum(d) < 0.5 else 1.1, 0.55), "#e6dcc4", 0.35)
        else: b = mix(tone(d, 1.3, 0.35), "#ece5d0", 0.65)
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
        # v5.22: wolf snakes: pale bands on a dark ground (never dark bands on pale)
        if g == "corallus" and a["t"] == "crossbar": a["c"] = "#eef0dc"  # white crossbars on the green tree boas
        if g == "lycodon" and a["t"] == "band" and lum(a["d"]) > lum(a["c"]): a["d"], a["c"] = a["c"], a["d"]
        # Australian black snakes and brown snakes read grey from photos: most are brown or coppery
        if g in ("pseudechis", "pseudonaja") and not re.search(r"black|gr[ae]y|dusky|spotted|butler|blue|collett|papuan", nm + " " + c["id"]):
            r_, g_, b_ = hx(a["d"]); H_, L_, S_ = colorsys.rgb_to_hls(r_, g_, b_)
            if S_ < 0.25: a["d"] = "#9a6a42"; a["lat"] = "#a07048"
        if g == "thamnophis" and a["t"] == "garter" and c["id"] not in CURATED:  # v5.43: garter stripes are bright yellow to cream, the ground darker
            a["c"] = mix(a["d"], "#efe0a0", 0.8)
        if g == "tantilla": a.setdefault("hc", "#1a1614"); a.setdefault("hcx", 1.0)  # the black head of centipede snakes
        if g == "oligodon" and a["t"] == "speckle": a["t"] = "saddle"
        # v5.34: genus rules from a random sample of 80 photos against their models: groups that are patterned in life
        # but came out plain or speckled (their photos' contrast was too low to read the marks)
        if g in GENUS_T and (a["t"] in ("plain", "speckle") or g in ("elapsoidea",)) and not c["fossil"]:
            a["t"] = GENUS_T[g]
            if a["t"] != "plain" and (lum(a["c"]) > lum(a["d"]) - 0.1): a["c"] = tone(a["d"], 0.45) if lum(a["d"]) > 0.2 else tone(a["d"], 2.2, 0.6)  # dark marks on a paler ground
        # the species' own name, when it describes its pattern (taeniatus "ribboned", lineatus, vittatus, virgatus; cinctus "girdled",
        # annulatus, fasciatus "banded"; maculatus "spotted"), for snakes that came out plain or speckled
        ep = c["id"].split("-")[-1]
        if a["t"] in ("plain", "speckle") and not c["fossil"] and plan != "blind" and not re.match(r"caudo|pauci|semi", ep):
            if re.search(r"taeniat|lineat|vittat|virgat|strigat|striat|grammus|lineolat", ep): a["t"] = "stripe"
            elif re.search(r"cinct|annulat|fasciat|zonat|anellat", ep): a["t"] = "band"
            elif re.search(r"maculat|punctat|guttat|ocellat|stictus|stigma", ep): a["t"] = "spot"
            if re.match(r"albo|leuco|flavo|xantho|argent|aureo", ep): a["c"] = mix(a["d"], "#efe8d0", 0.75)  # white or yellow marks
            elif a["t"] != "plain" and lum(a["c"]) > lum(a["d"]) - 0.1 and a["t"] != "stripe": a["c"] = tone(a["d"], 0.45) if lum(a["d"]) > 0.2 else tone(a["d"], 2.2, 0.6)
        if g == "oligodon" and a["t"] == "plain" and not re.search(r"plain|unicolor|black", nm + " " + c["id"]): a["t"] = "saddle"  # kukris: saddles or crossbands
        if g == "sibynophis": a.setdefault("hc", "#1e1a16"); a.setdefault("hcx", 0.9)  # black-headed snakes
        if g == "hebius" and a["t"] == "plain": a.setdefault("ls", [mix(a["d"], "#efe2b4", 0.6), 0.5, 0.03])  # keelbacks: a pale line or row of spots along each side
        if g == "aspidites" and "melanocephalus" in c["id"] or c["id"] == "aspidites-ramsayi": a.setdefault("hc", "#141210" if "melanocephalus" in c["id"] else tone(a["d"], 0.8)); a.setdefault("hcx", 1.05)
        if g in ("typhlops", "afrotyphlops", "indotyphlops", "amerotyphlops", "letheobia", "anilios", "ramphotyphlops", "argyrophis", "madatyphlops", "antillotyphlops", "xerotyphlops", "myriopholis", "leptotyphlops", "epictia", "trilepida", "liotyphlops", "gerrhopilus") and a["t"] not in ("stripe",): a["t"] = "plain"
        hd = head_of(c, c["genus"].lower(), plan)
        if hd: a["h"] = dict(hd, **(a.get("h") or {}))
        # v5.35: vine and twig snakes - very slender, long thin tails, long pointed heads on a thin neck, lying along a branch
        if g in VINE:
            bx, hh = VINE[g]
            a["bx"] = dict(a.get("bx") or {}, **bx); a["h"] = dict(a.get("h") or {}, **hh); a["ps"] = {"kind": "branch", "amp": 14, "waves": 1.1, "lift": 0.35, "liftLen": 4}
        if g == "thelotornis":  # bark-grey to pinkish brown, finely speckled dark; olive-green head top, pale lips, dark stripe through the eye
            a.update({"d": "#978575", "lat": "#a59084", "c": "#2a2420", "t": "speckle", "b": "#e6dfcc", "lip": "#ece6d4",
                      "pat": [{"type": "cap", "x0": 0, "x1": 1.0, "wid": 0.42, "color": "#6c7a3c"}, {"type": "line", "p0": [0.02, 0.34], "p1": [1.15, 0.4], "wid": 0.045, "color": "#2a2018", "mirror": True}],
                      "cx": {"speckle": {"p": 0.22, "color": "#221c18", "k": 0.75}, "mottle": 0.16}})
            a["x"] = a.get("x", "").replace("g", "")
        # v5.43: genera with a look of their own (shape for all their species, colours for living ones), species overrides inside
        if g in GENUS_LOOK:
            look = GENUS_LOOK[g]; sp_o = look.get("sp", {}).get(c["id"], {})
            for k_, v_ in list(look.items()) + list(sp_o.items()):
                if k_ == "sp" or (c["fossil"] and k_ not in SHAPE_KEYS): continue
                a[k_] = dict(a.get(k_) or {}, **v_) if isinstance(v_, dict) else v_
            if not c["fossil"]: a["x"] = a.get("x", "").replace("g", "")
            if "x" in a and not a["x"]: a.pop("x")
        if c["id"] in CURATED:  # v4.81: hand-checked against its photo
            a.update(CURATED[c["id"]]); a["x"] = a.get("x", "").replace("g", "").replace("l", "" if "L" in CURATED[c["id"]] else "l")
            if not a["x"]: a.pop("x")
        if c["family"] == "Uropeltidae" or c["family"] == "Cylindrophiidae" or c["family"] == "Aniliidae": a["o"] = 1  # short blunt tail
        # v5.18: the real number of scale rows (so scales are the right size), and granular or glassy skin where the genus has it
        if g in GENUS_ROWS and "rows" not in (a.get("sx") or {}): a["sx"] = dict(a.get("sx") or {}, rows=GENUS_ROWS[g])
        # v5.23: an enlarged middle row of back scales in kraits, cat snakes and bronzebacks; glossy skin where it is
        if g in ("bungarus",): a["sx"] = dict(a.get("sx") or {}, vert=2.2)
        elif g in ("boiga", "dendrelaphis", "toxicodryas", "chrysopelea"): a["sx"] = dict(a.get("sx") or {}, vert=1.7)
        if g in ("calamaria", "atractus", "geophis", "pseudorabdion", "xenopeltis", "cylindrophis", "anilius", "loxocemus") and "gloss" not in (a.get("sx") or {}): a["sx"] = dict(a.get("sx") or {}, gloss=0.85)
        if g == "xenopeltis": a["h"] = dict(a.get("h") or {}, plates=True)  # sunbeam snakes have big head plates
        if g in GENUS_KIND: a["sx"] = dict(a.get("sx") or {}, kind=GENUS_KIND[g][0], rows=GENUS_KIND[g][1], aV=1.0 if g == "acrochordus" else (a.get("sx") or {}).get("aV", 0.8))
        if g == "acanthophis" and "bx" not in a: a["bx"] = {"ld": 14, "neck": 0.5, "tail": 0.11}; a.setdefault("h", {}).setdefault("pupil", "slit")  # v5.12: death adders are short and stout
        # v5.34: kraits have a raised spine and a triangular body; tree snakes a slightly triangular one (sides sloping in)
        if g == "bungarus": a["bx"] = dict(a.get("bx") or {}, tri=0.5, ridge=0.07)
        elif g in ARBOREAL: a["bx"] = dict(a.get("bx") or {}, tri=0.3, ridge=0.04)
        apply_562(a, c, g)  # v5.62: model accuracy
        out[c["id"]] = {"name": c["sci"] if c["is_sci"] else c["name"], "auto": a}
        names[c["id"]] = (nm + " " + c["id"]).lower()
    # v5.34: a pale grey snake whose name says nothing of white, grey or silver was mostly read from the rock, sand or
    # concrete under it (photo checks: dark and brown snakes came out pale grey) - it takes its genus's usual colour
    pal = lambda h: lum(h) > 0.6 and colorsys.rgb_to_hls(*hx(h))[2] < 0.12
    by_g = {}
    for k, v in out.items():
        a = v["auto"]
        if k not in CURATED and not pal(a["d"]) and a["p"] != "blind": by_g.setdefault(k.split("-")[0], []).append(a["d"])
    for k, v in out.items():
        a = v["auto"]
        if k in CURATED or k in AUDIT_FIX or not pal(a["d"]) or a["p"] == "blind" or re.search(r"white|pale|gr[ae]y|silver|ash|albi|alba|leuc|blanc|cinere|argent|candid|ghost|sand|desert", names.get(k, "")): continue
        cs = by_g.get(k.split("-")[0], [])
        if k.split("-")[0] in GREEN_IN_LIFE: cs = [x for x in cs if is_green(x)] or cs
        if len(cs) < 3: continue
        mid = sorted(cs, key=lum)[len(cs) // 2]
        if a.get("lat") in (None, a["d"]): a["lat"] = mid
        a["d"] = mid; a["x"] = a.get("x", "") + ("g" if "g" not in a.get("x", "") else "")
        if a["t"] not in ("plain", "coral") and abs(lum(a["c"]) - lum(mid)) < 0.08: a["c"] = tone(mid, 0.5) if lum(mid) > 0.2 else tone(mid, 2.2, 0.6)
    # v5.68: fossils look like their living relatives (FOSSIL_FAMILY above)
    for c in cards:
        if not c["fossil"] or c["id"] not in out: continue
        own = out[c["id"]]["auto"]; t = fossil_template(c, out, own["L"])
        if not t: continue
        a = json.loads(json.dumps(out[t]["auto"]))
        for k in FOSSIL_KEEP: a[k] = own[k]
        a.pop("tl", None) if c["genus"].lower() not in ("crotalus", "sistrurus") else None  # (no rattle on a fossil that was not a rattlesnake)
        a["x"] = "f" + ("l" if "l" in own.get("x", "") else "")
        a["like"] = t  # the living snake it is built like
        out[c["id"]]["auto"] = a
    return out
