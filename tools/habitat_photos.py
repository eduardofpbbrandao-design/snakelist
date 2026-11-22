#!/usr/bin/env python3
"""v6.09: real photos of what each habitat looks like, for the 3D map's "What it looks like" panel.

Writes data/habitat-photos.json - a small set of freely licensed landscape photos from Wikimedia Commons (CC0, public
domain, CC BY or CC BY-SA only; each with its author, licence and file for the credit line) for every habitat on the map's
Habitats list. The photos are the ones Wikidata gives for the world's WWF ecoregions (Sonoran Desert, Borneo lowland rain
forests, Cerrado...): one picked by people for each ecoregion, nearly always a wide view of the real landscape. The
ecoregion's code says what kind of place it is (its biome: tropical moist forest, desert, mangroves...) and where it is
(its position, from the photo or the ecoregion), so:
  - habitats that are kinds of place (Tropical Rainforest, Sand Dunes, Marshes...) are put in GROUPS, and each group gets
    photos per REGION (the rainforest of South America looks nothing like a rainforest in New Guinea);
  - habitats that are named places (Sonoran Desert, Okavango Delta...) get the photos of the ecoregions nearest that place
    (NAMED: lat, lon, km, kind of place).
Each photo keeps the real spot it shows, so the 3D map can fly the camera down to it.
Nothing is fetched at run time except the photo files themselves (upload.wikimedia.org thumbnails, which Wikimedia allows
to be shown on other sites). Satellite pictures, maps, animals, plants close up, people and buildings are left out by title.

Run: python3 tools/habitat_photos.py   (one Wikidata query and ~20 Commons requests, a few seconds apart)
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "habitat-photos.json")
CACHE = os.path.join(os.environ.get("HP_CACHE", "/tmp"), "habitat-photos-cache.json")
API = "https://commons.wikimedia.org/w/api.php"
UA = "habitat-photo-builder/1.0 (offline data build)"
PER_SET = 6

# the map's regions (region_of below: the same boxes as regionOf() in snakelist-synced.html's 3D map script)
REGIONS = {
    "na": "North America",
    "ca": "Central America and the Caribbean",
    "sa": "South America",
    "eu": "Europe",
    "me": "North Africa and the Middle East",
    "af": "Africa",
    "sas": "South Asia",
    "sea": "Southeast Asia",
    "eas": "East and Central Asia",
    "au": "Australia, New Guinea and the Pacific",
}
# kinds of place: the habitats in each (and words describing it)
GROUPS = {
    "rainforest": (["Tropical Rainforest", "Tropical Moist Forest", "Tropical Lowland Forest", "Subtropical Forest", "Tropical Seasonal Forest",
                    "Bamboo Forest", "Coastal Forest", "Evergreen Forest", "Broadleaf Forest"], ["rainforest", "jungle", "rain forest"]),
    "cloudforest": (["Tropical Montane Forest", "Montane Rainforest", "Cloud Forest", "Mountain Forest", "Montane Woodland"], ["cloud forest", "montane forest", "mountain forest"]),
    "dryforest": (["Tropical Dry Forest", "Subtropical Dry Forest", "Thorn Forest", "Scrub Forest", "Dry Woodland", "Woodland", "Open Woodland"], ["dry forest", "woodland", "bush"]),
    "temperate": (["Temperate Rainforest", "Temperate Deciduous Forest", "Temperate Mixed Forest", "Secondary Forest", "Regenerating Forest",
                   "Forest Edges", "Forest Clearings", "Leaf Litter", "Fallen Logs", "Loose Soil", "Underground Burrows", "Sandy Soil"], ["forest", "woods"]),
    "conifer": (["Temperate Coniferous Forest", "Boreal Forest", "Pine Forest", "Subalpine Forest", "Eucalyptus Forest"], ["pine forest", "conifer", "taiga", "forest"]),
    "swamp": (["Flooded Forest", "Peat Swamp Forest", "Swamps", "Freshwater Swamps", "Forested Swamps"], ["swamp", "flooded forest", "bayou"]),
    "mangrove": (["Mangrove Forest", "Mangrove Swamps", "Brackish Wetlands", "Estuaries"], ["mangrove", "estuary"]),
    "marsh": (["Wetlands", "Marshes", "Freshwater Marshes", "Salt Marshes", "Bogs", "Fens", "Peatlands", "Floodplains", "Seasonal Wetlands"], ["marsh", "wetland", "bog"]),
    "river": (["Rivers", "Streams", "Creeks", "Lakes", "Ponds", "Springs", "Waterholes", "Reservoirs", "Irrigation Canals", "Riverine Forest", "Gallery Forest"], ["river", "stream", "lake", "creek"]),
    "savanna": (["Savanna", "Tropical Savanna", "Dry Savanna", "Wet Savanna", "Tropical Grassland", "Termite Mounds"], ["savanna", "savannah", "grassland"]),
    "grassland": (["Grassland", "Temperate Grassland", "Prairie", "Steppe", "Meadow", "Highlands", "Valleys", "Plateaus"], ["grassland", "prairie", "steppe", "meadow"]),
    "alpine": (["Alpine Meadow", "Alpine Grassland", "Alpine Shrubland", "Mountain Slopes", "Scree Slopes"], ["alpine", "mountain", "mountains"]),
    "shrub": (["Shrubland", "Scrubland", "Mediterranean Shrubland", "Chaparral", "Heathland", "Fynbos", "Coastal Scrub"], ["scrub", "shrubland", "heath", "maquis"]),
    "sanddesert": (["Desert", "Hot Desert", "Sandy Desert", "Sand Dunes", "Coastal Desert", "Coastal Dunes"], ["dunes", "desert", "sand dune"]),
    "rockdesert": (["Cold Desert", "Semi-Desert", "Rocky Desert", "Gravel Desert", "Desert Scrub"], ["desert", "semi-desert", "badlands"]),
    "rocks": (["Rocky Hillsides", "Rocky Outcrops", "Cliffs", "Canyons", "Gorges", "Caves", "Rock Crevices"], ["canyon", "gorge", "cliffs", "rocks"]),
    "coast": (["Beaches", "Sandy Shores", "Coastal Lagoons", "Rocky Shores"], ["beach", "coast", "lagoon"]),
    "reef": (["Coral Reefs", "Seagrass Beds", "Shallow Coastal Waters", "Open Ocean", "Pelagic Waters"], ["reef", "coral", "lagoon", "sea"]),
    "farm": (["Agricultural Land", "Farmland", "Plantations", "Orchards", "Rice Paddies", "Rural Settlements", "Roadsides", "Disturbed Habitats"], ["rice", "fields", "farmland", "plantation", "village"]),
    "town": (["Gardens", "Parks", "Urban Areas", "Suburban Areas", "Abandoned Buildings"], ["park", "garden", "suburb"]),
}
# named places: (lat, lon, radius in km, kind of place)
NAMED = {
    "Madagascar Rainforest": (-18.9, 48.4, 250, "rainforest"), "Madagascar Lowland Rainforest": (-15.5, 49.9, 250, "rainforest"),
    "Madagascar Montane Rainforest": (-21.3, 47.4, 200, "rainforest"), "Madagascar Humid Forest": (-18.9, 48.4, 300, "rainforest"),
    "Madagascar Subhumid Forest": (-19.5, 47.0, 300, "temperate"), "Madagascar Dry Deciduous Forest": (-16.2, 46.7, 350, "dryforest"),
    "Madagascar Spiny Forest": (-24.0, 44.5, 300, "dryforest"), "Madagascar Spiny Thicket": (-24.5, 45.5, 300, "dryforest"),
    "Madagascar Succulent Woodland": (-22.5, 43.9, 300, "dryforest"), "Madagascar Montane Shrubland": (-22.2, 46.9, 200, "shrub"),
    "Madagascar Mangrove Forest": (-16.0, 45.5, 400, "mangrove"), "Madagascar Coastal Forest": (-17.5, 49.3, 300, "rainforest"),
    "Madagascar Limestone Karst Forest": (-18.9, 44.8, 250, "rocks"),
    "Borneo Rainforest": (1.0, 114.0, 600, "rainforest"), "Borneo Lowland Rainforest": (4.9, 117.8, 400, "rainforest"),
    "Borneo Montane Rainforest": (6.0, 116.5, 150, "cloudforest"), "Borneo Cloud Forest": (6.0, 116.5, 120, "cloudforest"),
    "Borneo Peat Swamp Forest": (-2.0, 114.0, 400, "swamp"), "Borneo Heath Forest": (1.5, 111.0, 500, "rainforest"),
    "Borneo Dipterocarp Forest": (4.9, 117.8, 400, "rainforest"), "Borneo Mangrove Forest": (5.5, 118.0, 500, "mangrove"),
    "Borneo Limestone Forest": (4.0, 114.8, 200, "rocks"),
    "Amazon Rainforest": (-3.4, -62.6, 900, "rainforest"), "Amazon Lowland Rainforest": (-4.0, -66.0, 900, "rainforest"),
    "Amazon Flooded Forest": (-3.0, -64.8, 500, "swamp"), "Amazon Várzea Forest": (-3.0, -64.8, 500, "swamp"),
    "Amazon Igapó Forest": (-1.0, -62.0, 500, "swamp"), "Amazon Terra Firme Forest": (-12.8, -69.3, 400, "rainforest"),
    "Atlantic Rainforest": (-23.5, -45.5, 700, "rainforest"), "Chocó Rainforest": (5.5, -76.8, 400, "rainforest"),
    "Guiana Shield Rainforest": (4.5, -58.0, 600, "rainforest"), "Andean Cloud Forest": (-0.1, -78.6, 500, "cloudforest"),
    "Andean Yungas": (-16.2, -67.7, 400, "cloudforest"), "Cerrado Savanna": (-15.5, -47.7, 700, "savanna"),
    "Pantanal Wetlands": (-17.8, -57.0, 350, "marsh"), "Caatinga Dry Forest": (-8.5, -39.5, 600, "dryforest"),
    "Gran Chaco Woodland": (-22.0, -61.0, 500, "dryforest"), "Llanos Grassland": (6.5, -69.0, 500, "savanna"),
    "Pampas Grassland": (-35.5, -60.0, 500, "grassland"), "Patagonian Steppe": (-46.0, -69.0, 700, "grassland"),
    "Coastal Restinga": (-22.9, -42.0, 500, "coast"),
    "Congo Basin Rainforest": (0.5, 20.0, 1000, "rainforest"), "Guinean Rainforest": (6.5, -7.5, 700, "rainforest"),
    "East African Coastal Forest": (-5.5, 39.0, 500, "rainforest"), "African Montane Forest": (-1.4, 29.6, 600, "cloudforest"),
    "Miombo Woodland": (-12.0, 30.0, 900, "dryforest"), "Mopane Woodland": (-19.0, 26.5, 700, "dryforest"),
    "Sudanian Savanna": (11.0, 2.0, 900, "savanna"), "Serengeti Grassland": (-2.3, 34.8, 250, "savanna"),
    "Kalahari Desert": (-23.5, 21.5, 600, "sanddesert"), "Namib Desert": (-24.7, 15.3, 400, "sanddesert"),
    "Sahara Desert": (24.0, 8.0, 1500, "sanddesert"), "Sahel Shrubland": (15.0, 2.0, 900, "savanna"),
    "Ethiopian Highlands": (11.0, 38.5, 500, "alpine"), "Cape Fynbos": (-34.0, 19.0, 300, "shrub"), "Okavango Delta": (-19.3, 22.9, 200, "marsh"),
    "Sumatra Rainforest": (-1.0, 101.5, 600, "rainforest"), "Sumatra Montane Rainforest": (3.5, 97.5, 300, "cloudforest"),
    "Sumatra Peat Swamp Forest": (0.5, 102.5, 400, "swamp"), "Malay Peninsula Rainforest": (4.5, 102.4, 400, "rainforest"),
    "Malay Peninsula Montane Forest": (4.5, 101.4, 150, "cloudforest"), "Thailand Tropical Forest": (14.4, 101.4, 500, "rainforest"),
    "Thailand Dry Forest": (16.0, 101.0, 500, "dryforest"), "Indochina Dry Forest": (13.0, 105.5, 500, "dryforest"),
    "Indochina Rainforest": (16.0, 107.5, 500, "rainforest"), "Western Ghats Rainforest": (11.5, 76.0, 400, "rainforest"),
    "Eastern Ghats Dry Forest": (16.5, 80.5, 500, "dryforest"), "Himalayan Foothill Forest": (29.5, 80.5, 500, "temperate"),
    "Himalayan Montane Forest": (27.8, 86.5, 500, "conifer"), "Sundarbans Mangrove Forest": (21.9, 89.2, 150, "mangrove"),
    "Sri Lanka Rainforest": (6.4, 80.5, 120, "rainforest"), "Sri Lanka Dry Forest": (8.3, 80.8, 200, "dryforest"),
    "Philippine Rainforest": (10.0, 123.5, 700, "rainforest"), "Philippine Montane Forest": (16.5, 120.8, 400, "cloudforest"),
    "Java Rainforest": (-6.8, 107.0, 400, "rainforest"), "Java Montane Forest": (-7.6, 110.4, 400, "cloudforest"),
    "Bali Dry Forest": (-8.2, 114.6, 200, "dryforest"), "Sulawesi Rainforest": (-1.5, 120.8, 500, "rainforest"),
    "Sulawesi Montane Forest": (-1.5, 120.0, 400, "cloudforest"), "Himalayan Alpine Meadow": (28.5, 85.5, 600, "alpine"),
    "New Guinea Lowland Rainforest": (-5.0, 143.0, 700, "rainforest"), "New Guinea Montane Rainforest": (-6.0, 145.0, 500, "cloudforest"),
    "Solomon Islands Rainforest": (-9.5, 160.0, 500, "rainforest"), "New Caledonia Forest": (-21.5, 165.5, 250, "rainforest"),
    "Queensland Tropical Rainforest": (-16.5, 145.4, 300, "rainforest"), "Queensland Wet Tropics": (-17.3, 145.6, 250, "rainforest"),
    "Australian Eucalyptus Woodland": (-33.5, 148.0, 700, "dryforest"), "Australian Savanna": (-15.5, 132.0, 900, "savanna"),
    "Australian Outback Desert": (-25.3, 131.0, 900, "rockdesert"), "Australian Spinifex Grassland": (-22.0, 128.0, 900, "rockdesert"),
    "Australian Coastal Heathland": (-34.0, 151.0, 900, "shrub"), "Australian Mulga Woodland": (-26.5, 144.0, 800, "dryforest"),
    "Australian Brigalow Woodland": (-25.0, 149.0, 500, "dryforest"), "Australian Monsoon Forest": (-12.5, 131.5, 400, "rainforest"),
    "New Guinea Swamp Forest": (-7.5, 141.5, 600, "swamp"),
    "Sonoran Desert": (32.2, -112.5, 350, "rockdesert"), "Mojave Desert": (35.0, -116.0, 300, "sanddesert"),
    "Chihuahuan Desert": (30.5, -104.5, 450, "rockdesert"), "Great Basin Desert": (40.0, -116.5, 450, "rockdesert"),
    "Great Plains Grassland": (40.0, -100.0, 900, "grassland"), "Eastern North American Deciduous Forest": (38.5, -80.0, 800, "temperate"),
    "Appalachian Forest": (36.5, -82.0, 500, "temperate"), "Pacific Northwest Temperate Rainforest": (47.8, -123.8, 300, "temperate"),
    "Florida Everglades": (25.6, -80.9, 120, "marsh"), "Southeastern Pine Forest": (31.5, -84.5, 600, "conifer"),
    "Longleaf Pine Savanna": (31.0, -85.5, 600, "conifer"), "California Chaparral": (34.3, -118.5, 300, "shrub"),
    "Rocky Mountain Foothills": (39.8, -105.3, 400, "rocks"),
    "Mesoamerican Rainforest": (16.5, -90.5, 400, "rainforest"), "Central American Cloud Forest": (10.3, -84.8, 300, "cloudforest"),
    "Central American Dry Forest": (10.8, -85.6, 300, "dryforest"), "Yucatán Tropical Forest": (19.5, -89.0, 300, "rainforest"),
    "Costa Rican Rainforest": (10.0, -83.8, 250, "rainforest"), "Panamanian Rainforest": (9.0, -79.6, 300, "rainforest"),
    "Caribbean Dry Forest": (18.0, -67.0, 600, "dryforest"), "Caribbean Moist Forest": (18.3, -65.8, 600, "rainforest"),
    "Cuban Pine Forest": (22.5, -83.8, 300, "conifer"), "Hispaniolan Forest": (19.0, -71.0, 300, "cloudforest"),
    "Caribbean Mangrove Forest": (18.0, -77.0, 900, "mangrove"),
    "Mediterranean Scrubland": (40.0, 3.0, 1200, "shrub"), "Mediterranean Pine Forest": (40.5, 15.0, 1200, "conifer"),
    "Iberian Woodland": (39.5, -6.0, 500, "dryforest"), "European Deciduous Forest": (50.5, 10.0, 800, "temperate"),
    "European Mixed Forest": (53.0, 20.0, 900, "temperate"), "Balkan Rocky Grassland": (42.5, 21.0, 500, "grassland"),
    "Carpathian Forest": (47.5, 24.5, 500, "conifer"), "European Steppe": (47.5, 36.0, 800, "grassland"),
    "Mediterranean Coastal Dunes": (40.0, 10.0, 1300, "sanddesert"),
    "Arabian Desert": (22.0, 50.0, 900, "sanddesert"), "Syrian Desert": (33.0, 39.0, 500, "rockdesert"),
    "Negev Desert": (30.5, 34.8, 150, "rockdesert"), "Zagros Mountain Woodland": (33.5, 47.5, 500, "dryforest"),
    "Iranian Plateau Steppe": (33.0, 54.0, 700, "grassland"), "Mesopotamian Marshes": (31.0, 47.0, 200, "marsh"),
    "Mediterranean Levant Woodland": (33.5, 35.8, 250, "shrub"), "Arabian Mountain Shrubland": (17.0, 43.5, 500, "alpine"),
    "Chinese Subtropical Forest": (26.0, 112.0, 900, "rainforest"), "Chinese Montane Forest": (30.0, 103.0, 600, "cloudforest"),
    "East Asian Temperate Forest": (40.0, 127.0, 900, "temperate"), "Taiwan Montane Forest": (23.6, 121.0, 150, "cloudforest"),
    "Japanese Temperate Forest": (36.0, 138.0, 700, "temperate"), "Central Asian Steppe": (48.0, 68.0, 1200, "grassland"),
    "Gobi Desert": (43.0, 104.0, 900, "rockdesert"), "Taklamakan Desert": (38.5, 82.0, 700, "sanddesert"),
}
LIC = re.compile(r"^(cc0|cc-zero|public domain|pd(-[\w-]+)?|cc[ -]by(-sa)?[ -][0-9.]+( [\w-]+)?)$", re.I)
BAD = re.compile(r"\b(nasa|modis|landsat|sentinel|satellite|aerial|map|maps|ecoregion|sheme|scheme|diagram|chart|logo|flag|locator|"
                 r"frog|toad|bird|snake|lizard|insect|butterfly|beetle|spider|flower|blossom|orchid|mushroom|fungus|portrait|"
                 r"people|selfie|church|museum|hotel|station|airport|statue|monument|sign|stamp|drawing|painting|illustration|"
                 r"monkey|lemur|deer|lion|elephant|fish|crab|skull|fossil|castle|palace|night|flamingo|flamingos|flamingoes|cattle|horses)\b", re.I)
LATIN = re.compile(r"\b[A-Z][a-z]+(us|um|is|a|ae|ia|ops|ix|on) [a-z]{3,}(us|a|um|is|ii|i|ae|ensis|er|ata|atus|ina|inus)\b")  # a species' scientific name
SPARQL = "https://query.wikidata.org/sparql"
# the WWF biome numbers (the 3rd-4th characters of an ecoregion's code, e.g. NT0101) that show each kind of place
BIOMES = {"rainforest": ["01"], "cloudforest": ["01", "10"], "dryforest": ["02", "07"], "temperate": ["04"], "conifer": ["05", "06", "03"],
          "swamp": ["01", "09"], "mangrove": ["14"], "marsh": ["09", "14"], "river": ["09", "01"], "savanna": ["07"], "grassland": ["08", "10"],
          "alpine": ["10", "11"], "shrub": ["12", "13"], "sanddesert": ["13"], "rockdesert": ["13"], "rocks": ["13", "10", "12"],
          "coast": ["14", "13", "12"], "reef": ["14"], "farm": ["07", "08", "04"], "town": ["04", "12", "07"]}
# words in an ecoregion's name that make it a better (+) or worse (-) fit for a kind of place
FIT = {"cloudforest": (r"montane|mountain|cloud|highland|yungas|paramo", r"lowland|dry"), "swamp": (r"swamp|flooded|v.rzea|igap|peat|delta", ""),
       "river": (r"river|delta|flooded|v.rzea|riparian|gallery", ""), "rainforest": (r"lowland|moist|rain", r"montane|swamp|mangrove|dry"),
       "sanddesert": (r"sand|dune|erg|desert", r"steppe|scrub|shrub"), "rockdesert": (r"desert|xeric|scrub", r"dune|sand"),
       "rocks": (r"rock|canyon|plateau|mountain|xeric", ""), "alpine": (r"alpine|montane|puna|paramo|meadow", r"tundra"),
       "shrub": (r"scrub|shrub|matorral|fynbos|chaparral|macchia|sclerophyll|heath", ""), "grassland": (r"grass|steppe|prairie|pampa|meadow", ""),
       "conifer": (r"conifer|pine|taiga|boreal|fir", ""), "dryforest": (r"dry|woodland|thorn|deciduous", r"savanna")}


def region_of(lat, lon):
    """the same boxes as regionOf() in the app's 3D map script"""
    if 92 <= lon <= 141 and -11 <= lat <= 23 and not (lon >= 130.5 and lat < -1):
        return "sea"
    if (110 <= lon <= 180 and -50 <= lat <= 0) or lon < -140 or (lon > 150 and lat < 25):
        return "au"
    if -18 <= lon <= 63 and 12 <= lat <= 37.5 and not (lon < -5 and lat > 36):
        return "me"
    if -25 <= lon <= 50 and lat > 35:
        return "eu"
    if -20 <= lon <= 60 and lat < 15:
        return "af"
    if 60 <= lon <= 92 and 5 <= lat <= 37:
        return "sas"
    if lon >= 40:
        return "eas"
    if lon < -30:
        if lat >= 24:
            return "na"
        if lat >= 13.5 or (lat >= 7 and lon < -77.3):
            return "ca"
        return "sa"
    return "eu"


