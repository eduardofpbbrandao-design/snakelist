"""SnakeList logo round 2 – generator. Builds the snake S for CURRENT / A / B (full + small),
the unchanged rattlesnake tick, a harness HTML for rendering, and standalone SVG files."""
import re, math, json, os

W = os.path.dirname(os.path.abspath(__file__)) + '/'
G = open(W + 'mark-snake-inner.svg').read()
BODY_D = re.search(r'<path class="snake-body"[^>]* d="([^"]+)"', G).group(1)
BLOTCHES = [(float(x), float(y), float(r), d) for x, y, r, d in
            re.findall(r'<g transform="translate\(([\d.]+) ([\d.]+)\) rotate\(([-\d.]+)\)"><path d="([^"]+)"', G)]
HEAD_D = re.search(r'<g transform="translate\(88\.0 34\.0\) rotate\(6\)"><path d="([^"]+)"', G).group(1)
TICK = open(W + 'tick.svg').read()

VARIANTS = {
    # current, rebuilt from the live source for reference (identical look)
    'cur': dict(snake='#58b351', eye='#1b412b', pat_rgba='rgba(26,65,43,0.51)', group=False, bscale=1.0,
                hscale=1.0, hpivot=0, eye_r=4.26, eye_xy=(9.0, -7.0), hl=0, rim=0, tongue=True,
                vb=(-23.5, 2.0, 144.7, 145.5)),
    'A': dict(snake='#5bb853', eye='#163a24', pat='#1a412b', pat_op=0.58, group=True, bscale=0.87,
              hscale=1.10, hpivot=-24, eye_r=5.0, eye_xy=(9.6, -6.6), hl=1.2, rim=1.6, rim_op=0.55, tongue=True,
              vb=(-23.5, 2.0, 153.0, 145.5)),
    'B': dict(snake='#5fbf56', eye='#123320', pat='#173d27', pat_op=0.68, group=True, bscale=0.93,
              hscale=1.18, hpivot=-24, eye_r=5.8, eye_xy=(9.8, -6.4), hl=1.45, rim=2.2, rim_op=0.7, tongue=True, long_tongue=True,
              vb=(-23.5, 2.0, 162.5, 145.5)),
}
# small-size versions (favicon / <=48px): same art, fewer + bolder details
SMALL = {
    'A': dict(VARIANTS['A'], bscale=0.98, pat_op=0.66, eye_r=6.4, hl=0, rim=2.6, rim_op=0.6, tongue=False, hscale=1.16, drop=3),
    'B': dict(VARIANTS['B'], bscale=1.02, pat_op=0.74, eye_r=7.2, hl=0, rim=3.0, rim_op=0.75, tongue=False, hscale=1.26, drop=3),
}

# 16-32px browser-tab sizes: fewer, softer spots and an oversized eye so the snake + eye still read
TINY = {
    'A': dict(SMALL['A'], bscale=1.0, pat_op=0.5, eye_r=8.6, rim=3.2, rim_op=0.7, hscale=1.28, drop=4),
    'B': dict(SMALL['B'], bscale=1.0, pat_op=0.55, eye_r=9.2, rim=3.4, rim_op=0.8, hscale=1.34, drop=4),
}


