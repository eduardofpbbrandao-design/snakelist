"""Build the Christmas preview of the whole SnakeList website into christmas/.

    python3 tools/build-christmas.py

Reads the built site as it is now (index.html, snakelist-synced.html, the about / install /
privacy / terms pages and every generated page under species/) and writes a themed copy of
each page to christmas/<same path>. Nothing outside christmas/ is ever written, so the live
site does not change; run it again after the site changes and the preview follows.

How the copy works
  * Pages are copied (so every link between pages stays inside the preview), but nothing
    else is: every relative URL in a page that points at a file that is not a page (photos,
    data/, the 3D viewer, scripts, styles, icons...) is rewritten to point at the live file,
    e.g. "species-photos/t/1-2.webp" in index.html becomes "../species-photos/t/1-2.webp".
    URLs are only rewritten when they resolve to a file or folder that exists, so ordinary
    text is never touched. A small script (XM_EARLY below) does the same at run time for
    fetch(), XMLHttpRequest and src/srcset set by scripts, as a safety net.
  * Each page gets the theme (christmas/xmas.css + christmas/xmas.js), the Christmas icons,
    <meta name="robots" content="noindex">, "Christmas preview" in its title and a small
    "Christmas preview" pill. Preview pages are never listed in sitemap.xml.
  * The preview registers no service worker, loads no visitor statistics and installs no
    web-app manifest. It shares the live site's saved lists (same browser storage, same app
    code); its own settings use keys starting with "sl-xmas-".

The theme's own files live in tools/christmas/ (xmas.css, xmas.js, the SVG/PNG icons and
CREDITS.txt) and are copied into christmas/ unchanged.
"""
import os, re, sys, json, shutil, posixpath, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import christmas_art as art

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_THEME = os.path.join(HERE, "christmas")
OUT = "christmas"                      # relative to ROOT
ROOT_PAGES = ["index.html", "snakelist-synced.html", "about.html", "about-snakelist.html",
              "install.html", "privacy.html", "terms.html"]
PAGE_DIRS = ["species"]                # every .html under these
SKIP_TOP = {".git", ".claude", OUT, "node_modules", "tests", "tools", "docs"}

os.chdir(ROOT)

# ---- what exists on the live site -------------------------------------------------------
FILES, DIRS = set(), {""}
CHILDREN = {}                          # dir -> names in it
for top in sorted(os.listdir(".")):
    if top in SKIP_TOP or top.startswith("."): continue
    if os.path.isfile(top):
        FILES.add(top); CHILDREN.setdefault("", []).append(top); continue
    CHILDREN.setdefault("", []).append(top)
    for d, sub, fs in os.walk(top):
        d = d.replace(os.sep, "/")
        DIRS.add(d)
        CHILDREN.setdefault(d, []).extend(sub + fs)
        for f in fs: FILES.add(d + "/" + f)

def is_page_file(p): return p.endswith(".html")
def is_page_dir(d): return (d + "/index.html" if d else "index.html") in FILES

def classify(res):
    """'page' / 'asset' / None (unknown, leave alone) for a site-relative path"""
    if res in ("", "."): return "page"
    if res in FILES: return "page" if is_page_file(res) else "asset"
    if res in DIRS: return "page" if is_page_dir(res) else "asset"
    if res + ".html" in FILES: return "page"
    # the start of a file name, finished by a script ("species-photos/p" + n + ".jpg")
    parent, base = posixpath.split(res)
    if parent in DIRS and base:
        names = [n for n in CHILDREN.get(parent, []) if n.startswith(base)]
        if names and all(not n.endswith(".html") and not is_page_dir(posixpath.join(parent, n)) for n in names[:200]):
            return "asset"
    return None

URL_RX = re.compile(r"""(?P<pre>["'`(=]|,\s?)(?P<url>(?:\./|(?:\.\./)+)?[A-Za-z0-9_][A-Za-z0-9_.\-]*(?:/[A-Za-z0-9_.\-%]*)*)(?P<tail>[?#][^"'`)\s,<>]*)?""")
STATS = {"rewritten": 0}

def rewrite_urls(text, page_dir, out_dir):
    def sub(m):
        url = m.group("url")
        if "/" not in url and not re.search(r"\.[A-Za-z0-9]{1,12}$", url): return m.group(0)
        if url.startswith("//"): return m.group(0)
        res = posixpath.normpath(posixpath.join(page_dir, url)) if url not in (".", "./") else page_dir
        if res == ".": res = ""
        if res.startswith(".."): return m.group(0)
        kind = classify(res.rstrip("/"))
        if kind != "asset": return m.group(0)
        new = posixpath.relpath(res, out_dir) + ("/" if url.endswith("/") and not res.endswith("/") else "")
        STATS["rewritten"] += 1
        return m.group("pre") + new + (m.group("tail") or "")
    return URL_RX.sub(sub, text)