def km(a, b, c, d):
    import math
    p = math.pi / 180
    x = (d - b) * p * math.cos((a + c) / 2 * p)
    return 6371 * math.hypot(x, (c - a) * p)


def http(url, accept="application/json", tries=8):
    for k in range(tries):
        wait = 3 - (time.time() - last[0])
        if wait > 0:
            time.sleep(wait)
        last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept}), timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            ra = e.headers.get("retry-after")
            d = int(ra) + 2 if ra and ra.isdigit() else 20 * (k + 1)
            print("   HTTP %d, waiting %ds" % (e.code, d), flush=True)
            time.sleep(d)
        except Exception as e:  # noqa: BLE001 - network hiccup
            print("   %s, retrying" % e, flush=True)
            time.sleep(10 * (k + 1))
    raise SystemExit("the server kept refusing - try again later")


last = [0.0]


def plain(t):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t or ""))).strip()


def ecoregions(cache):
    if "eco" not in cache:
        q = ("SELECT ?e ?eLabel ?code ?img ?coord WHERE { ?e wdt:P1294 ?code . ?e wdt:P18 ?img . OPTIONAL {?e wdt:P625 ?coord} "
             "SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". } }")
        d = http(SPARQL + "?" + urllib.parse.urlencode({"query": q}), "application/sparql-results+json")
        rows = {}
        for b in d["results"]["bindings"]:
            f = urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[-1])
            m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", (b.get("coord") or {}).get("value", ""))
            r = rows.setdefault(f, {"file": f, "code": b["code"]["value"], "name": b["eLabel"]["value"], "lat": None, "lon": None})
            if m and r["lat"] is None:
                r["lon"], r["lat"] = float(m.group(1)), float(m.group(2))
        cache["eco"] = list(rows.values())
    return cache["eco"]


