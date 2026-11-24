"""Build the Christmas preview's files into christmas/ (a small folder of assets, no page copies).

    python3 tools/build-christmas.py

The preview is a switch on the live pages, not a copy of them. Every page carries a tiny loader
(tools/xmas_loader.js, put in by build-site.py for the app and by build_species.py into species/sp.js,
species/country.js and species/sl-fx.js for the species, place and info pages):

  https://snakelist.com/?christmas            turns the preview on for this browser tab
  https://snakelist.com/christmas/            the same (it sets the switch and opens the app)
  ?christmas=off (or "Exit preview")          turns it off again

Only while the switch is on does a page load christmas/xmas.css and christmas/xmas.js; without it
the site looks and behaves exactly as before and fetches nothing from christmas/.

This script writes christmas/:
  xmas.css            the decorations' styles (tools/christmas/xmas.css + cabin.css + the accents as data URLs)
  xmas.js             the decorations, Christmas logo, audio and the Cabin (tools/christmas/xmas.js + cabin.js),
                      with XM_ART in front: the Santa hat, the stocking, the snow on the logo's S, the photo
                      hats (tools/christmas/photo-hats.json), the cover's light positions and the cabin's layout
  xmas-corner-l/r.svg the cover's pine corners, baubles hung on their branches (tools/christmas_art.py)
  xmas-cabin.webp     the Christmas Cabin's room (christmas_art.cabin_svg, rendered by tools/christmas-icons.js)
  xmas-sp.json        each species' colours and pattern for its little Santa-hat snake (from species/3d/models.json)
  xmas-logo-*.svg     the pages' header logo (species/logo-light/dark.svg) with the hat, snow and stocking
  xmas-icon.svg       the app icon: SnakeList's own icon (favicon.svg) with the Santa hat and a little snow
  xmas-icon-*.png     the same as PNG (redrawn by tools/christmas-icons.js when Node + Playwright are here)
  index.html          sets the switch and opens the app
  music/             the Christmas songs (real recordings, CC BY 4.0 - see CREDITS.txt), loaded only when the
                      music button is first pressed. They live only here (this script keeps them, it does not make them)
  CREDITS.txt
"""
import os, re, sys, json, shutil, posixpath, time, tempfile, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import christmas_art as art

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_THEME = os.path.join(HERE, "christmas")
OUT = "christmas"                      # relative to ROOT
os.chdir(ROOT)