def snake_inner(v, uid, colors_as_vars=True):
    sn = f"var(--sl-snake, {v['snake']})" if colors_as_vars else v['snake']
    ey = f"var(--sl-eye, {v['eye']})" if colors_as_vars else v['eye']
    out = [f'<defs><clipPath id="{uid}-clip"><path d="{BODY_D}"/></clipPath></defs>']
    out.append(f'<path class="snake-body" fill="{sn}" d="{BODY_D}"/>')
    bl = BLOTCHES
    if v.get('drop'):  # drop the smallest tail spots at tiny sizes
        bl = sorted(BLOTCHES, key=lambda b: -float(re.search(r'-([\d.]+) C', b[3]).group(1)))[:len(BLOTCHES) - v['drop']]
    k = v['bscale']
    sc = f' scale({k})' if k != 1 else ''
    spots = ''.join(f'<g transform="translate({x} {y}) rotate({r}){sc}"><path d="{d}"/></g>' for x, y, r, d in bl)
    if v['group']:
        pat = f"var(--sl-pat-solid, {v['pat']})" if colors_as_vars else v['pat']
        out.append(f'<g clip-path="url(#{uid}-clip)"><g fill="{pat}" opacity="{v["pat_op"]}">{spots}</g></g>')
    else:
        pat = f"var(--sl-pat, {v['pat_rgba']})" if colors_as_vars else v['pat_rgba']
        out.append(f'<g clip-path="url(#{uid}-clip)"><g fill="{pat}">{spots}</g></g>')
    hs, pv = v['hscale'], v['hpivot']
    htr = f'translate(88.0 34.0) rotate(6)'
    if hs != 1:
        htr += f' translate({pv} 0) scale({hs}) translate({-pv} 0)'
    h = [f'<g class="snake-head" transform="{htr}">']
    if v['rim']:  # a thin dark edge where the head lies over the coil, so it reads as a head, not a blob
        out.append(f'<g clip-path="url(#{uid}-clip)"><g transform="{htr}"><path d="{HEAD_D}" fill="none" stroke="{ey}" stroke-opacity="{v["rim_op"]}" stroke-width="{v["rim"] * 2 / hs:.2f}"/></g></g>')
    h.append(f'<path d="{HEAD_D}" fill="{sn}"/>')
    ex, eyy = v['eye_xy']
    h.append(f'<circle cx="{ex}" cy="{eyy}" r="{v["eye_r"] / hs if hs != 1 and v is not VARIANTS["cur"] else v["eye_r"]:.2f}" fill="{ey}"/>')
    if v['hl']:
        er = v['eye_r'] / hs
        h.append(f'<circle cx="{ex + er * 0.38:.2f}" cy="{eyy - er * 0.38:.2f}" r="{v["hl"] / hs:.2f}" fill="#fff" fill-opacity="0.9"/>')
    if v['tongue']:
        if v.get('long_tongue'):  # B (round 2c): ~35% longer, fork a touch wider
            h.append(f'<path d="M24.6 2.2 L33.2 3.9" fill="none" stroke="{sn}" stroke-width="2.2" stroke-linecap="round"/>'
                     f'<path d="M33.2 3.9 L38.4 1.3" fill="none" stroke="{sn}" stroke-width="1.8" stroke-linecap="round"/>'
                     f'<path d="M33.2 3.9 L38.4 7.3" fill="none" stroke="{sn}" stroke-width="1.8" stroke-linecap="round"/>')
        else:
            h.append(f'<path d="M24.6 2.2 L30.8 3.6" fill="none" stroke="{sn}" stroke-width="2.2" stroke-linecap="round"/>'
                     f'<path d="M30.8 3.6 L34.8 2.2" fill="none" stroke="{sn}" stroke-width="1.8" stroke-linecap="round"/>'
                     f'<path d="M30.8 3.6 L34.8 6.2" fill="none" stroke="{sn}" stroke-width="1.8" stroke-linecap="round"/>')
    h.append('</g>')
    out.append(''.join(h))
    return ''.join(out)


def vbstr(vb):
    return ' '.join(f'{n:g}' for n in vb)


def snake_svg(name, small=False, size=None, uid=None):
    v = (SMALL if small else VARIANTS)[name]
    uid = uid or f's{name}{"sm" if small else ""}'
    wh = f' width="{size}" height="{size}"' if size else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vbstr(v["vb"])}"{wh}>{snake_inner(v, uid)}</svg>'


def tick_svg(uid):
    t = TICK.replace('tick-clip-head', f'{uid}-tclip')
    return t.replace('<svg class="sl-tick"', '<svg xmlns="http://www.w3.org/2000/svg" class="sl-tick"')


if __name__ == '__main__':
    for n in VARIANTS:
        open(W + f'snake-{n}.svg', 'w').write(snake_svg(n))
    for n in SMALL:
        open(W + f'snake-{n}-small.svg', 'w').write(snake_svg(n, True))
    print('ok')
