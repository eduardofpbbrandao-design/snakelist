"""Builds logo-choice.html (self-contained, data: URIs) and sheet.html (for sheet.png)."""
import base64, os, struct

W = '/tmp/claude-0/-home-user-snakelist/0efffb05-b4c1-556b-aa06-7f7ade7de641/scratchpad/batch84/work/'
L = os.path.abspath(W + '../logo') + '/'
SITE, CUR, PNG, OUT = W + 'site/', L + 'current/', L + 'png/', W + 'out/'


def size(p):
    with open(p, 'rb') as f:
        h = f.read(24)
    return struct.unpack('>II', h[16:24])


def uri(p):
    return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()


def img(p, alt, scale=0.5, cls='', file_mode=False, w=None):
    iw, ih = size(p)
    dw = w or round(iw * scale)
    dh = round(ih * dw / iw)
    src = ('file://' + p) if file_mode else uri(p)
    c = f' class="{cls}"' if cls else ''
    return f'<img{c} src="{src}" width="{dw}" height="{dh}" alt="{alt}">'


OPT = {
    'cur': dict(title='Current logo', tag='What snakelist.com shows today', note='The live logo, screenshotted from the running site.'),
    'A': dict(title='Option A: light touch', tag='Closest to today', note=(
        'Same snake, same spots, same rattlesnake tick. The spots are cleaner and no longer blur into each other. '
        'The head is about 10% bigger, with a thin dark edge where it lies on the coil and a bigger eye with a tiny shine. '
        'The S is a little taller. The tick is about 12% smaller with more room before it, so the snake S leads. In light mode the name is a shade deeper green; on dark grounds (dark mode, opening photo) "List" is brighter so it stands out.')),
    'B': dict(title='Option B: bolder', tag='Stronger at small sizes', note=(
        'Everything in A, pushed further. The head is about 18% bigger with a clearer eye, and the forked tongue sticks out a bit further. The spots are a little darker, '
        'and the S is taller again. The tick is about 12% smaller, so the snake S leads. The name is a deeper forest green in light mode, "List" is brighter on dark grounds, and the app icon sits on SnakeList\'s own dark green.')),
}


def favs(n):
    if n == 'cur':
        return CUR + 'favicon-16.png', CUR + 'favicon-32.png', CUR + 'icon-512.png', CUR + 'icon-maskable-512.png', CUR + 'apple-touch-icon.png'
    return PNG + f'favicon-{n}-16.png', PNG + f'favicon-{n}-32.png', PNG + f'icon-512-{n}.png', PNG + f'icon-maskable-512-{n}.png', PNG + f'apple-touch-icon-{n}.png'


def tab(f32, theme):
    return (f'<div class="tabbar {theme}"><div class="tab"><img src="{uri(f32)}" width="16" height="16" alt="">'
            f'<span>SnakeList</span><span class="x">×</span></div></div>')


def option(n, letter):
    o = OPT[n]
    f16, f32, i512, mask, apple = favs(n)
    lab = {'cur': 'Current', 'A': 'A', 'B': 'B'}[n]
    h = [f'<section class="opt" id="opt-{n}"><div class="opt-h"><span class="badge b-{n}">{lab}</span><div><h2>{o["title"]}</h2><p class="tag">{o["tag"]}</p></div></div>',
         f'<p class="note">{o["note"]}</p>',
         '<h3>Header, computer</h3><div class="row2">',
         f'<figure>{img(SITE + f"header-{n}-light-desktop.png", lab + " header, light")}<figcaption>Light mode</figcaption></figure>',
         f'<figure>{img(SITE + f"header-{n}-dark-desktop.png", lab + " header, dark")}<figcaption>Dark mode</figcaption></figure></div>',
         '<h3>Header, phone</h3><div class="row2">',
         f'<figure>{img(SITE + f"header-{n}-light-phone.png", lab + " phone header, light")}<figcaption>Light mode</figcaption></figure>',
         f'<figure>{img(SITE + f"header-{n}-dark-phone.png", lab + " phone header, dark")}<figcaption>Dark mode</figcaption></figure></div>',
         '<h3>Small size (24px)</h3><div class="row2">',
         f'<figure>{img(OUT + f"wm-{n}-light-small@2x.png", lab + " small, light")}<figcaption>Light mode</figcaption></figure>',
         f'<figure>{img(OUT + f"wm-{n}-dark-small@2x.png", lab + " small, dark")}<figcaption>Dark mode</figcaption></figure></div>',
         '<h3>Opening screen</h3>',
         f'<figure class="hero">{img(SITE + f"hero-{n}-desktop.png", lab + " opening screen logo")}</figure>',
         '<h3>App icon and browser tab</h3><div class="icons">',
         f'<figure>{img(i512, lab + " app icon", w=96, cls="ic-any")}<figcaption>App icon</figcaption></figure>',
         f'<figure>{img(mask, lab + " maskable icon", w=96, cls="ic-mask")}<figcaption>Android round</figcaption></figure>',
         f'<figure>{img(apple, lab + " home screen icon", w=60, cls="ic-ios")}<figcaption>iPhone, 60px</figcaption></figure>',
         f'<figure><span class="zoom">{img(f16, lab + " 16px favicon", w=64, cls="px")}{img(f32, lab + " 32px favicon", w=64, cls="px")}</span><figcaption>Tab icon 16 and 32px, enlarged</figcaption></figure>',
         '</div>',
         f'<div class="tabs">{tab(f32, "tl")}{tab(f32, "td")}</div>',
         '</section>']
    return ''.join(h)