def file_info(files, cache):
    info = cache.setdefault("info", {})
    todo = [f for f in files if f not in info]
    for i in range(0, len(todo), 50):
        part = todo[i:i + 50]
        d = http(API + "?" + urllib.parse.urlencode({"action": "query", "format": "json", "formatversion": "2", "titles": "|".join("File:" + f for f in part),
                                                     "prop": "imageinfo|coordinates", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 1280,
                                                     "iiextmetadatafilter": "LicenseShortName|Artist"}))
        norm = {n["to"]: n["from"] for n in (d["query"].get("normalized") or [])}
        for p in d["query"].get("pages") or []:
            t = p["title"]
            src = norm.get(t, t)[5:]
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata") or {}
            c = (p.get("coordinates") or [{}])[0]
            info[src] = {"t": t[5:], "w": ii.get("width", 0), "h": ii.get("height", 0), "u": ii.get("thumburl", ""), "m": ii.get("mime", ""),
                         "lic": plain((em.get("LicenseShortName") or {}).get("value")), "by": plain((em.get("Artist") or {}).get("value"))[:70],
                         "lat": c.get("lat"), "lon": c.get("lon")}
        print("   file details %d/%d" % (min(i + 50, len(todo)), len(todo)), flush=True)
        json.dump(cache, open(CACHE, "w"))
    return info


