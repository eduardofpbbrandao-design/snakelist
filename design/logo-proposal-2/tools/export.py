"""Standalone wordmark SVGs (font embedded) composed from positions measured in the HTML harness."""
import os, sys, json, re, math, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import VARIANTS, SMALL, snake_inner, vbstr, snake_svg, TICK, W
from harness import STYLE, DARK_GRAD, LIST_GRAD

OUT = os.path.abspath(W + '../logo') + '/'
M = json.load(open(W + 'metrics.json'))
FONT = open(W + 'slmark-fontface.css').read()
SH = {'light': [(1, 1, 0.22), (3, 8, 0.16)], 'dark': [(1, 2, 0.45), (4, 12, 0.30)]}


def stops(grad):
    return re.findall(r'(#[0-9a-f]{6}) (\d+)%', grad)


def tick_inner(uid):
    t = TICK.replace('tick-clip-head', f'{uid}-tc')
    return re.sub(r'^<svg[^>]*>|</svg>$', '', t)


def wordmark(n, th):
    m = M[f'exp-{n}-{th}']
    pad = 18
    Wd, Hd = m['mark']['w'] + 2 * pad, 100 + 2 * pad
    tt = m['tt']
    cx, cy = pad + tt['x'] + 0.3 * tt['w'], pad + tt['y'] + 0.4 * tt['h']
    r = math.hypot(0.7 * tt['w'], 0.6 * tt['h'])
    grad = DARK_GRAD[n] if th == 'dark' else STYLE[n]['grad']
    st = ''.join(f'<stop offset="{o}%" stop-color="{c}"/>' for c, o in stops(grad))
    sh = ''.join(f'<feDropShadow dx="0" dy="{dy}" stdDeviation="{b / 2}" flood-color="#000" flood-opacity="{a}"/>' for dy, b, a in SH[th])
    v = VARIANTS[n]
    s, tk = m['snake'], m['tick']
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wd:.1f} {Hd:.1f}" width="{Wd:.0f}" height="{Hd:.0f}" role="img" aria-label="SnakeList">',
           f'<title>SnakeList</title><defs><style>{FONT}</style>',
           f'<radialGradient id="wg" gradientUnits="userSpaceOnUse" cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}">{st}</radialGradient>',
           (f'<radialGradient id="lg" gradientUnits="userSpaceOnUse" cx="{pad + m["list"]["x"] + 0.3 * m["list"]["w"]:.1f}" cy="{pad + m["list"]["y"] + 0.4 * m["list"]["h"]:.1f}" r="{math.hypot(0.7 * m["list"]["w"], 0.6 * m["list"]["h"]):.1f}">'
            + ''.join(f'<stop offset="{o}%" stop-color="{c}"/>' for c, o in stops(LIST_GRAD[n])) + '</radialGradient>' if th == 'dark' else ''),
           f'<filter id="ws" x="-10%" y="-20%" width="120%" height="150%">{sh}</filter></defs>',
           f'<g filter="url(#ws)">',
           f'<svg x="{pad + s["x"]:.2f}" y="{pad + s["y"]:.2f}" width="{s["w"]:.2f}" height="{s["h"]:.2f}" viewBox="{vbstr(v["vb"])}" overflow="visible">{snake_inner(v, "w" + n, colors_as_vars=False)}</svg>',
           f'<text x="{pad + m["nake"]["x"]:.2f}" y="{pad + m["base"]:.2f}" font-family="\'SL Mark\', \'EB Garamond\', Garamond, serif" font-size="100" font-weight="600" letter-spacing="1" fill="url(#wg)">nake<tspan font-weight="500"{' fill="url(#lg)"' if th == 'dark' else ''}>List</tspan></text>',
           '</g>',
           f'<svg x="{pad + tk["x"]:.2f}" y="{pad + tk["y"]:.2f}" width="{tk["w"]:.2f}" height="{tk["h"]:.2f}" viewBox="5.6 0.3 36.9 36.0" overflow="visible">{tick_inner("w" + n)}</svg>',
           '</svg>']
    return ''.join(out)


if __name__ == '__main__':
    for n in ['A', 'B']:
        for th in ['light', 'dark']:
            open(OUT + f'snakelist-logo-{n}-{th}.svg', 'w').write(wordmark(n, th))
        open(OUT + f'snake-s-{n}.svg', 'w').write(snake_svg(n))
        open(OUT + f'snake-s-{n}-small.svg', 'w').write(snake_svg(n, True))
    print('ok')