CSS = """
:root{--bg:#f2f5ea;--surface:#ffffff;--ink:#1d2a1a;--muted:#5a6656;--line:#d7e0cc;--accent:#3f7d43;--chip:#e6efdb;
 --cur:#6b7a66;--a:#3f7d43;--b:#1f5a3a;--shadow:0 1px 2px rgba(20,40,20,.06),0 6px 20px rgba(20,40,20,.06)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0e2117;--surface:#15301f;--ink:#e9f3e6;--muted:#a9c2a8;--line:#28503a;--accent:#9be07c;--chip:#1d3d2a;
 --cur:#8b9a86;--a:#58b351;--b:#9be07c;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)}}
:root[data-theme="dark"]{--bg:#0e2117;--surface:#15301f;--ink:#e9f3e6;--muted:#a9c2a8;--line:#28503a;--accent:#9be07c;--chip:#1d3d2a;
 --cur:#8b9a86;--a:#58b351;--b:#9be07c;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:28px 16px 56px}
h1{font-size:clamp(26px,5vw,36px);line-height:1.15;margin:0 0 8px;letter-spacing:-.01em}
.lede{color:var(--muted);max-width:62ch;margin:0 0 22px}
.same{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 28px;padding:0;list-style:none}
.same li{background:var(--chip);border-radius:999px;padding:5px 12px;font-size:14px}
.quick{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 36px}
.quick figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px;box-shadow:var(--shadow)}
.quick figcaption{font-weight:600;margin:0 0 6px;font-size:15px}
.quick img{width:100%;height:auto;display:block;border-radius:8px}
.quick .pair{display:grid;gap:6px}
.opt{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px clamp(14px,3vw,28px) 26px;margin:0 0 26px;box-shadow:var(--shadow)}
.opt-h{display:flex;gap:14px;align-items:center}
.badge{flex:none;min-width:44px;height:44px;padding:0 10px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:20px;color:#fff}
.b-cur{background:var(--cur);font-size:13px;letter-spacing:.02em}.b-A{background:var(--a)}.b-B{background:var(--b);color:var(--bg)}
h2{margin:0;font-size:22px;line-height:1.2}
.tag{margin:2px 0 0;color:var(--muted);font-size:14px}
.note{margin:14px 0 6px;max-width:70ch}
h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:22px 0 8px;font-weight:600}
figure{margin:0}
figcaption{font-size:13px;color:var(--muted);margin-top:4px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.row2 img,.hero img{max-width:100%;height:auto;display:block;border-radius:10px}
.icons{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-end}
.ic-any{border-radius:22%;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.ic-mask{border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.ic-ios{border-radius:22%;box-shadow:0 2px 6px rgba(0,0,0,.18)}
.zoom{display:flex;gap:8px}
.px{image-rendering:pixelated;border:1px solid var(--line);border-radius:4px}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
.tabbar{border-radius:10px 10px 0 0;padding:7px 8px 0;height:42px}
.tabbar.tl{background:#dfe3e8}.tabbar.td{background:#1f2023}
.tab{display:flex;align-items:center;gap:8px;height:35px;max-width:210px;padding:0 12px;border-radius:9px 9px 0 0;font:13px system-ui,sans-serif}
.tl .tab{background:#fff;color:#202124}.td .tab{background:#3c3d41;color:#e8eaed}
.tab img{flex:none}.tab .x{margin-left:auto;opacity:.6}
.close{margin:34px 0 0;font-size:18px;font-weight:600;text-align:center}
@media (max-width:700px){.quick{grid-template-columns:1fr}.row2{grid-template-columns:1fr}.tabs{grid-template-columns:1fr}}
"""