INDEX = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>SnakeList - Christmas preview</title>
<link rel="icon" type="image/svg+xml" href="xmas-icon.svg">
<script>try{sessionStorage.setItem("sl-xmas-preview","1")}catch(e){}location.replace("../?christmas"+location.hash)</script>
<meta http-equiv="refresh" content="0; url=../?christmas">
</head><body style="background:#0B1913;color:#FFF8ED;font:16px system-ui,sans-serif;text-align:center;padding:40px 16px">
<p><a href="../?christmas" style="color:#E6CB86">Open the SnakeList Christmas preview</a></p></body></html>
"""

def body_path(svg):
    m = re.search(r'class="snake-body"[^>]*\bd="([^"]+)"', svg)
    return m.group(1) if m else None

# ---- the little Santa-hat snakes: per species dorsal / pattern / belly colours (12-bit) and a pattern kind ----
PAT_KIND = {"plain": "p", "none": "p", "uniform": "p", "speckle": "k", "band": "b", "xband": "b", "rings": "b", "crossbar": "b", "ring": "b",
            "coral": "c", "tricolor": "c", "stripe": "s", "garter": "s", "vert": "s", "nerodia": "o", "line": "s", "zigzag": "z", "diamond": "z", "net": "z",
            "collar": "l", "collar2": "l", "cap": "l", "hband": "l", "spot": "o", "checker": "o", "chain": "z", "poly": "o", "shields": "o", "tint": "p"}
# the head's shape for the little snake: v a viper's wide triangle, b a python's or boa's long broad head, e an elapid's
# rounded one, n a blind snake's tiny blunt one, s a sea snake's, c a colubrid's slender head
HEAD_KIND = {"viper": "v", "pitviper": "v", "python": "b", "boa": "b", "elapid": "e", "blind": "n", "sea": "s", "colubrid": "c"}
def c12(h, fb="#5b9a4a"):
    h = (h or fb).lstrip("#")
    if len(h) == 3: h = "".join(ch * 2 for ch in h)
    try: return "".join("%x" % min(15, round(int(h[i:i + 2], 16) / 17)) for i in (0, 2, 4))
    except ValueError: return c12(fb)
def species_colours():
    src = os.path.join("species", "3d", "models.json")
    if not os.path.isfile(src): return {}
    sp = json.load(open(src, encoding="utf-8")).get("species", {})
    out = {}
    for k, v in sp.items():
        a = v.get("auto")
        if a:
            d, c, b, t = a.get("d"), a.get("c"), a.get("b"), a.get("t") or "plain"
            if t in ("plain", "uniform"):
                # a plain base with stripes or blotches on top: show those
                if a.get("ls") or a.get("vs"): t, c = "stripe", (a.get("vs") or a.get("ls"))[0]
                elif a.get("pat"): t, c = a["pat"][0].get("type", "blotch"), a["pat"][0].get("color") or c
        else:
            col = v.get("colors") or {}; pats = v.get("pattern") or []
            d, b = col.get("dorsal"), col.get("belly")
            p0 = next((p for p in pats if p.get("type") not in ("tint", "cap")), pats[0] if pats else {})
            c = p0.get("color") or (col.get("speckle") or {}).get("color") or col.get("lateral")
            t = p0.get("type", "plain")
            # rings edged in another colour (a coral snake's black rings edged yellow): the two-colour rings
            if t == "band" and p0.get("edgeColor"): t, b = "coral", p0["edgeColor"]
        plan = (a or {}).get("p") or v.get("plan") or "colubrid"
        out[k] = c12(d) + c12(c, d or "#333333") + c12(b, "#e0d8b8") + PAT_KIND.get(t, "o") + HEAD_KIND.get(plan, "c")
    return out

def write_art():
    bulbs = {}
    for side in "lr":
        svg, bulbs[side] = art.corner(side)
        open(posixpath.join(OUT, "xmas-corner-%s.svg" % side), "w").write(svg)
    index = open("index.html", encoding="utf-8").read()
    mark_body = body_path(index[index.find('<g id="mark-snake">'):]) or body_path(open("favicon.svg").read())
    h = art.LOGO_HAT
    data = {
        "bulbs": bulbs,
        # the logo's hat goes into #mark-snake (drawn through <use> copies); its gradients and filters go into the
        # page's top-level <defs> (hatDefs) - inside the copied group they did not resolve until late in the opening
        "hat": art.hat_at(h["cx"], h["cy"], h["width"], h["angle"], defs=False),
        "hatDefs": art._hat_defs("xmh"),
        # the photo hat: its own ids (never the same as the logo hat's)
        "hatSvg": art.hat_at(0, 0, 100, 0, prefix="xmp"),
        "ssnow": art.logo_snow(mark_body) if mark_body else "",
        "stocking": art.STOCKING,
        "hatMini": art.hat_at(0, 0, 100, 0, prefix="xmi", detail=False),
        "photoHats": {k: v for k, v in json.load(open(os.path.join(SRC_THEME, "photo-hats.json"), encoding="utf-8")).items() if not k.startswith("_")},
        "cabin": art.cabin_data(),
    }
    js = ("window.XM_ART=" + json.dumps(data, separators=(",", ":")) + ";\n" + open(os.path.join(SRC_THEME, "xmas.js"), encoding="utf-8").read() + "\n"
          + open(os.path.join(SRC_THEME, "cabin.js"), encoding="utf-8").read())
    open(posixpath.join(OUT, "xmas.js"), "w", encoding="utf-8").write(js)
    from urllib.parse import quote
    flake = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24"><g stroke="#B8913F" stroke-width="1.6" stroke-linecap="round" fill="none">'
             + "".join('<path d="M0 0V-10M0 -6.5L-2.6 -9M0 -6.5L2.6 -9" transform="rotate(%d)"/>' % a for a in range(0, 360, 60)) + "</g></svg>")
    css = open(os.path.join(SRC_THEME, "xmas.css"), encoding="utf-8").read() + "\n" + open(os.path.join(SRC_THEME, "cabin.css"), encoding="utf-8").read()
    css += ("\n/* generated by tools/build-christmas.py: the sprig and snowflake used as small accents */\nhtml.xm, .xm-panel { --xm-sprig-url: url(\"data:image/svg+xml,%s\"); --xm-flake-url: url(\"data:image/svg+xml,%s\"); }\n"
            % (quote(art.mini_sprig(), safe=" =:/'.-"), quote(flake, safe=" =:/'.-")))
    open(posixpath.join(OUT, "xmas.css"), "w", encoding="utf-8").write(css)
    # the app icon: SnakeList's own icon with the hat and a little snow
    fav = open("favicon.svg", encoding="utf-8").read()
    fb = body_path(fav)
    open(posixpath.join(OUT, "xmas-icon.svg"), "w").write(art.icon(fav, art.hat_at(h["cx"], h["cy"], h["width"], h["angle"]), art.logo_snow(fb) if fb else ""))
    # the little snakes' colours
    open(posixpath.join(OUT, "xmas-sp.json"), "w").write(json.dumps(species_colours(), separators=(",", ":"), sort_keys=True))

def events_hat():
    """the events preview's Christmas artwork (events/art.js) is SnakeList's S wearing this same Santa hat: the hat is
    written into art.js between its /*XM-HAT*/ markers, so both previews always show the same hat"""
    p = os.path.join("events", "art.js")
    if not os.path.isfile(p): return
    s = open(p, encoding="utf-8").read()
    h = art.LOGO_HAT
    hat = art.hat_at(h["cx"], h["cy"], h["width"], h["angle"], prefix="evh")
    s2 = re.sub(r"/\*XM-HAT\*/.*?/\*/XM-HAT\*/", lambda m: "/*XM-HAT*/" + json.dumps(hat) + "/*/XM-HAT*/", s, count=1, flags=re.S)
    if s2 != s: open(p, "w", encoding="utf-8").write(s2)

def page_logo(variant, hat, ssnow):
    """the SnakeList pages' header logo (species/logo-light.svg, logo-dark.svg) dressed the same way: the hat on the
    snake's head, snow on the S and on the letters, the stocking with presents in place of the tick. The letters'
    tops are measured by drawing them (the logo's own font) with Chromium; the saved file is kept without it."""
    src = os.path.join("species", "logo-%s.svg" % variant)
    out_saved = os.path.join(SRC_THEME, "xmas-logo-%s.svg" % variant)
    try:
        s = open(src, encoding="utf-8").read()
        from PIL import Image
        m = re.search(r'<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"', s); W, H = float(m.group(1)), float(m.group(2))
        t0, t1 = s.find("<text"), s.find("</text>") + 7
        txt = re.sub(r'\sfill="[^"]*"', "", s[t0:t1]).replace("<text", '<text fill="#000"', 1)
        only = s[:s.find("</defs>") + 7] + txt + "</svg>"
        with tempfile.TemporaryDirectory() as td:
            sv, png = os.path.join(td, "t.svg"), os.path.join(td, "t.png")
            open(sv, "w", encoding="utf-8").write(only)
            subprocess.run(["node", os.path.join("tools", "christmas-icons.js"), "--render", sv, png, "4", str(int(round(W))), str(int(round(H)))], check=True, timeout=120, capture_output=True)
            im = Image.open(png).split()[-1]; px = im.load(); tops = []
            for cx in range(0, im.width, 2):
                t = None
                for cy in range(im.height):
                    if px[cx, cy] > 140: t = cy / 4.0; break
                tops.append(t)
        snow = art.snow_cap(tops, 0, 0.5, 6.5, seed=3)
        s = s[:t1] + '<path d="%s" fill="#fff"/>' % snow + s[t1:]
        i = s.find('<g class="snake-head"'); j = s.find("</g>", i)
        s = s[:j] + hat + s[j:]
        k = s.find("</svg>", s.find('viewBox="-23.5'))
        s = s[:k] + '<path d="%s" fill="#fff"/>' % ssnow + s[k:]
        a = s.find('viewBox="5.6 0.3 36.9 36.0"'); a = s.find(">", a) + 1; b = s.find("</svg>", a)
        s = s[:a] + logo_stocking(variant) + s[b:]
        open(out_saved, "w", encoding="utf-8").write(s)
    except Exception as e:
        print("note: the pages' %s logo was not redrawn (%s); the saved one is used" % (variant, e.__class__.__name__))
        restock(out_saved, logo_stocking(variant))
        rehat(out_saved)
    if os.path.isfile(out_saved): shutil.copy2(out_saved, posixpath.join(OUT, "xmas-logo-%s.svg" % variant))

def rehat(path):
    """the saved logo keeps the same hat drawing; only where it sits follows art.LOGO_HAT (the hat's own transform)"""
    if not os.path.isfile(path): return
    s = open(path, encoding="utf-8").read(); h = art.LOGO_HAT; k = h["width"] / 100.0
    t = "translate(%s %s) rotate(%s) scale(%.4f %.4f)" % (art._f1(h["cx"]), art._f1(h["cy"]), art._f1(h["angle"]), k, k)
    s2 = re.sub(r"translate\([-\d. ]+\) rotate\([-\d.]+\) scale\([\d.]+ [\d.]+\)(?=\"><defs><linearGradient id=\"xmh)", t, s, count=1)
    if s2 != s: open(path, "w", encoding="utf-8").write(s2)

def logo_stocking(variant):
    """the saved logo files lose their tick drawing to the stocking group, so the group draws the tick too (in the
    wordmark's green) with the stocking hanging from it"""
    return art.stocking_tick(p="xms%s" % variant[0], tick="#4c9d3f" if variant == "light" else "#63b84f")

def restock(path, stocking):
    """the saved pages' logo keeps up with the current stocking even when it cannot be redrawn: its <g class="xm-stk">
    (found with its matching </g>) is swapped for the current drawing"""
    if not os.path.isfile(path): return
    s = open(path, encoding="utf-8").read()
    a = s.find('<g class="xm-stk">')
    if a < 0: return
    depth, i = 0, a
    for m in re.finditer(r"<g[\s>]|</g>", s[a:]):
        depth += -1 if m.group(0) == "</g>" else 1
        if depth == 0: i = a + m.end(); break
    else: return
    if s[a:i] != stocking: open(path, "w", encoding="utf-8").write(s[:a] + stocking + s[i:])

def render_cabin():
    """the cabin's room: drawn by christmas_art.cabin_svg, rendered with Chromium, saved as WebP (the saved one is
    used when Node + Playwright are not here - the drawing is deterministic, so it matches the layout data)"""
    saved = os.path.join(SRC_THEME, "xmas-cabin.webp")
    try:
        from PIL import Image
        with tempfile.TemporaryDirectory() as td:
            sv, png = os.path.join(td, "cabin.svg"), os.path.join(td, "cabin.png")
            open(sv, "w").write(art.cabin_svg())
            subprocess.run(["node", os.path.join("tools", "christmas-icons.js"), "--cabin", sv, png], check=True, timeout=240, capture_output=True)
            Image.open(png).convert("RGB").save(saved, "WEBP", quality=80, method=6)
    except Exception as e:
        print("note: the cabin picture was not redrawn (%s); the saved one is used" % e.__class__.__name__)
    if os.path.isfile(saved): shutil.copy2(saved, posixpath.join(OUT, "xmas-cabin.webp"))

def main():
    t0 = time.time()
    # christmas/music/ (the songs, kept only there - they are not drawn by this script) stays; the rest is rebuilt
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f == "music": continue
        q = os.path.join(OUT, f)
        shutil.rmtree(q) if os.path.isdir(q) else os.remove(q)
    for f in sorted(os.listdir(SRC_THEME)):
        if f in ("xmas.js", "xmas.css", "cabin.js", "cabin.css", "photo-hats.json", "xmas-cabin.webp") or f.endswith(".png") or f.startswith("xmas-logo-"): continue
        shutil.copy2(os.path.join(SRC_THEME, f), os.path.join(OUT, f))
    write_art()
    events_hat()
    render_cabin()
    h = art.LOGO_HAT; fav = open("favicon.svg", encoding="utf-8").read()
    for v in ("light", "dark"): page_logo(v, art.hat_at(h["cx"], h["cy"], h["width"], h["angle"]).replace("xmh-", "xmh%s-" % v[0]), art.logo_snow(body_path(fav)))
    open(posixpath.join(OUT, "index.html"), "w", encoding="utf-8").write(INDEX)
    try:
        subprocess.run(["node", os.path.join("tools", "christmas-icons.js")], check=True, timeout=180, capture_output=True)
    except Exception:
        print("note: the PNG icons were not redrawn (needs node + playwright); the saved ones are used")
    for f in os.listdir(SRC_THEME):
        if f.endswith(".png"): shutil.copy2(os.path.join(SRC_THEME, f), os.path.join(OUT, f))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print("christmas/: %d files, %.0f KB, %.1fs" % (len(os.listdir(OUT)), size / 1024, time.time() - t0))

if __name__ == "__main__":
    main()
