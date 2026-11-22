"""Builds harness.html: the wordmark rendered exactly the way the site's CSS does it,
for CURRENT / A / B, in light + dark, at several sizes. Each block has an id for screenshots."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import VARIANTS, SMALL, snake_inner, vbstr, tick_svg, W

FONT = open(W + 'slmark-fontface.css').read()

STYLE = {
    'cur': dict(grad='radial-gradient(circle at 30% 40%, #96dd78 0%, #6fc255 0%, #57ab45 32%, #38802a 100%)',
                sh=0.71, smr=-0.003, tml=0.071, tty=0.02, th=0.70),
    'A': dict(grad='radial-gradient(circle at 30% 40%, #8fd672 0%, #66b94e 0%, #4f9f3f 32%, #2f7426 100%)',
              sh=0.75, smr=-0.012, tml=0.12, tty=0.02, th=0.62),
    'B': dict(grad='radial-gradient(circle at 30% 40%, #84cc69 0%, #5bab46 0%, #45923a 32%, #276522 100%)',
              sh=0.79, smr=-0.0021, tml=0.135, tty=0.02, th=0.63),
}
DARK_GRAD = {  # dark theme keeps today's brighter sweep so the name never sinks into the green page
    'cur': STYLE['cur']['grad'],
    'A': STYLE['cur']['grad'],
    'B': 'radial-gradient(circle at 30% 40%, #9ce27e 0%, #74c75a 0%, #5bb048 32%, #3c862d 100%)',
}
HERO_GRAD = {  # the hero uses a brighter sweep on the dark photo
    'cur': 'radial-gradient(circle at 30% 40%, #b4ec98 0%, #8fd873 30%, #6cc052 62%, #4f9e3d 100%)',
    'A': 'radial-gradient(circle at 30% 40%, #b0ea93 0%, #8ad56e 30%, #66bb4d 62%, #489638 100%)',
    'B': 'radial-gradient(circle at 30% 40%, #aae68d 0%, #84d068 30%, #5fb447 62%, #418d33 100%)',
}

# round 2b: on dark grounds (dark theme, opening photo) "List" gets its own brighter sweep so it no longer
# fades into the dark end of the word's gradient. Light mode keeps the deep forest green.
LIST_GRAD = {
    'cur': None,
    'A': 'radial-gradient(circle at 30% 40%, #74c85a 0%, #62b84d 45%, #53a744 100%)',
    'B': 'radial-gradient(circle at 30% 40%, #7acb5f 0%, #68bd51 45%, #58ad46 100%)',
}

uid_n = [0]


def logo(name, small=False, hero=False):
    uid_n[0] += 1
    u = f'u{uid_n[0]}'
    v = (SMALL if small else VARIANTS)[name]
    st = STYLE[name]
    s = (f'<span class="mark m-{name}{" hero" if hero else ""}"><span class="tt"><svg class="snake-s" viewBox="{vbstr(v["vb"])}" aria-hidden="true">'
         f'{snake_inner(v, u)}</svg>nake<em>List</em></span>{tick_svg(u)}</span>')
    return s


def css():
    c = [FONT, """
html,body{margin:0;padding:0}
body{font-family:system-ui,sans-serif}
.cell{display:inline-block;padding:18px 22px;vertical-align:top}
.light{background:linear-gradient(180deg,#eef1e2 0%,#dcead0 100%);--mark-shadow:drop-shadow(0 1px 1px rgba(0,0,0,0.22)) drop-shadow(0 3px 8px rgba(0,0,0,0.16))}
.dark{background:#1F5A3A;--mark-shadow:drop-shadow(0 1px 2px rgba(0,0,0,0.45)) drop-shadow(0 4px 12px rgba(0,0,0,0.30))}
.herobg{background:radial-gradient(ellipse at 60% 40%,#2c3a1c 0%,#0f1a0c 70%);--mark-shadow:drop-shadow(0 1px 2px rgba(0,0,0,0.6)) drop-shadow(0 5px 20px rgba(0,0,0,0.5))}
.mark{display:inline-flex;align-items:baseline;white-space:nowrap;line-height:1}
.tt{font-family:'SL Mark','EB Garamond',serif;font-weight:600;letter-spacing:0.010em;color:#9fe08a;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:var(--mark-shadow)}
.tt em{font-style:normal;font-weight:500}
.snake-s{width:auto;vertical-align:baseline;overflow:visible}
.sl-tick{flex-shrink:0;width:auto}
.herobg .sl-tick{filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))}
"""]
    for n, st in STYLE.items():
        c.append(f".m-{n} .tt{{background-image:{st['grad']}}} .dark .m-{n} .tt{{background-image:{DARK_GRAD[n]}}} .m-{n}.hero .tt{{background-image:{HERO_GRAD[n]}}}"
                 f".m-{n} .snake-s{{height:{st['sh']}em;margin-right:{st['smr']}em}}"
                 f".m-{n} .sl-tick{{height:{st['th']}em;margin-left:{st['tml']}em;transform:translateY({st['tty']}em)}}")
        if LIST_GRAD[n]:
            c.append(f".dark .m-{n} .tt em,.herobg .m-{n} .tt em{{background-image:{LIST_GRAD[n]};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}}")
    return '\n'.join(c)


def build():
    parts = [f'<!doctype html><html><head><meta charset="utf-8"><style>{css()}</style></head><body>']
    for n in ['cur', 'A', 'B']:
        for th in ['light', 'dark']:
            for fs, tag in [(66, 'desk'), (42, 'phone'), (24, 'small')]:
                small = fs <= 24 and n != 'cur'
                parts.append(f'<div class="cell {th}" id="{n}-{th}-{tag}" style="font-size:{fs}px">{logo(n, small)}</div>')
        parts.append(f'<div class="cell herobg" id="{n}-hero" style="font-size:120px;padding:40px 60px">{logo(n, hero=True)}</div>')
        parts.append(f'<div class="cell light" id="{n}-xl" style="font-size:200px;padding:30px 40px">{logo(n)}</div>')
        for th in ['light', 'dark']:
            parts.append(f'<div class="cell {th} exp" id="exp-{n}-{th}" style="font-size:100px;padding:0">{logo(n)}</div>')
    parts.append('</body></html>')
    open(W + 'harness.html', 'w').write(''.join(parts))


if __name__ == '__main__':
    build()
    jobs = []
    for n in ['cur', 'A', 'B']:
        for th in ['light', 'dark']:
            for tag in ['desk', 'phone', 'small']:
                for dpr in [1, 2]:
                    jobs.append(dict(html=W + 'harness.html', sel=f'#{n}-{th}-{tag}', out=W + f'out/wm-{n}-{th}-{tag}@{dpr}x.png', w=1400, h=900, dpr=dpr, bg='x'))
        jobs.append(dict(html=W + 'harness.html', sel=f'#{n}-hero', out=W + f'out/wm-{n}-hero@2x.png', w=1400, h=900, dpr=2, bg='x'))
        jobs.append(dict(html=W + 'harness.html', sel=f'#{n}-xl', out=W + f'out/wm-{n}-xl.png', w=1600, h=900, dpr=1, bg='x'))
    os.makedirs(W + 'out', exist_ok=True)
    json.dump(jobs, open(W + 'jobs-wm.json', 'w')) if False else None
    import json as _j
    _j.dump(jobs, open(W + 'jobs-wm.json', 'w'))
    print(len(jobs), 'jobs')