def build():
    p = ['<title>SnakeList Logo Choice</title>', f'<style>{CSS}</style>', '<div class="wrap">',
         '<h1>SnakeList logo: pick one</h1>',
         '<p class="lede">Two updates to the logo SnakeList has now. Both keep the snake S with its spots, the same greens and the rattlesnake tick. '
         'They make the snake a little bigger, give it a clearer head and eye, and clean up the spots. The tick is about 12% smaller with more room before it, and "List" is brighter on dark grounds. '
         'Everything below is a screenshot of the real site, the first row as it is today and then with each option.</p>',
         '<ul class="same"><li>Same snake S and spot pattern</li><li>Same green colours</li><li>Same rattlesnake tick (diamonds + rattle)</li><li>Same lettering</li></ul>',
         '<div class="quick">']
    for n, cap in [('cur', 'Current'), ('A', 'A: light touch'), ('B', 'B: bolder')]:
        p.append(f'<figure><figcaption>{cap}</figcaption><div class="pair">{img(SITE + f"header-{n}-light-desktop.png", cap + " light")}'
                 f'{img(SITE + f"header-{n}-dark-desktop.png", cap + " dark")}</div></figure>')
    p.append('</div>')
    for n in ['cur', 'A', 'B']:
        p.append(option(n, n))
    p.append('<p class="close">To choose, go back to the chat with Claude and type A, B or keep.</p></div>')
    open(L + 'logo-choice.html', 'w').write('\n'.join(p))

    # sheet.html (local file paths) for sheet.png
    rows = [('Header, light', lambda n: SITE + f'header-{n}-light-desktop.png'),
            ('Header, dark', lambda n: SITE + f'header-{n}-dark-desktop.png'),
            ('Phone, light', lambda n: SITE + f'header-{n}-light-phone.png'),
            ('Opening screen', lambda n: SITE + f'hero-{n}-desktop.png')]
    s = ['<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f2f5ea;font:15px system-ui,sans-serif;color:#1d2a1a}'
         'table{border-collapse:collapse;margin:16px}td,th{padding:8px;vertical-align:middle;text-align:left}th{font-size:18px}'
         'td.l{color:#5a6656;font-size:13px;width:90px}img{display:block}.ic{display:flex;gap:10px;align-items:flex-end}'
         '.ic img{border-radius:22%}.px{image-rendering:pixelated;border-radius:3px!important}</style></head><body><table id="sheet">',
         '<tr><th></th><th>Current</th><th>A: light touch</th><th>B: bolder</th></tr>']
    for lab, f in rows:
        s.append(f'<tr><td class="l">{lab}</td>' + ''.join(f'<td>{img(f(n), "", scale=0.5 if "hero" not in f(n) else 0.25, file_mode=True)}</td>' for n in ['cur', 'A', 'B']) + '</tr>')
    s.append('<tr><td class="l">Icons</td>')
    for n in ['cur', 'A', 'B']:
        f16, f32, i512, mask, apple = favs(n)
        s.append(f'<td><div class="ic"><img src="file://{i512}" width="96" height="96"><img src="file://{mask}" width="72" height="72" style="border-radius:50%">'
                 f'<img src="file://{f32}" width="32" height="32"><img src="file://{f16}" width="16" height="16"><img class="px" src="file://{f16}" width="48" height="48"></div></td>')
    s.append('</tr></table></body></html>')
    open(W + 'sheet.html', 'w').write(''.join(s))


if __name__ == '__main__':
    build()
    print(os.path.getsize(L + 'logo-choice.html'))