# ---- the theme's head snippet -------------------------------------------------------------
# Runs before any of the page's own scripts: marks the page as the Christmas preview and maps
# any URL a script builds that lands inside christmas/ but is not a page back to the live file.
XM_EARLY = r"""<script>(function(){var d=document.documentElement;d.classList.add('xm',%(kind)r);window.XM={root:new URL(%(root)r,location.href).href,kind:%(kind)r};
var R=new URL(XM.root),P=R.pathname;function page(p){return /\/xmas[^\/]*$/.test(p)||/\/$/.test(p)||/\.html?$/i.test(p)||!/\.[A-Za-z0-9]{1,12}$/.test(p.split('/').pop())}
function map(u){try{var x=new URL(String(u),document.baseURI);if(x.origin!==R.origin||x.pathname.indexOf(P)!==0||page(x.pathname))return u;x.pathname=P.replace(/[^\/]+\/$/,'')+x.pathname.slice(P.length);return x.href}catch(e){return u}}
function mapSet(s){return String(s).split(/,\s*/).map(function(c){var p=c.trim().split(/\s+/);p[0]=map(p[0]);return p.join(' ')}).join(', ')}XM.map=map;
var f=window.fetch;if(f)window.fetch=function(i,o){if(typeof i==='string'||i instanceof URL)i=map(i);return f.call(this,i,o)};
var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=map(u);return xo.apply(this,arguments)};
[['HTMLImageElement','src'],['HTMLImageElement','srcset',1],['HTMLScriptElement','src'],['HTMLSourceElement','src'],['HTMLSourceElement','srcset',1],['HTMLVideoElement','src'],['HTMLVideoElement','poster'],['HTMLLinkElement','href']].forEach(function(a){var C=window[a[0]];if(!C)return;var ds=Object.getOwnPropertyDescriptor(C.prototype,a[1]);if(!ds||!ds.set)return;Object.defineProperty(C.prototype,a[1],{configurable:true,enumerable:ds.enumerable,get:ds.get,set:function(v){ds.set.call(this,a[2]?mapSet(v):map(v))}})});
var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){var l=String(n).toLowerCase();if((l==='src'||l==='poster'||(l==='href'&&this.tagName==='LINK'))&&/^(IMG|SCRIPT|SOURCE|VIDEO|LINK|AUDIO)$/.test(this.tagName))v=map(v);else if((l==='srcset'||l==='imagesrcset')&&/^(IMG|SOURCE|LINK)$/.test(this.tagName))v=mapSet(v);return sa.call(this,n,v)};
XM.hat=function(){var g=document.getElementById('mark-snake');if(!g||g.querySelector('.xm-hat'))return;var e=null,cs=g.getElementsByTagName('circle');for(var i=0;i<cs.length;i++)if(/sl-eye/.test(cs[i].getAttribute('fill')||'')){e=cs[i];break}if(!e)return;
var h=e.parentNode,hp=h.getElementsByTagName('path')[0],k=1,y0=-16.5,n=hp&&(hp.getAttribute('d')||'').match(/-?\d*\.?\d+(?:e-?\d+)?/g)||[];if(n.length>5&&n.length%%2===0&&!/[AaHhVv]/.test(hp.getAttribute('d'))){var ys=[];for(i=1;i<n.length;i+=2)ys.push(+n[i]);y0=Math.min.apply(0,ys);k=(Math.max.apply(0,ys)-y0)/33||1}
var ex=+e.getAttribute('cx')||9,t=document.createElementNS('http://www.w3.org/2000/svg','g');t.setAttribute('transform','translate('+(ex-9*k).toFixed(2)+' '+(y0+16.5*k).toFixed(2)+') scale('+k.toFixed(3)+')');t.setAttribute('style','opacity:var(--xm-hat-o,1)');t.innerHTML=%(hat)s;h.appendChild(t)};
if(navigator.serviceWorker&&navigator.serviceWorker.register){try{navigator.serviceWorker.register=function(){return Promise.reject(new Error('The Christmas preview does not install the offline helper'))}}catch(e){}}
})();</script>"""

def head_snippet(kind, to_root, defer_js=True):
    return ('<meta name="robots" content="noindex,nofollow">'
            + XM_EARLY % {"kind": kind, "root": to_root or "./", "hat": json.dumps("<defs>" + art.HAT_DEFS + "</defs>" + art.HAT)}
            + '<link rel="stylesheet" href="%sxmas.css">' % to_root
            + ('<script src="%sxmas.js" defer></script>' % to_root if defer_js else ""))

