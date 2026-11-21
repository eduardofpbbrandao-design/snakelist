"""Find the snakes whose common name in SnakeList is Chinese - written in Chinese characters, or
Chinese written in pinyin only (e.g. "Zhangshi Houlengshe") - and give each an English name for
the "Translate" button: the Reptile Database's English common name ("Common Names  E:"), else
Wikidata's English label / English Wikipedia title when it is a real common name, else the Reptile Database style "<epithet> <genus-type> snake" built from the
genus's own English group name (data/genus-info.json or the other cards of that genus), else the
scientific name. Writes data/chinese-names.json  {id: {"zh": name, "en": english, "src": ...}}
writes the list into the app (var ZH in its sl-fx script, which build_species.py copies to
every page) and prints it. Run:  python3 tools/chinese_names.py
"""
import json, re, urllib.request, html as H
def rdb_english(sci):
    """the English common name from the Reptile Database (its "Common Names  E: ..." line), or "" """
    g, sp = (sci.split() + ["", ""])[:2]
    try:
        req = urllib.request.Request("https://reptile-database.reptarium.cz/species?genus=%s&species=%s" % (g, sp), headers={"User-Agent": "Mozilla/5.0 (SnakeList data build)"})
        t = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")
    except Exception as e:
        print("  (Reptile Database not reached for", sci, ":", e, ")"); return ""
    t = H.unescape(re.sub(r"<[^>]+>", " ", t)); m = re.search(r"Common Names\s+E:\s*([^\n]+?)(?:\s+[A-Z][a-z]+:|\s{2,}|$)", t)
    if not m: return ""
    n = m.group(1).split(",")[0].strip().replace("\u2019", "'")
    return " ".join(w[:1].upper() + w[1:] if w.islower() else w for w in n.split()).replace("Hung-Ta", "Hung-ta")
app = open("snakelist-synced.html", encoding="utf-8").read()
wd = json.load(open("data/wikidata-species.json", encoding="utf-8"))
cards = re.findall(r'<div class="card" data-id="([^"]+)"[^>]*?data-name="([^"]*)"', app)
INI = "b p m f d t n l g k h j q x zh ch sh r z c s y w".split()
FIN = ("a o e i u v ai ei ui ao ou iu ie ve er an en in un vn ang eng ing ong ia iao ian iang iong ua uo uai uan uang ue "
       "ve ueng").split()
SYL = set(FIN)
for i in INI:
    for f in FIN: SYL.add(i + f)
SYL -= {"bv", "pv", "mv", "fv", "dv", "tv", "gv", "kv", "hv"}
def pinyin_word(w):
    w = w.lower()
    if not w or len(w) < 2: return False
    ok = [True] + [False] * len(w)
    for i in range(len(w)):
        if not ok[i]: continue
        for j in range(i + 1, min(len(w), i + 6) + 1):
            if w[i:j] in SYL: ok[j] = True
    return ok[len(w)]
# English words that happen to split into pinyin syllables - never Chinese
EN = set("""a an and banded bang bean beige black blind brown ceylon chain china chinese common dian fan fang gong hong
house king long man mang men mud nan pan ping rang ring sea shan she shang tan wan wang yang yuan zhang hun huang liang
mountain stream water keel back""".split())
def is_pinyin_name(n):
    ws = re.findall(r"[A-Za-z]+", n)
    if len(ws) < 1 or re.search(r"[^A-Za-z \-']", n): return False
    if not all(pinyin_word(w) for w in ws): return False
    # needs at least one word that is clearly Chinese (not an English word), and "she" (snake) somewhere
    return any(w.lower() not in EN for w in ws) and re.search(r"she\b", n.lower()) is not None
def sci_of(cid):
    m = re.search(r'<div class="card" data-id="' + re.escape(cid) + r'"[^>]*>(.{0,900})', app)
    m2 = m and re.search(r'<div class="card-sci">([^<]+)</div>', m.group(1))
    return m2.group(1).strip() if m2 else cid.replace("-", " ").capitalize()
out = {}
for cid, name in cards:
    if not (re.search(r"[㐀-鿿]", name) or is_pinyin_name(name)): continue
    sci = sci_of(cid); d = wd.get(cid, {})
    en, src = rdb_english(sci), "Reptile Database"
    if not en: src = ""
    for cand, s in ((d.get("en", ""), "Wikidata"), (d.get("enwiki", ""), "English Wikipedia")):
        if cand and cand.lower() != sci.lower() and not re.search(r"[㐀-鿿]", cand) and not is_pinyin_name(cand):
            if not en: en, src = cand, s
            break
    if not en:
        # the genus's English name, from the other snakes of the genus that SnakeList lists in English
        genus = sci.split()[0]; ep = sci.split()[1] if len(sci.split()) > 1 else ""
        sibs = [n for c, n in cards if c.startswith(genus.lower() + "-") and c != cid and not re.search(r"[㐀-鿿]", n) and not is_pinyin_name(n) and n != sci]
        tails = {}
        for n in sibs:
            t = " ".join(n.split()[-3:]) if re.search(r"stream snake$", n, re.I) else " ".join(n.split()[-2:])
            if re.search(r"snake|viper|krait|cobra|racer", t, re.I): tails[t] = tails.get(t, 0) + 1
        if tails:
            tail = max(tails, key=tails.get)
            who = {"hungtai": "Hung-ta's", "zhaoermii": "Zhao's"}.get(ep, ep[:1].upper() + ep[1:] + "'s" if ep.endswith("i") else ep.capitalize())
            en, src = who + " " + tail, "genus name in SnakeList (" + tail + ")"
        else:
            en, src = sci, "scientific name"
    out[cid] = {"zh": name, "en": en, "sci": sci, "src": src}
json.dump(out, open("data/chinese-names.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
# the app (and, through build_species.py, every page) carries the list in its sl-fx script
APPF = "snakelist-synced.html"; a = open(APPF, encoding="utf-8").read()
zh = json.dumps({k: {"zh": v["zh"], "en": v["en"]} for k, v in sorted(out.items())}, ensure_ascii=True)
a2 = re.sub(r"var ZH = \{.*?\}; // zh-names \(tools/chinese_names.py\)", lambda m: "var ZH = " + zh + "; // zh-names (tools/chinese_names.py)", a, count=1)
if a2 != a: open(APPF, "w", encoding="utf-8").write(a2)
for k, v in out.items(): print(k, "|", v["zh"], "->", v["en"], "(" + v["src"] + ")")
print(len(out), "names")
