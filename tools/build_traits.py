#!/usr/bin/env python3
"""Build the colour data behind the Characteristics search (v6.11) and put it in snakelist-synced.html.

    python3 tools/build_traits.py

Reads data/snake-model-colours.json (each species' main body colour "d" and pattern colour "p", measured from its photo
for the 3D models; "q" is how sure that measurement is, "c" how strong the pattern is) and data/snake-models.json (the
hand-made 3D profiles, with their pattern types). Writes <script type="application/json" id="trait-data"> into the app:

    {"col": {"black": [ids], "green": [ids], ...},      # main body or pattern colour
     "pat": {"striped": [ids], "banded": [ids], ...},   # pattern types from the 3D profiles
     "plain": [ids]}                                    # a measured body with (almost) no pattern

Everything else the search knows (venomous, constrictor, rattle, horns, sea snake, words in the snake's name...) is
worked out in the app from what each card already holds. Run it again whenever the colour data changes.
"""
import colorsys, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "snakelist-synced.html")


def name_of(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    v = max(r, g, b)
    sat = 0 if v == 0 else (v - min(r, g, b)) / v
    if v < 0.2: return "black"
    if sat < 0.14:
        if v > 0.82: return "white"
        if v < 0.3: return "black"
        return "grey"
    if v < 0.32 and sat < 0.5: return "black"
    if h < 14 or h >= 340: return "red" if sat > 0.45 and v > 0.35 else "brown"
    if h < 40: return "orange" if sat > 0.6 and v > 0.6 else "brown"
    if h < 68: return "yellow" if sat > 0.45 and v > 0.55 else ("brown" if h < 52 else "olive")
    if h < 165: return "green"
    if h < 255: return "blue" if sat > 0.25 else "grey"
    return "purple" if sat > 0.3 else "grey"


def main():
    cols = json.load(open(os.path.join(ROOT, "data/snake-model-colours.json")))
    models = json.load(open(os.path.join(ROOT, "data/snake-models.json")))["species"]
    app = open(APP, encoding="utf-8").read()
    ids = set(re.findall(r'<div class="card[^"]*" data-id="([^"]+)"', app))
    col, pat, plain = {}, {}, []
    for sid, c in sorted(cols.items()):
        if sid not in ids or (c.get("q") or 0) < 0.3: continue
        names = set()
        if c.get("d"): names.add(name_of(c["d"]))
        if c.get("p") and (c.get("c") or 0) >= 0.3: names.add(name_of(c["p"]))
        for n in names:
            if n == "olive": n = "green"
            col.setdefault(n, []).append(sid)
        if (c.get("c") or 0) < 0.08 and (c.get("q") or 0) >= 0.5: plain.append(sid)
    PT = {"line": "striped", "stripe": "striped", "band": "banded", "blotch": "blotched", "spot": "spotted", "zigzag": "zigzag", "checker": "checkered"}
    for sid, m in models.items():
        if sid not in ids: continue
        p = m.get("pattern"); ps = p if isinstance(p, list) else [p] if p else []
        for x in ps:
            t = x.get("type") if isinstance(x, dict) else None
            if t in PT: pat.setdefault(PT[t], [])
            if t in PT and sid not in pat[PT[t]]: pat[PT[t]].append(sid)
    data = {"col": {k: sorted(set(v)) for k, v in sorted(col.items())}, "pat": pat, "plain": sorted(plain)}
    blob = json.dumps(data, separators=(",", ":"))
    tag = '<script type="application/json" id="trait-data">' + blob + "</script>"
    if 'id="trait-data"' in app:
        app = re.sub(r'<script type="application/json" id="trait-data">.*?</script>', lambda m: tag, app, count=1, flags=re.S)
    else:
        anchor = '<script type="application/json" id="fame-data">'
        i = app.index(anchor)
        app = app[:i] + tag + "\n" + app[i:]
    open(APP, "w", encoding="utf-8").write(app)
    print("trait-data:", {k: len(v) for k, v in data["col"].items()}, {k: len(v) for k, v in pat.items()}, "plain", len(plain), len(blob), "bytes")


if __name__ == "__main__":
    main()