ICONS = ('<link rel="icon" type="image/svg+xml" href="{r}xmas-icon.svg"><link rel="icon" type="image/png" sizes="48x48" href="{r}xmas-icon-48.png">'
         '<link rel="apple-touch-icon" href="{r}xmas-icon-180.png">')

def theme_page(src, html):
    depth = src.count("/")
    page_dir = posixpath.dirname(src)
    out_dir = posixpath.join(OUT, page_dir) if page_dir else OUT
    to_root = "../" * depth                       # from the page to christmas/
    kind = "xm-app" if src in ("index.html", "snakelist-synced.html") else ("xm-sp" if src.startswith("species/") else "xm-site")
    # the preview never installs the offline helper, never counts visits and never offers to install itself
    html = html.replace("navigator.serviceWorker.register(", "(function(){return Promise.reject(new Error('preview'))})(")
    html = re.sub(r'<script async src="https://www\.googletagmanager\.com/gtag/js[^"]*"></script>', "", html)
    html = re.sub(r'<link rel="manifest"[^>]*>', "", html)
    html = re.sub(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>', "", html)
    html = re.sub(r'<meta name="robots"[^>]*>', "", html)
    html = rewrite_urls(html, page_dir, out_dir)
    # the header logo of the generated pages: the Christmas app icon
    html = re.sub(r'(<a class="sl-brand"[^>]*><img src=")[^"]*(")', r"\g<1>%sxmas-icon.svg\2" % to_root, html)
    html = re.sub(r'(<a class="site-logo"[^>]*>\s*<img[^>]*?src=")[^"]*(")', r"\g<1>%sxmas-icon.svg\2" % to_root, html)
    # the app's own pictures of its icon (install sheet, sign-in): the Christmas icon
    html = re.sub(r'(<img\b[^>]*?src=")(?:\.\./)+app/icon-(?:192|512)-s\.png(")', r"\g<1>%sxmas-icon.svg\2" % to_root, html)
    html = re.sub(r"<title>([^<]*)</title>", lambda m: "<title>" + m.group(1) + " · Christmas preview</title>", html, count=1)
    # the hat goes on the logo snake the moment its drawing has arrived (before the opening shows it)
    i = html.find('id="mark-snake"')
    if i > 0:
        j = html.find("</svg>", i)
        if j > 0: html = html[:j + 6] + "<script>XM.hat()</script>" + html[j + 6:]
    # on the app, the cover's decorations are added as soon as the cover exists (not after the whole 7 MB page)
    early_js = False
    if kind == "xm-app":
        i = html.find('id="sl-hero"')
        j = html.find("</section>", i) if i > 0 else -1
        if j > 0:
            html = html[:j + 10] + '<script src="%sxmas.js"></script>' % to_root + html[j + 10:]
            early_js = True
    snippet = head_snippet(kind, to_root, not early_js) + ICONS.format(r=to_root)
    if re.match(r"\s*<!doctype", html, re.I) and "<head>" in html[:2000]:
        html = html.replace("<head>", "<head>" + snippet, 1)
        html = re.sub(r"<html\b([^>]*)>", lambda m: "<html" + (m.group(1).replace('class="', 'class="xm ') if 'class="' in m.group(1) else m.group(1) + ' class="xm ' + kind + '"') + ">", html, count=1)
    elif re.match(r"\s*<meta charset", html, re.I) or not re.match(r"\s*<!doctype", html, re.I):
        # snakelist-synced.html (the claude.ai app) has no <head>: the viewer adds it
        html = "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" + snippet + html
    else:
        html = snippet + html
    return html

def mark_inner(html):
    """the inside of the live logo's <g id="mark-snake">"""
    i = html.find('<g id="mark-snake">')
    if i < 0: return None
    depth, j = 0, i
    for m in re.finditer(r"<(/?)g\b[^>]*?(/?)>", html[i:]):
        if m.group(2): continue
        depth += -1 if m.group(1) else 1
        if depth == 0: j = i + m.end(); break
    return html[i + len('<g id="mark-snake">'):j - 4]

def hat_on(inner):
    """the Santa hat on the head group (the one holding the eye), placed as XM.hat() does in the page"""
    m = re.search(r'(<g transform="[^"]*">)(<path d="([^"]+)"[^>]*>(?:</path>)?)(<circle cx="([-\d.]+)" cy="[-\d.]+" r="[-\d.]+" fill="var\(--sl-eye)', inner)
    if not m: return inner
    nums = [float(v) for v in re.findall(r"-?\d*\.?\d+", m.group(3))]
    ys = nums[1::2]; y0 = min(ys); k = (max(ys) - y0) / 33 or 1; ex = float(m.group(5))
    end = inner.find("</g>", m.end())
    hat = '<g transform="translate(%.2f %.2f) scale(%.3f)">%s</g>' % (ex - 9 * k, y0 + 16.5 * k, k, art.HAT)
    return inner[:end] + hat + inner[end:]

def write_art():
    bulbs = {}
    for side in "lr":
        svg, bulbs[side] = art.corner(side)
        open(posixpath.join(OUT, "xmas-corner-%s.svg" % side), "w").write(svg)
    sprig = art.sprig()
    open(posixpath.join(OUT, "xmas-sprig.svg"), "w").write(sprig)
    js = "window.XM_ART=" + json.dumps({"bulbs": bulbs, "sprig": sprig}, separators=(",", ":")) + ";\n" + open(os.path.join(SRC_THEME, "xmas.js"), encoding="utf-8").read()
    open(posixpath.join(OUT, "xmas.js"), "w", encoding="utf-8").write(js)
    from urllib.parse import quote
    flake = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24"><g stroke="#B8913F" stroke-width="1.6" stroke-linecap="round" fill="none">'
             + "".join('<path d="M0 0V-10M0 -6.5L-2.6 -9M0 -6.5L2.6 -9" transform="rotate(%d)"/>' % a for a in range(0, 360, 60)) + "</g></svg>")
    css = open(os.path.join(SRC_THEME, "xmas.css"), encoding="utf-8").read()
    css += ("\n/* generated by tools/build-christmas.py: the sprig and snowflake used as heading accents */\nhtml.xm { --xm-sprig-url: url(\"data:image/svg+xml,%s\"); --xm-flake-url: url(\"data:image/svg+xml,%s\"); }\n"
            % (quote(art.mini_sprig(), safe=" =:/'.-"), quote(flake, safe=" =:/'.-")))
    open(posixpath.join(OUT, "xmas.css"), "w", encoding="utf-8").write(css)
    # the app icon: the live logo's snake S, in the hat, on evergreen
    inner = mark_inner(open("index.html", encoding="utf-8").read())
    if inner:
        inner = hat_on(inner)
        inner = re.sub(r"var\(--sl-snake, ?[^)]*\)", "#6cc85f", inner)
        inner = re.sub(r"var\(--sl-pat, ?(rgba\([^)]*\)|[^)]*)\)", "rgba(13,51,34,.55)", inner)
        inner = re.sub(r"var\(--sl-eye, ?[^)]*\)", "#0d3322", inner)
        inner = inner.replace('id="py-clip"', 'id="xm-py-clip"').replace("url(#py-clip)", "url(#xm-py-clip)")
        open(posixpath.join(OUT, "xmas-icon.svg"), "w").write(art.icon(inner))