TREES = {"Pinus", "Larix", "Cedrus", "Taxodium", "Nothofagus", "Acacia", "Eucalyptus", "Avicennia", "Attalea", "Widdringtonia", "Quercus",
         "Fagus", "Abies", "Picea", "Araucaria", "Rhizophora", "Adansonia", "Sabal", "Mauritia"}


def animal(t):
    """a photo named after a species (an eagle, a stork, a flower) - trees are kept: their photos show the forest"""
    m = LATIN.search(t)
    if not m or re.search(r"\b(river|oasis|border|forest|diamantina|hacia|lake|valley|desert)\b", m.group(0), re.I):
        return False
    return m.group(0).split()[0] not in TREES


def good(x):
    t = os.path.splitext(x["t"])[0].replace("_", " ")
    return (x["m"] == "image/jpeg" and x["u"] and x["w"] >= 1000 and x["w"] >= 1.2 * x["h"] and x["w"] <= 4.2 * x["h"]
            and LIC.match(x["lic"]) and not BAD.search(t) and not animal(t))


def main():
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    eco = ecoregions(cache)
    json.dump(cache, open(CACHE, "w"))
    info = file_info([e["file"] for e in eco], cache)
    pics = []
    for e in eco:
        x = info.get(e["file"])
        if not x or not good(x):
            continue
        lat, lon = (x["lat"], x["lon"]) if x["lat"] is not None else (e["lat"], e["lon"])
        if lat is None:
            continue
        pics.append(dict(x, lat=lat, lon=lon, biome=e["code"][2:4], eco=e["name"], reg=region_of(lat, lon)))
    print("%d ecoregions with a photo, %d usable" % (len(eco), len(pics)))
    photos, pidx, sets = [], {}, {}

    def keep(lst):
        out = []
        for x in lst:
            if x["t"] not in pidx:
                pidx[x["t"]] = len(photos)
                photos.append([x["t"], x["u"], round(x["lat"], 4), round(x["lon"], 4), x["by"] or "Unknown author", x["lic"], x["eco"]])
            out.append(pidx[x["t"]])
        return out

    def score(x, g, near=None):
        bi = BIOMES[g]
        s = 0 if x["biome"] == bi[0] else 1 + bi.index(x["biome"]) if x["biome"] in bi else 9
        good_rx, bad_rx = FIT.get(g, ("", ""))
        if good_rx and re.search(good_rx, x["eco"], re.I):
            s -= 1.5
        if bad_rx and re.search(bad_rx, x["eco"], re.I):
            s += 2
        if near:
            s += km(near[0], near[1], x["lat"], x["lon"]) / 400.0
        return s
    for g in GROUPS:
        for r in REGIONS:
            cand = [x for x in pics if x["reg"] == r and x["biome"] in BIOMES[g]]
            cand.sort(key=lambda x: (score(x, g), x["t"]))
            sets["g:%s:%s" % (g, r)] = keep(cand[:PER_SET])
    for name, (lat, lon, rad, g) in NAMED.items():
        cand = [x for x in pics if x["biome"] in BIOMES[g] and km(lat, lon, x["lat"], x["lon"]) <= max(rad * 2.5, 900)]
        cand.sort(key=lambda x: (score(x, g, (lat, lon)), x["t"]))
        sets["n:" + name] = keep(cand[:PER_SET])
    hab_group = {h: g for g, (habs, _) in GROUPS.items() for h in habs}
    data = {"v": 1, "note": "Photos from Wikimedia Commons (CC0 / public domain / CC BY / CC BY-SA): the photo Wikidata gives for each WWF "
                           "ecoregion, picked by tools/habitat_photos.py. [file, thumbnail, lat, lon, author, licence, ecoregion]",
            "regions": REGIONS, "group": hab_group,
            "named": {n: [v[0], v[1], v[3]] for n, v in NAMED.items()}, "sets": sets, "photos": photos}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    thin = sorted(k for k, v in sets.items() if len(v) < 3)
    print("%d sets, %d photos -> %s (%d bytes); %d with under 3 photos: %s" % (len(sets), len(photos), OUT, os.path.getsize(OUT), len(thin), ", ".join(thin)))


if __name__ == "__main__":
    main()