def main():
    t0 = time.time()
    # --theme: only the theme files (xmas.css, xmas.js, artwork); --only a.html,b.html: just those pages too
    only = None
    if "--theme" in sys.argv: only = []
    if "--only" in sys.argv: only = sys.argv[sys.argv.index("--only") + 1].split(",")
    if only is None:
        if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)
    pages = [p for p in ROOT_PAGES if os.path.exists(p)] if only is None else [p for p in only if os.path.exists(p)]
    for d in (PAGE_DIRS if only is None else []):
        for dd, sub, fs in os.walk(d):
            sub.sort()
            for f in sorted(fs):
                if f.endswith(".html"): pages.append((dd.replace(os.sep, "/") + "/" + f))
    for src in pages:
        html = open(src, encoding="utf-8").read()
        out = posixpath.join(OUT, src)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(theme_page(src, html))
    for f in sorted(os.listdir(SRC_THEME)):
        if f in ("xmas.js", "xmas.css"): continue
        shutil.copy2(os.path.join(SRC_THEME, f), os.path.join(OUT, f))
    write_art()
    # the PNG icons (Safari's home-screen icon, small favicons) follow the SVG icon when Node + Playwright are here
    try:
        import subprocess
        subprocess.run(["node", os.path.join("tools", "christmas-icons.js")], check=True, timeout=180, capture_output=True)
        for f in os.listdir(SRC_THEME):
            if f.endswith(".png"): shutil.copy2(os.path.join(SRC_THEME, f), os.path.join(OUT, f))
    except Exception:
        print("note: the PNG icons were not redrawn (needs node + playwright); the saved ones are used")
    # GitHub Pages: no Jekyll processing needed for the preview folder (the site root decides), and
    # search engines are told by every page's own noindex tag
    print("christmas/: %d pages, %d URLs pointed at the live files, %.1fs" % (len(pages), STATS["rewritten"], time.time() - t0))

if __name__ == "__main__":
    main()
