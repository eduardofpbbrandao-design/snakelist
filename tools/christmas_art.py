"""Artwork for the Christmas preview, drawn as SVG by code (no outside images, so nothing to license).

  corner(side)   pine branches for an upper corner of the opening cover, with a string of
                 warm-white fairy lights and a few red and gold baubles
  sprig()        the small pine sprig with two berries that sits at the end of the wordmark
  HAT, hat_at()  the Santa hat (logo snake, the cover photo's snake, the species icons)
  STOCKING       the Christmas stocking with presents that takes the tick's place in the logo
  logo_snow()    the snow lying on top of the logo's S (the letters' snow is measured on the page by xmas.js)
  icon()         the Christmas app icon: SnakeList's own icon with the hat and a little snow

Everything is deterministic (fixed random seeds), so rebuilding gives byte-identical files.
"""
import math, random, re

PINE = ["#0d3322", "#123d2a", "#174d33", "#1d5c3c", "#216b45", "#2a7a4e"]
TIP = ["#3d8a5c", "#4f9a68", "#5fa874"]

def _bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])

def _f(v): return str(int(round(v)))
def _f1(v): return ("%.1f" % v).rstrip("0").rstrip(".")

class Pine:
    """needles collected per colour, so a whole corner is a handful of <path> elements"""
    def __init__(self, seed):
        self.r = random.Random(seed)
        self.layers = {}            # (depth, colour, width) -> [subpaths]
        self.stems = []
        self.pts = []               # (x, y, depth, size) along every stem, for hanging things on
        self.stem = "#3a2a1c"
    def needle(self, depth, x, y, ang, ln, col, w):
        r = self.r
        bend = r.uniform(-0.12, 0.12)
        mx, my = x + math.cos(ang + bend) * ln * 0.55, y + math.sin(ang + bend) * ln * 0.55
        ex, ey = x + math.cos(ang) * ln, y + math.sin(ang) * ln
        self.layers.setdefault((depth, col, w), []).append("M%s %sQ%s %s %s %s" % (_f(x), _f(y), _f(mx), _f(my), _f(ex), _f(ey)))
    def branch(self, p0, p1, p2, p3, depth=0, size=1.0, twigs=True, frost=0.0):
        r = self.r
        n = max(8, int(52 * size))
        self.stems.append((depth, "M%s %sC%s %s %s %s %s %s" % tuple(_f(v) for v in (*p0, *p1, *p2, *p3)), 2.6 * size + 0.6))
        prev = p0
        for i in range(1, n + 1):
            t = i / n
            x, y = _bez(p0, p1, p2, p3, t)
            dx, dy = x - prev[0], y - prev[1]; prev = (x, y)
            self.pts.append((x, y, depth, size))
            a = math.atan2(dy, dx)
            taper = (1 - t * 0.55)
            for side in (-1, 1):
                for k in range(2 + (r.random() < 0.5)):
                    ang = a + side * r.uniform(0.75, 1.25) + r.uniform(-0.1, 0.1)
                    ln = r.uniform(16, 26) * size * taper
                    shade = PINE[min(len(PINE) - 1, max(0, int(r.gauss(2.3 + depth * 0.7 + side * 0.35, 1.0))))]
                    self.needle(depth, x, y, ang, ln, shade, round(r.uniform(2.0, 2.9) * (0.75 + 0.25 * size), 1))
            # needles lying over the stem (the side facing us), lighter
            if r.random() < 0.7:
                ang = a + r.uniform(-0.5, 0.5) + (r.choice((-1, 1)) * 0.55)
                self.needle(depth + 0.5, x, y, ang, r.uniform(12, 19) * size * taper, r.choice(PINE[3:]), 2.2)
            if r.random() < 0.10 * (1 - t):
                self.needle(depth + 0.6, x, y, a + r.uniform(-0.3, 0.3), r.uniform(6, 9) * size, r.choice(TIP), 1.5)
            if frost and r.random() < frost:
                # a little frost on the upper needles
                ang = a - math.pi / 2 * r.choice((1, 0.8)) + r.uniform(-0.3, 0.3)
                self.needle(depth + 0.8, x, y, ang, r.uniform(5, 9) * size, "#eef3ee", 1.4)
            if twigs and i % max(2, int(6 / size)) == 0 and 0.08 < t < 0.9:
                side = r.choice((-1, 1))
                ta = a + side * r.uniform(0.55, 0.85)
                tl = r.uniform(60, 110) * size * (1 - t * 0.5)
                q0 = (x, y)
                q3 = (x + math.cos(ta) * tl, y + math.sin(ta) * tl)
                q1 = (x + math.cos(ta - side * 0.15) * tl * 0.35, y + math.sin(ta - side * 0.15) * tl * 0.35)
                q2 = (x + math.cos(ta + side * 0.1) * tl * 0.7, y + math.sin(ta + side * 0.1) * tl * 0.7)
                self.branch(q0, q1, q2, q3, depth - 0.3, size * 0.7, twigs=False, frost=frost)
    def svg_paths(self):
        out = []
        for d, path, w in sorted(self.stems):
            out.append('<path d="%s" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>' % (path, self.stem, _f1(w)))
        for (d, col, w) in sorted(self.layers):
            out.append('<path d="%s" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>' % ("".join(self.layers[(d, col, w)]), col, _f1(w)))
        return out

def _bauble(x, y, r, kind, hang, uid, ax=None, ay=None):
    """a bauble whose cap hangs on a fine gold wire from a hook bent over the twig at (ax, ay)"""
    g = "xm-b-red" if kind == "red" else "xm-b-gold"
    s = []
    top = y - r * 1.12
    if ax is None: ax, ay = x, top - hang
    # the hook: a small curl over the twig, then the wire down to the cap (slightly curved: it carries weight)
    s.append('<path d="M%s %sq%s %s %s %s" stroke="#c9a54a" stroke-width="1.7" fill="none" stroke-linecap="round"/>' % (_f1(ax - 3.4), _f1(ay + 2.6), _f1(1.6), _f1(-6.6), _f1(5.4), _f1(-3)))
    s.append('<path d="M%s %sQ%s %s %s %s" stroke="#e2c77e" stroke-width="1.05" fill="none" stroke-linecap="round"/>' % (_f1(ax + 1.8), _f1(ay - .2), _f1((ax + x) / 2 + 1.5), _f1((ay + top) / 2), _f1(x), _f1(top + .5)))
    s.append('<circle cx="%s" cy="%s" r="%s" fill="url(#%s)"/>' % (_f1(x), _f1(y), _f1(r), g))
    if kind == "red":
        s.append('<path d="M%s %sQ%s %s %s %s" stroke="#d8b76a" stroke-width="%s" fill="none" opacity=".75"/>' % (_f1(x - r * .92), _f1(y + r * .1), _f1(x), _f1(y + r * .45), _f1(x + r * .92), _f1(y + r * .1), _f1(r * .12)))
    else:
        s.append('<path d="M%s %sQ%s %s %s %s" stroke="#fff4cf" stroke-width="%s" fill="none" opacity=".5"/>' % (_f1(x - r * .95), _f1(y), _f1(x), _f1(y + r * .3), _f1(x + r * .95), _f1(y), _f1(r * .06)))
    s.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#fff" opacity=".55" transform="rotate(-35 %s %s)"/>' % (_f1(x - r * .38), _f1(y - r * .42), _f1(r * .28), _f1(r * .16), _f1(x - r * .38), _f1(y - r * .42)))
    s.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="url(#xm-cap)"/>' % (_f1(x - r * .28), _f1(top), _f1(r * .56), _f1(r * .3), _f1(r * .08)))
    s.append('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="#b8963f" stroke-width=".9"/>' % (_f1(x), _f1(top - .6), _f1(1.3)))
    return "".join(s)

def _snap(p, x, y, min_depth=-1.5):
    """the point on a stem nearest to (x, y) - so a bauble or a light really hangs on the branch"""
    best = None
    for (px, py, d, sz) in p.pts:
        if d < min_depth or px < 8 or py < 8: continue
        dd = (px - x) ** 2 + (py - y) ** 2
        if best is None or dd < best[0]: best = (dd, px, py)
    return (best[1], best[2]) if best else (x, y)

def _lights(points, cls_base="xm-l"):
    """a thin dark wire through the points (sagging between them) and a warm-white bulb on each"""
    d = "M%s %s" % (_f1(points[0][0]), _f1(points[0][1]))
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        mx, my = (x0 + x1) / 2, max(y0, y1) + abs(x1 - x0) * 0.18
        d += "Q%s %s %s %s" % (_f1(mx), _f1(my), _f1(x1), _f1(y1))
    s = ['<path d="%s" stroke="#1a2a20" stroke-width="1.1" fill="none" opacity=".8"/>' % d]
    bulbs = []
    for i, ((x0, y0), (x1, y1)) in enumerate(zip(points, points[1:])):
        mx, my = (x0 + x1) / 2, max(y0, y1) + abs(x1 - x0) * 0.18
        for t in (0.5,):
            bx = (1 - t)**2 * x0 + 2 * (1 - t) * t * mx + t * t * x1
            by = (1 - t)**2 * y0 + 2 * (1 - t) * t * my + t * t * y1
            bulbs.append((bx, by + 2.5, i % 3))
    for (x, y) in points[1:-1]:
        bulbs.append((x, y + 2.5, (len(bulbs)) % 3))
    return "".join(s), [(round(x, 1), round(y + 0.0, 1)) for x, y, k in bulbs]

DEFS = ('<defs>'
        '<radialGradient id="xm-b-red" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e06070"/><stop offset=".45" stop-color="#a92e3e"/><stop offset="1" stop-color="#5a1220"/></radialGradient>'
        '<radialGradient id="xm-b-gold" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fbeab8"/><stop offset=".45" stop-color="#d8b76a"/><stop offset="1" stop-color="#7a5a22"/></radialGradient>'
        '<linearGradient id="xm-cap" x1="0" x2="1"><stop offset="0" stop-color="#8a6a2a"/><stop offset=".5" stop-color="#f0d897"/><stop offset="1" stop-color="#8a6a2a"/></linearGradient>'
        '<radialGradient id="xm-glow"><stop offset="0" stop-color="#fff3d0" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd98a" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf70" stop-opacity="0"/></radialGradient>'
        '<filter id="xm-soft" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".35"/></filter>'
        '</defs>')

def corner(side="l"):
    """an upper-left corner (side 'l'); 'r' is drawn separately (a different tree, not a mirror),
    then flipped so it hangs from the upper-right corner"""
    W, H = 520, 380
    p = Pine(11 if side == "l" else 23)
    rnd = random.Random(7 if side == "l" else 9)
    # a fan of branches from just outside the corner: along the top, across, and down the side,
    # the ones behind darker and shorter; horizontal ones sag a little under their own weight
    fan = ([(4, 470, 1.05, -2), (16, 430, 1.1, 1), (30, 360, 1.0, 0), (46, 300, .95, -1), (62, 250, .9, 0), (80, 230, .85, -1)]
           if side == "l" else
           [(2, 450, 1.0, -2), (13, 440, 1.1, 1), (27, 370, 1.0, 0), (43, 290, .95, -1), (60, 240, .9, 0), (78, 220, .8, -1)])
    for ang, ln, size, depth in fan:
        a0 = math.radians(ang + rnd.uniform(-3, 3))
        x0, y0 = -40 + rnd.uniform(-10, 10), -40 + rnd.uniform(-10, 10)
        x3, y3 = x0 + math.cos(a0) * ln, y0 + math.sin(a0) * ln
        sag = math.cos(a0) * ln * 0.16
        p1 = (x0 + math.cos(a0) * ln * .33, y0 + math.sin(a0) * ln * .33 + sag * .4)
        p2 = (x0 + math.cos(a0) * ln * .66, y0 + math.sin(a0) * ln * .66 + sag)
        p.branch((x0, y0), p1, p2, (x3, y3 + sag * .8), depth=depth, size=size, frost=.05)
    if side == "l":
        lights = [(6, 92), (66, 124), (130, 140), (196, 134), (262, 112), (326, 84), (384, 52)]
        ball = [(170, 196, 21, "red", 34), (92, 250, 16, "gold", 26), (300, 140, 15, "red", 20)]
    else:
        lights = [(4, 84), (62, 118), (128, 138), (198, 138), (266, 118), (332, 88), (390, 56)]
        ball = [(150, 206, 20, "gold", 38), (244, 160, 16, "red", 24), (70, 262, 14, "red", 20)]
    # the light string is draped from twig to twig; every bauble hangs from a twig above it
    lights = [_snap(p, x, y) for (x, y) in lights]
    hung = []
    for (x, y, r, k, h) in ball:
        ax, ay = _snap(p, x, y - r - h)
        hung.append((ax, ay + h + r * 1.12, r, k, h, ax, ay))
    body = p.svg_paths()
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" class="xm-corner-art" aria-hidden="true" focusable="false">' % (W, H), DEFS]
    svg.append('<g filter="url(#xm-soft)">' + "".join(body) + "</g>")
    wire, bulbs = _lights(lights)
    svg.append(wire)
    svg.append("".join(_bauble(x, y, r, k, h, i, ax, ay) for i, (x, y, r, k, h, ax, ay) in enumerate(hung)))
    svg.append("</svg>")
    # bulbs as fractions of the picture, for the page to place its own glowing lights on the wire
    return "".join(svg), [(round(x / W, 4), round(y / H, 4)) for x, y in bulbs]

def sprig():
    """a small pine sprig with two red berries, for the end of the wordmark (40 x 28)"""
    p = Pine(5)
    p.branch((2, 24), (12, 18), (24, 10), (38, 4), depth=0, size=.36, twigs=False)
    p.branch((10, 20), (14, 12), (20, 7), (24, 2), depth=-1, size=.28, twigs=False)
    body = "".join(p.svg_paths())
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 28" aria-hidden="true" focusable="false">' + body +
            '<circle cx="9" cy="22.5" r="2.7" fill="#b63848"/><circle cx="13.2" cy="24.6" r="2.4" fill="#a92e3e"/>'
            '<circle cx="8.2" cy="21.6" r=".8" fill="#fff" opacity=".7"/><circle cx="12.5" cy="23.8" r=".7" fill="#fff" opacity=".6"/></svg>')

def mini_sprig():
    """a tiny, simple pine sprig for heading accents (reads at 14-20 px): a stem, a few needle pairs, two berries"""
    needles = []
    for i in range(7):
        t = i / 6
        x, y = 4 + t * 18, 13 - t * 9
        ln = 5.2 - t * 1.6
        needles.append("M%s %sl%s %s" % (_f1(x), _f1(y), _f1(-ln * .35), _f1(-ln * .9)))
        needles.append("M%s %sl%s %s" % (_f1(x), _f1(y), _f1(ln * .75), _f1(ln * .55)))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 18"><path d="M2 14Q12 10 23 3" stroke="#5b3d24" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
            '<path d="%s" stroke="#2B7A50" stroke-width="1.7" stroke-linecap="round" fill="none"/>'
            '<circle cx="5.5" cy="15" r="2.3" fill="#B63848"/><circle cx="9.2" cy="15.6" r="2" fill="#A92E3E"/><circle cx="4.9" cy="14.3" r=".7" fill="#fff" opacity=".7"/></svg>') % "".join(needles)

# ---------------------------------------------------------------------------------------------------------------
# The Santa hat, drawn once in its own coordinates: the fur brim is 100 wide, centred on (0, 0), and the tip
# flops over to the LEFT (behind a head that looks right). hat_at() puts it anywhere: the logo's snake (head
# looking right, so the tip falls back over its neck), the photo's snake (looking left: flipped) and the icons.
HAT_DEFS = ('<linearGradient id="xmh-r" x1="0" y1="0" x2="1" y2=".25"><stop offset="0" stop-color="#e0505f"/><stop offset=".5" stop-color="#bf2c3e"/><stop offset="1" stop-color="#7f1424"/></linearGradient>'
            '<linearGradient id="xmh-d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9c1d2e"/><stop offset="1" stop-color="#6a0f1c"/></linearGradient>'
            '<radialGradient id="xmh-f" cx=".42" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#f6f2ea"/><stop offset="1" stop-color="#d8d1c3"/></radialGradient>')

def _fur(cx, cy, rx, ry, n, seed):
    """a soft fur edge: overlapping little puffs round an ellipse-ish band"""
    r = random.Random(seed); out = []
    for i in range(n):
        a = i / n * math.tau
        x, y = cx + math.cos(a) * rx, cy + math.sin(a) * ry
        out.append('<circle cx="%s" cy="%s" r="%s"/>' % (_f1(x), _f1(y), _f1(r.uniform(3.2, 4.6))))
    return "".join(out)

HAT = ('<g class="xm-hat">'
       # the body: a soft cone, its crest bending over into a tail that falls to the left
       '<path d="M-41 -4C-38 -30-26-54-4-63C10-69 27-66 36-48C42-35 44-18 44-4Z" fill="url(#xmh-r)"/>'
       '<path d="M-2-64C-18-66-36-60-49-46C-52-42-55-38-56-34L-47-31C-41-43-28-53-11-56Z" fill="url(#xmh-d)"/>'
       '<path d="M-6-63C-22-63-37-55-48-43" stroke="#e46a77" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>'
       '<path d="M30-50C35-38 38-22 38-6" stroke="#6e0f1d" stroke-width="5" fill="none" stroke-linecap="round" opacity=".35"/>'
       '<path d="M-24-12C-20-30-12-44 2-54" stroke="#ef8a95" stroke-width="3" fill="none" stroke-linecap="round" opacity=".35"/>'
       # the pompom
       '<g fill="url(#xmh-f)">' + _fur(-55, -32, 6.5, 6.5, 10, 3) + '<circle cx="-55" cy="-32" r="8.6"/></g>'
       '<circle cx="-57.5" cy="-35" r="3" fill="#fff" opacity=".9"/>'
       # the fur brim (slightly curved, thicker in the middle), with puffs along its edges
       '<g fill="url(#xmh-f)"><path d="M-50-4Q-51-14-40-14Q0-20 40-14Q51-14 50-4Q51 7 40 7Q0 3-40 7Q-51 7-50-4Z"/>'
       + _fur(0, -3.5, 47, 9.5, 26, 5) + '</g>'
       '<path d="M-44 3Q0-1 44 3" stroke="#cfc6b6" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>'
       '<path d="M-38-11Q0-16 38-11" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>'
       '</g>')

def hat_at(cx, cy, width, angle=0.0, flip=False, defs=True):
    """the hat with its brim centred on (cx, cy), `width` wide, turned by `angle` degrees; flip: the tip falls right"""
    k = width / 100.0
    return ('<g transform="translate(%s %s) rotate(%s) scale(%s %s)">%s%s</g>'
            % (_f1(cx), _f1(cy), _f1(angle), "%.4f" % (-k if flip else k), "%.4f" % k, ("<defs>" + HAT_DEFS + "</defs>") if defs else "", HAT))

# on the logo snake: its head group's own coordinates (head looking right, eye at (9.8, -6.4) r 5, top of the
# head at y -16.5): the brim sits on the crown behind the eye, tipped back along the head, the eye left clear
LOGO_HAT = dict(cx=-5, cy=-15.4, width=40, angle=-10)

# ---------------------------------------------------------------------------------------------------------------
# The Christmas stocking that takes the tick's place, drawn in the tick's own viewBox (5.6 0.3 36.9 36.0):
# a red knitted stocking with a fur cuff, two little presents and a candy cane peeking out, snow on top.
STOCKING = ('<g class="xm-stk">'
            '<defs><linearGradient id="xms-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9475a"/><stop offset=".6" stop-color="#b52637"/><stop offset="1" stop-color="#861828"/></linearGradient>'
            '<linearGradient id="xms-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd36a"/><stop offset="1" stop-color="#4c9f3c"/></linearGradient>'
            '<linearGradient id="xms-y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d77c"/><stop offset="1" stop-color="#d1a23f"/></linearGradient></defs>'
            # candy cane
            '<path d="M27.6 13.5V5.2a2.6 2.6 0 0 1 5.2 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'
            '<path d="M27.6 13.5V5.2a2.6 2.6 0 0 1 5.2 0" fill="none" stroke="#d23a4b" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1.2 1.3"/>'
            # a green present, tipped left, and a gold one
            '<g transform="rotate(-11 16.5 9)"><rect x="12" y="4.6" width="9.2" height="8.6" rx="1" fill="url(#xms-g)"/><rect x="15.9" y="4.6" width="1.5" height="8.6" fill="#f3d27a"/>'
            '<path d="M16.6 4.6c-1.6-2.4-4-1.6-2.6.1M16.6 4.6c1.6-2.4 4-1.6 2.6.1" fill="none" stroke="#f3d27a" stroke-width="1.1"/>'
            '<path d="M11.8 4.9q4.8-1.6 9.6 0" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>'
            '<g transform="rotate(9 25 10)"><rect x="20.6" y="7" width="8" height="6.6" rx=".9" fill="url(#xms-y)"/><rect x="24" y="7" width="1.3" height="6.6" fill="#c43345"/>'
            '<path d="M20.4 7.2q4.2-1.4 8.4 0" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></g>'
            # the stocking (leg, heel, foot pointing right) and its knit stripes
            '<path d="M11.4 14.6V26.4C11.4 32.4 15 35.8 20.6 35.8H32.6C37.2 35.8 39.8 33.2 39.6 30.2C39.4 27.4 36.6 25.4 33.2 25.4H29.8V14.6Z" fill="url(#xms-r)" stroke="#6e1220" stroke-width=".6"/>'
            '<path d="M11.6 21.4H29.6M11.6 24.6H29.6" stroke="#fff3e6" stroke-width="1.1" stroke-dasharray="1.6 1.2" opacity=".85"/>'
            '<path d="M33.4 25.6C37 25.6 39.6 27.6 39.6 30.4C39.6 33.2 37 35.8 32.8 35.8H31.2C33.6 33.6 33.8 28.2 31.6 25.6Z" fill="#fff3e6" opacity=".92"/>'
            '<path d="M11.4 29.6C12 33.2 14.8 35.6 18.8 35.8C16.4 34 15.6 31.6 15.8 29.4Z" fill="#fff3e6" opacity=".92"/>'
            # the fur cuff, with snow sitting on it
            '<rect x="9.8" y="11.8" width="21.6" height="5.4" rx="2.7" fill="#fbf8f1" stroke="#d8d0c0" stroke-width=".5"/>'
            '<path d="M10.6 13.2q2-.9 3.6 0t3.6 0 3.6 0 3.6 0 3.6 0" stroke="#e6dfd1" stroke-width=".7" fill="none"/>'
            '<path d="M10.2 12.1Q11.4 10.6 14 11.1Q16 10.2 18.4 10.9Q20.6 10.4 22.8 11Q25.6 10.3 28.4 11Q30.8 10.7 31.4 12.2Q20.6 12.9 10.2 12.1Z" fill="#fff"/>'
            '<path d="M12 4.2q4.6-1.8 9.4-.3M21 6.3q3.8-1.4 7.7.2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none"/>'
            '</g>')

# ---------------------------------------------------------------------------------------------------------------
# Snow lying on top of a shape: wherever the shape's top edge is flat enough to hold it, a soft white cap,
# thicker on flat parts, gone on steep ones. The same rule (top edge per column, then the cap) is used by
# xmas.js for the letters of the wordmark, measured from the font on the page.
def _parse_poly(d):
    """M/L/A/Z path (the logo's S body) -> points; an arc is taken as a straight line to its end"""
    toks = re.findall(r"[MLAZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    pts, i, cmd = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t in "MLAZ": cmd = t; i += 1; continue
        if cmd in ("M", "L"): pts.append((float(toks[i]), float(toks[i + 1]))); i += 2
        elif cmd == "A": pts.append((float(toks[i + 5]), float(toks[i + 6]))); i += 7
        else: i += 1
    return pts

def _n(v): return ("%.2f" % v).rstrip("0").rstrip(".")

def snow_cap(tops, x0, step, T, seed=1):
    """tops: the top edge's y for each column (None where empty), columns `step` apart from x0;
    T: the deepest snow. Returns an SVG path (to fill white)."""
    r = random.Random(seed); ph = [r.uniform(0, 6.28) for _ in range(3)]
    n = len(tops); th = [0.0] * n
    for c in range(n):
        if tops[c] is None: continue
        a, b = max(0, c - 3), min(n - 1, c + 3)
        while tops[a] is None: a += 1
        while tops[b] is None: b -= 1
        slope = (tops[b] - tops[a]) / max(1e-6, (b - a) * step)
        f = max(0.0, 1 - abs(slope) / 0.95) ** 1.6
        x = x0 + c * step
        lump = 0.82 + 0.22 * math.sin(x / (T * 2.3) + ph[0]) + 0.12 * math.sin(x / (T * 0.9) + ph[1])
        th[c] = T * f * lump
    sm = [0.0] * n
    for c in range(n):
        if tops[c] is None: continue
        vals = [th[k] for k in range(max(0, c - 2), min(n, c + 3)) if tops[k] is not None]
        sm[c] = sum(vals) / len(vals)
    paths, c = [], 0
    while c < n:
        if tops[c] is None or sm[c] < T * 0.22: c += 1; continue
        e = c
        while e + 1 < n and tops[e + 1] is not None and sm[e + 1] >= T * 0.22 and abs(tops[e + 1] - tops[e]) < T: e += 1
        if (e - c) * step >= T * 1.2:
            idx = list(range(c, e + 1)); L = len(idx); up, dn = [], []
            for j, k in enumerate(idx):
                taper = math.sin(math.pi * (j + 0.5) / L) ** 0.45
                x = x0 + k * step; y = tops[k]
                up.append((x, y - sm[k] * taper)); dn.append((x, y + T * 0.2 * taper))
            if L > 24: up, dn = up[::2], dn[::2]
            pts = up + dn[::-1]
            paths.append("M" + "L".join("%s %s" % (_n(px), _n(py)) for px, py in pts) + "Z")
        c = e + 1
    return "".join(paths)

def snow_on_polygon(pts, T=3.2, res=8, skip=None):
    """the snow on the top of a filled polygon (in its own units); skip(x, y) leaves a column out"""
    from PIL import Image, ImageDraw
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = min(xs) - 2, min(ys) - 2
    W, H = int((max(xs) - x0 + 4) * res), int((max(ys) - y0 + 4) * res)
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).polygon([((x - x0) * res, (y - y0) * res) for x, y in pts], fill=255)
    px = im.load(); tops = []
    for cx in range(0, W, 2):
        t = None
        for cy in range(H):
            if px[cx, cy] > 128: t = cy / res + y0; break
        if t is not None and skip and skip(cx / res + x0, t): t = None
        tops.append(t)
    return snow_cap(tops, x0, 2 / res, T)

def logo_snow(body_d):
    """the snow on the logo's S (its body path, in the mark's coordinates); the head end, under the hat, left out"""
    return snow_on_polygon(_parse_poly(body_d), T=4.2, skip=lambda x, y: x > 80)

# ---------------------------------------------------------------------------------------------------------------
def icon(favicon_svg, hat, snow):
    """the Christmas app icon: SnakeList's own icon (favicon.svg - its tile and its snake S, same colours) with the
    Santa hat on the snake's head and a little snow on top of the S"""
    # the S a little smaller and lower on the tile, so the hat has room
    s = re.sub(r'<svg x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"',
               lambda m: '<svg x="%.2f" y="%.2f" width="%.2f" height="%.2f"' % (256 - float(m.group(1)) * .43 - 6, 512 - float(m.group(2)) * .86 - 30, float(m.group(1)) * .86, float(m.group(2)) * .86), favicon_svg, 1)
    i = s.find('<g class="snake-head"'); j = s.find("</g>", i)
    if i > 0: s = s[:j] + hat + s[j:]
    k = s.rfind("</svg>", 0, s.rfind("</svg>"))
    s = s[:k] + '<path d="%s" fill="#fff" opacity=".96"/>' % snow + s[k:]
    return s

# ---------------------------------------------------------------------------------------------------------------
# The Christmas Cabin's room, painted once at build time (tools/christmas-icons.js renders this SVG, with its
# textures and lighting filters, to xmas-cabin.webp). The page draws the living parts over it in the same
# 1000 x 600 coordinates - fire, lights, snowfall, the tree's decorations, stockings, presents, logs - at the
# places listed by cabin_data().
CW, CH = 1000, 600
VP = (500.0, 250.0)                 # the vanishing point of the room
BACK = (64.0, 34.0, 936.0, 446.0)   # the back wall: left, top, right, bottom
WIN = (112.0, 96.0, 322.0, 306.0)   # the window's glass
MANTEL_Y = 300.0
FIRE = (780.0, 446.0)               # the fire's base (middle of the firebox floor)
TREE_X, TREE_TOP, TREE_BASE = 452.0, 66.0, 498.0

def _persp(x, y, tx):
    """the point where the line from the vanishing point through (x, y) reaches x = tx"""
    k = (tx - VP[0]) / (x - VP[0])
    return VP[1] + (y - VP[1]) * k

def _tree():
    """the Christmas tree: tiers of drooping pine branches round a trunk, the ones at the back darker"""
    p = Pine(41); r = random.Random(17); p.stem = "#16301f"
    H = TREE_BASE - TREE_TOP
    def half(y): return 10 + (y - TREE_TOP) / H * 196
    tiers = 17
    # the leader at the very top
    p.branch((TREE_X, TREE_TOP + 70), (TREE_X - 1, TREE_TOP + 46), (TREE_X + 1, TREE_TOP + 22), (TREE_X, TREE_TOP), depth=.5, size=.3, twigs=False)
    for k in range(tiers):
        y = TREE_TOP + 18 + k * (H - 42) / (tiers - 1)
        w = half(y) * r.uniform(.92, 1.06)
        for side in (-1, 1):
            for j, (reach, depth, droop) in enumerate(((1.0, 0, .2), (.78, -1, .12), (.58, 1, .28))):
                if k < 2 and j: continue
                ln = w * reach * r.uniform(.9, 1.05)
                sz = .3 + .55 * (ln / 200)
                x0 = TREE_X + side * r.uniform(0, 4)
                x3 = TREE_X + side * ln; y3 = y + ln * droop + r.uniform(4, 12)
                p.branch((x0, y - 4), (x0 + side * ln * .35, y - 6), (x0 + side * ln * .7, y + ln * droop * .5), (x3, y3),
                         depth=depth + k * .01, size=sz)
        # the middle of the tree: short sprays straight down the centre, which hide the trunk
        for dx in (-7, 0, 7):
            ln = (H - 40) / (tiers - 1) * 1.6
            p.branch((TREE_X + dx, y - 6), (TREE_X + dx + r.uniform(-3, 3), y + ln * .33), (TREE_X + dx + r.uniform(-3, 3), y + ln * .66), (TREE_X + dx * 1.6, y + ln), depth=1.1, size=.3 + .3 * k / tiers, twigs=False)
        # branches coming toward us, which fill the middle and hide the trunk
        if k > 0:
            for _ in range(3 if k > 3 else 2):
                s2 = r.choice((-1, 1)); ln = half(y) * r.uniform(.22, .5); x0 = TREE_X + r.uniform(-6, 6)
                p.branch((x0, y - 2), (x0 + s2 * ln * .3, y + 4), (x0 + s2 * ln * .7, y + 12), (x0 + s2 * ln, y + 18 + ln * .15), depth=1.2 + r.uniform(0, .5), size=.28 + ln / 420)
    return p, half

def _pick(pts, n, gap, keep, seed):
    r = random.Random(seed); pts = [q for q in pts if keep(q)]; r.shuffle(pts); out = []
    for q in pts:
        if all((q[0] - o[0]) ** 2 + (q[1] - o[1]) ** 2 >= gap * gap for o in out): out.append(q)
        if len(out) >= n: break
    return sorted(out, key=lambda q: (q[1], q[0]))

def cabin_data():
    """where the page puts the living parts (all in the 1000 x 600 scene)"""
    p, half = _tree()
    front = lambda q: q[2] >= -0.2
    inside = lambda f0, f1: (lambda q: front(q) and f0 <= abs(q[0] - TREE_X) / max(1, half(q[1])) <= f1 and TREE_TOP + 30 < q[1] < TREE_BASE - 8)
    lights = _pick(p.pts, 46, 24, inside(.1, .98), 3)
    baubles = _pick(p.pts, 15, 46, inside(.3, .9), 5)
    orns = _pick([q for q in p.pts if all((q[0] - b[0]) ** 2 + (q[1] - b[1]) ** 2 > 900 for b in baubles)], 12, 52, inside(.2, .85), 7)
    garl = []
    for y in (150, 238, 326, 414):
        w0, w1 = half(y) * .9, half(y + 46) * .9
        garl.append("M%s %sQ%s %s %s %s" % (_f(TREE_X - w0), _f(y), _f(TREE_X), _f(y + 58), _f(TREE_X + w1), _f(y + 28)))
    beam = []
    for i in range(15):
        x = 20 + i * 69
        beam.append((x, 40 + 14 * math.sin(math.pi * ((x - 20) % 138) / 138)))
    rd = lambda L: [[round(q[0], 1), round(q[1], 1)] for q in L]
    return {"lights": rd(lights), "baubles": rd(baubles), "orns": rd(orns), "garland": garl, "beam": rd(beam),
            "top": [TREE_X, TREE_TOP - 4], "win": [WIN[0], WIN[1], WIN[2], WIN[3]], "fire": list(FIRE), "mantel": MANTEL_Y,
            "stockings": [684, 742, 818, 876], "basket": [902, 470]}

CABIN_DEFS = '''<defs>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.16" numOctaves="4" seed="4" result="n"/>
 <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.06  0 0 0 0 0.02  0 0 0 1.3 -0.45" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/>
 <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>
<filter id="bump" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="4" seed="9" result="n"/>
 <feDiffuseLighting in="n" surfaceScale="4.5" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="55"/></feDiffuseLighting>
 <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1.05" k2="0" k3="0" k4="0" result="m"/><feComposite in="m" in2="SourceGraphic" operator="in"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="soft2"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="tshadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="-10" dy="6" stdDeviation="8" flood-color="#120802" flood-opacity=".55"/></filter>
<linearGradient id="log" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b3519"/><stop offset=".16" stop-color="#9b6436"/><stop offset=".34" stop-color="#b57a45"/><stop offset=".62" stop-color="#8d5a30"/><stop offset=".9" stop-color="#4f2d14"/><stop offset="1" stop-color="#2e1a0b"/></linearGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f1b0c"/><stop offset=".5" stop-color="#5e3a1d"/><stop offset="1" stop-color="#25150a"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2c16"/><stop offset="1" stop-color="#7a4a26"/></linearGradient>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#091530"/><stop offset=".55" stop-color="#1c3560"/><stop offset="1" stop-color="#3f5f86"/></linearGradient>
<radialGradient id="moon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe8"/><stop offset=".35" stop-color="#fff4cf" stop-opacity=".9"/><stop offset=".42" stop-color="#cfe0ff" stop-opacity=".35"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
<linearGradient id="snowhill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset="1" stop-color="#a9bdd6"/></linearGradient>
<linearGradient id="farhill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9cbe6"/><stop offset="1" stop-color="#6e86ad"/></linearGradient>
<linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a39a8c"/><stop offset="1" stop-color="#6d665c"/></linearGradient>
<radialGradient id="firebox" cx=".5" cy=".95" r=".9"><stop offset="0" stop-color="#3a1a0a"/><stop offset=".45" stop-color="#140b06"/><stop offset="1" stop-color="#0d0805"/></radialGradient>
<radialGradient id="warm" cx="780" cy="420" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb35c" stop-opacity=".55"/><stop offset=".35" stop-color="#ff9a3c" stop-opacity=".22"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
<radialGradient id="dark" cx="760" cy="410" r="760" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#d9c8b4"/><stop offset=".8" stop-color="#6f5a49"/><stop offset="1" stop-color="#4a3a2e"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".46" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#080402" stop-opacity=".62"/></radialGradient>
<linearGradient id="curt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a0e18"/><stop offset=".25" stop-color="#9a1f2e"/><stop offset=".5" stop-color="#6e1220"/><stop offset=".75" stop-color="#a8283a"/><stop offset="1" stop-color="#5a0e18"/></linearGradient>
<linearGradient id="mantel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a36b3a"/><stop offset=".3" stop-color="#7d4d26"/><stop offset="1" stop-color="#3c220f"/></linearGradient>
<clipPath id="wclip"><rect x="112" y="96" width="210" height="210"/></clipPath>
<clipPath id="backc"><rect x="0" y="0" width="1000" height="446"/></clipPath>
</defs>'''

def _logs_wall(x0, x1, y0, y1, seed):
    """horizontal logs with chinking, knots and checks"""
    r = random.Random(seed); out = []; y = y0; i = 0
    while y < y1:
        h = r.uniform(42, 48)
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="url(#log)"/>' % (_f(x0), _f1(y), _f(x1 - x0), _f1(h)))
        for _ in range(r.randint(2, 4)):
            kx = r.uniform(x0 + 20, x1 - 20); ky = y + h * r.uniform(.35, .65)
            out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#3d220e" opacity=".55"/><ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="none" stroke="#2a1507" stroke-width="1" opacity=".5"/>'
                       % (_f1(kx), _f1(ky), _f1(r.uniform(3, 6)), _f1(r.uniform(2, 3.4)), _f1(kx), _f1(ky), _f1(r.uniform(7, 11)), _f1(r.uniform(3.6, 5))))
        for _ in range(r.randint(3, 6)):
            cx = r.uniform(x0, x1); cy = y + h * r.uniform(.3, .7); ln = r.uniform(40, 160)
            out.append('<path d="M%s %sq%s %s %s %s" stroke="#2c1608" stroke-width="%s" fill="none" opacity=".45"/>' % (_f1(cx), _f1(cy), _f1(ln / 2), _f1(r.uniform(-2, 2)), _f1(ln), _f1(r.uniform(-1.5, 1.5)), _f1(r.uniform(.8, 1.6))))
        # the chinking between this log and the next, in shadow under the log's belly
        out.append('<rect x="%s" y="%s" width="%s" height="5" fill="#c9b48f"/><rect x="%s" y="%s" width="%s" height="2.4" fill="#2a1709" opacity=".7"/>' % (_f(x0), _f1(y + h - 1), _f(x1 - x0), _f(x0), _f1(y + h - 1), _f(x1 - x0)))
        y += h + 3; i += 1
    return '<g filter="url(#grain)">' + "".join(out) + '</g>'

def _stones(x0, x1, y0, y1, seed):
    r = random.Random(seed); out = []; y = y0; row = 0
    while y < y1:
        h = r.uniform(30, 40); x = x0 - (r.uniform(0, 30) if row % 2 else 0)
        while x < x1:
            w = r.uniform(38, 64)
            c = r.choice(["#7d7468", "#6b645b", "#8a8174", "#5f584f", "#74695c", "#857a6b", "#6f675e"])
            rx = r.uniform(6, 12)
            out.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>' % (_f1(x + 2), _f1(y + 2), _f1(w - 4), _f1(h - 4), _f1(rx), c))
            out.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/>' % (_f1(x + 3), _f1(y + 3), _f1(w - 6), _f1(h - 7), _f1(rx)))
            x += w
        y += h; row += 1
    return ('<g><rect x="%s" y="%s" width="%s" height="%s" fill="#262119"/><g filter="url(#bump)">%s</g></g>' % (_f(x0), _f(y0), _f(x1 - x0), _f(y1 - y0), "".join(out)))

def _window_view():
    r = random.Random(12); s = ['<g clip-path="url(#wclip)"><rect x="112" y="96" width="210" height="210" fill="url(#sky)"/>']
    for _ in range(60):
        s.append('<circle cx="%s" cy="%s" r="%s" fill="#fff" opacity="%s"/>' % (_f1(r.uniform(112, 322)), _f1(r.uniform(96, 220)), _f1(r.uniform(.35, 1.1)), _f1(r.uniform(.4, .95))))
    s.append('<circle cx="272" cy="134" r="40" fill="url(#moon)"/><circle cx="272" cy="134" r="12" fill="#fffaf0"/>')
    s.append('<path d="M100 236L140 206L176 222L214 192L250 214L284 198L330 226V320H100Z" fill="url(#farhill)" opacity=".9"/>')
    s.append('<path d="M140 206L150 214L158 210L166 216L176 222M214 192L222 200L230 197L240 207L250 214" stroke="#eef4ff" stroke-width="3" fill="none" opacity=".8"/>')
    # rows of pines standing on the hills, each with its trunk on the snow and a little snow on its branches
    def pine(x, base, h, col):
        w = h * .42; t = []
        t.append('<rect x="%s" y="%s" width="%s" height="%s" fill="#2b1d14"/>' % (_f1(x - h * .035), _f1(base - h * .12), _f1(h * .07), _f1(h * .14)))
        for k in range(4):
            yy = base - h * .1 - k * h * .21; ww = w * (1 - k * .2)
            t.append('<path d="M%s %sL%s %sL%s %sZ" fill="%s"/>' % (_f1(x - ww), _f1(yy), _f1(x), _f1(yy - h * .34), _f1(x + ww), _f1(yy), col))
            t.append('<path d="M%s %sQ%s %s %s %s" stroke="#f2f6ff" stroke-width="%s" fill="none" opacity=".85"/>' % (_f1(x - ww * .7), _f1(yy - h * .06), _f1(x - ww * .2), _f1(yy - h * .18), _f1(x), _f1(yy - h * .3), _f1(max(.8, h * .03))))
        t.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#e9f0fb"/>' % (_f1(x), _f1(base), _f1(h * .26), _f1(h * .05)))
        return "".join(t)
    def hill(xs, y0, amp, ph): return [(x, y0 + amp * math.sin(x / 38 + ph)) for x in xs]
    mid = hill(range(100, 340, 4), 252, 6, 1.0)
    s.append('<path d="M100 330V%sL%sV330Z" fill="url(#snowhill)" opacity=".92"/>' % (_f1(mid[0][1]), "L".join("%s %s" % (_f(x), _f1(y)) for x, y in mid) + " 336 " + _f1(mid[-1][1])))
    for x in (126, 158, 196, 232, 268, 300):
        base = 252 + 6 * math.sin(x / 38 + 1.0) + 2
        s.append(pine(x + r.uniform(-4, 4), base, r.uniform(26, 38), "#1d3b33"))
    near = hill(range(100, 340, 4), 284, 4, 2.2)
    s.append('<path d="M100 330V%sL%sV330Z" fill="#f6f9ff"/>' % (_f1(near[0][1]), "L".join("%s %s" % (_f(x), _f1(y)) for x, y in near) + " 336 " + _f1(near[-1][1])))
    for x in (138, 212, 292):
        base = 284 + 4 * math.sin(x / 38 + 2.2) + 2
        s.append(pine(x + r.uniform(-5, 5), base, r.uniform(48, 62), "#163028"))
    s.append('<path d="M112 300Q160 288 220 296T322 292V306H112Z" fill="#fff"/>')
    # frost in the corners of the panes and a cold reflection on the glass
    for (cx, cy) in ((112, 306), (322, 306), (217, 201)):
        s.append('<circle cx="%s" cy="%s" r="40" fill="#e8f1ff" opacity=".22" filter="url(#soft)"/>' % (cx, cy))
    s.append('<path d="M130 96L190 96L130 200Z" fill="#fff" opacity=".06"/><path d="M228 96L262 96L228 160Z" fill="#fff" opacity=".05"/>')
    s.append('</g>')
    return "".join(s)

def cabin_svg():
    """the whole room as one SVG (rendered to a picture at build time)"""
    bl, bt, br, bb = BACK
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="1000" height="600">', CABIN_DEFS]
    o.append('<rect width="1000" height="600" fill="#2a170b"/>')
    # back wall
    o.append(_logs_wall(bl, br, bt, bb + 10, 3))
    # side walls in perspective (the same logs, running toward us)
    for side in (-1, 1):
        ex = 0 if side < 0 else 1000; wx = bl if side < 0 else br
        poly = "%s 0 %s %s %s %s %s 600" % (ex, _f(wx), _f(bt), _f(wx), _f(bb), ex)
        rows = []; y = bt
        rr = random.Random(5 + side)
        while y < bb:
            h = rr.uniform(42, 48)
            ya, yb2 = _persp(wx, y, ex), _persp(wx, y + h, ex)
            rows.append('<path d="M%s %sL%s %sL%s %sL%s %sZ" fill="url(#log)"/>' % (_f(wx), _f1(y), ex, _f1(ya), ex, _f1(yb2), _f(wx), _f1(y + h)))
            rows.append('<path d="M%s %sL%s %s" stroke="#c9b48f" stroke-width="4"/>' % (_f(wx), _f1(y + h + 1), ex, _f1(_persp(wx, y + h + 1, ex))))
            y += h + 3
        o.append('<g filter="url(#grain)"><clipPath id="sw%d"><polygon points="%s"/></clipPath><g clip-path="url(#sw%d)">%s<polygon points="%s" fill="#140a03" opacity=".38"/></g></g>' % (side + 1, poly, side + 1, "".join(rows), poly))
    # floor: planks running away from us, with a warm sheen from the fire
    fl = ['<path d="M0 600L%s %sH%sL1000 600Z" fill="url(#floor)"/>' % (_f(bl), _f(bb), _f(br))]
    for i in range(-6, 30):
        xb = bl + i * 36
        if xb < -2000 or xb > 3000: continue
        xf = VP[0] + (xb - VP[0]) * (600 - VP[1]) / (bb - VP[1])
        fl.append('<path d="M%s %sL%s 600" stroke="#2b170a" stroke-width="1.6" opacity=".7"/>' % (_f1(xb), _f(bb), _f1(xf)))
    rr = random.Random(8)
    for j in range(7):
        yy = bb + (600 - bb) * ((j + .5) / 7) ** 1.3
        for _ in range(6):
            xx = rr.uniform(0, 1000)
            fl.append('<path d="M%s %sh%s" stroke="#2b170a" stroke-width="1.2" opacity=".5"/>' % (_f1(xx), _f1(yy), _f1(rr.uniform(-1.5, 1.5))))
    o.append('<g filter="url(#grain)">' + "".join(fl) + '</g>')
    o.append('<rect x="0" y="%s" width="1000" height="18" fill="#100803" opacity=".45" filter="url(#soft)"/>' % _f(bb - 4))
    # ceiling and the big beam
    o.append('<rect x="0" y="0" width="1000" height="%s" fill="#24140a"/>' % _f(bt))
    o.append('<g filter="url(#grain)"><rect x="0" y="0" width="1000" height="38" fill="url(#beam)"/></g><rect x="0" y="36" width="1000" height="6" fill="#120a04" opacity=".55" filter="url(#soft)"/>')
    # the window: deep frame, sill, curtains
    wx0, wy0, wx1, wy1 = WIN
    o.append('<rect x="%s" y="%s" width="%s" height="%s" rx="4" fill="#3b220f"/>' % (_f(wx0 - 18), _f(wy0 - 18), _f(wx1 - wx0 + 36), _f(wy1 - wy0 + 36)))
    o.append(_window_view())
    o.append('<path d="M%s %sL%s %sL%s %sL%s %sZ" fill="#2a1709" opacity=".85"/>' % (_f(wx0 - 8), _f(wy0 - 8), _f(wx0 + 4), _f(wy0 + 4), _f(wx0 + 4), _f(wy1 - 4), _f(wx0 - 8), _f(wy1 + 8)))
    o.append('<path d="M%s %sH%s" stroke="#4a2c15" stroke-width="9"/><path d="M%s %sV%s" stroke="#4a2c15" stroke-width="9"/>' % (_f(wx0), _f((wy0 + wy1) / 2), _f(wx1), _f((wx0 + wx1) / 2), _f(wy0), _f(wy1)))
    o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="#5a3519" stroke-width="12"/>' % (_f(wx0 - 6), _f(wy0 - 6), _f(wx1 - wx0 + 12), _f(wy1 - wy0 + 12)))
    o.append('<g filter="url(#grain)"><rect x="%s" y="%s" width="%s" height="16" rx="3" fill="#6b4220"/><rect x="%s" y="%s" width="%s" height="4" fill="#8a5a30"/></g>' % (_f(wx0 - 30), _f(wy1 + 10), _f(wx1 - wx0 + 60), _f(wx0 - 30), _f(wy1 + 10), _f(wx1 - wx0 + 60)))
    o.append('<rect x="%s" y="%s" width="%s" height="10" fill="#140a04" opacity=".5" filter="url(#soft)"/>' % (_f(wx0 - 28), _f(wy1 + 26), _f(wx1 - wx0 + 56)))
    # curtains, gathered and tied
    for side in (-1, 1):
        x = wx0 - 30 if side < 0 else wx1 + 30
        d = ('M%s 70Q%s 70 %s 70Q%s 190 %s 230Q%s 280 %s 330L%s 330Q%s 250 %s 70Z'
             % (_f(x), _f(x - side * 30), _f(x - side * 58), _f(x - side * 40), _f(x - side * 14), _f(x - side * 8), _f(x - side * 30), _f(x + side * 6), _f(x + side * 8), _f(x + side * 4)))
        o.append('<path d="%s" fill="url(#curt)" filter="url(#tshadow)"/>' % d)
        o.append('<path d="M%s 226q%s 8 %s 0" stroke="#d8b76a" stroke-width="5" fill="none" stroke-linecap="round"/>' % (_f(x - side * 26), _f(-side * 10), _f(side * 30)))
    o.append('<rect x="%s" y="62" width="%s" height="9" rx="4.5" fill="#2b1708"/><circle cx="%s" cy="66.5" r="7" fill="#b8913f"/><circle cx="%s" cy="66.5" r="7" fill="#b8913f"/>' % (_f(wx0 - 52), _f(wx1 - wx0 + 104), _f(wx0 - 54), _f(wx1 + 54)))
    # the fireplace: a stone chimney breast, firebox, hearth and a thick wooden mantel
    fx0, fx1 = 640.0, 922.0
    o.append('<rect x="%s" y="0" width="%s" height="%s" fill="#000" opacity=".35" filter="url(#soft2)"/>' % (_f(fx0 - 10), _f(fx1 - fx0 + 20), _f(bb + 6)))
    o.append(_stones(fx0, fx1, 38, bb, 21))
    o.append('<path d="M700 %sV392Q700 336 780 336Q860 336 860 392V%sZ" fill="#2a1d16"/>' % (_f(bb), _f(bb)))
    o.append('<path d="M708 %sV394Q708 344 780 344Q852 344 852 394V%sZ" fill="url(#firebox)"/>' % (_f(bb), _f(bb)))
    for k in range(4):
        o.append('<path d="M716 %sH844" stroke="#3a2015" stroke-width="1.2" opacity=".7"/>' % _f(372 + k * 18))
    # the charred logs in the fire (their glow is drawn by the page)
    o.append('<g filter="url(#grain)"><rect x="728" y="428" width="104" height="18" rx="9" fill="#3b2412"/><rect x="742" y="414" width="80" height="16" rx="8" fill="#4a2d16" transform="rotate(-9 782 422)"/></g>')
    o.append('<ellipse cx="732" cy="437" rx="4" ry="8" fill="#a5774a"/><ellipse cx="830" cy="437" rx="4" ry="8" fill="#a5774a"/>')
    o.append('<g filter="url(#bump)"><rect x="%s" y="%s" width="%s" height="28" rx="4" fill="#8f877a"/></g><rect x="%s" y="%s" width="%s" height="4" fill="#c7bfb2" opacity=".55"/>' % (_f(fx0 - 22), _f(bb - 2), _f(fx1 - fx0 + 44), _f(fx0 - 22), _f(bb - 2), _f(fx1 - fx0 + 44)))
    o.append('<g filter="url(#grain)"><rect x="%s" y="%s" width="%s" height="28" rx="3" fill="url(#mantel)"/></g>' % (_f(fx0 - 32), _f(MANTEL_Y), _f(fx1 - fx0 + 64)))
    o.append('<rect x="%s" y="%s" width="%s" height="12" fill="#0e0703" opacity=".55" filter="url(#soft)"/>' % (_f(fx0 - 28), _f(MANTEL_Y + 26), _f(fx1 - fx0 + 56)))
    # a pine wreath with a red bow on the chimney
    wp = Pine(77)
    for k in range(22):
        a0 = k / 22 * math.tau; a1 = a0 + .5
        wp.branch((780 + 40 * math.cos(a0), 210 + 40 * math.sin(a0)), (780 + 44 * math.cos(a0 + .17), 210 + 44 * math.sin(a0 + .17)),
                  (780 + 44 * math.cos(a0 + .34), 210 + 44 * math.sin(a0 + .34)), (780 + 40 * math.cos(a1), 210 + 40 * math.sin(a1)), depth=k % 3 - 1, size=.36, twigs=False)
    o.append('<g filter="url(#tshadow)">' + "".join(wp.svg_paths()) + '</g>')
    rr = random.Random(4)
    for k in range(9):
        a = rr.uniform(0, math.tau); o.append('<circle cx="%s" cy="%s" r="3.4" fill="#b0202f"/>' % (_f1(780 + 41 * math.cos(a)), _f1(210 + 41 * math.sin(a))))
    o.append('<path d="M780 252c-16-14-30-4-18 6zM780 252c16-14 30-4 18 6z" fill="#b0202f" stroke="#6e0f1b" stroke-width="1.2"/><path d="M776 256l-8 22M784 256l8 22" stroke="#b0202f" stroke-width="5" stroke-linecap="round"/><circle cx="780" cy="253" r="5" fill="#8a1522"/>')
    # the log basket by the hearth (its logs are drawn by the page)
    o.append('<g transform="translate(902 470)" filter="url(#tshadow)"><path d="M-6 30H96L88 84H2z" fill="#9a6b3a"/><path d="M-6 30H96L88 84H2z" fill="none" stroke="#5b3a1c" stroke-width="3"/>'
             '<path d="M0 42H92M2 54H90M3 66H89M4 77H88" stroke="#5b3a1c" stroke-width="2" opacity=".7"/><path d="M14 30V84M34 30V84M54 30V84M74 30V84" stroke="#5b3a1c" stroke-width="1.5" opacity=".5"/></g>')
    # a braided rug
    for k, c in enumerate(("#7a1b27", "#d9c7a0", "#2c5a3d", "#9a2534", "#d9c7a0", "#7a1b27")):
        o.append('<ellipse cx="500" cy="552" rx="%s" ry="%s" fill="%s"/>' % (_f(300 - k * 34), _f(46 - k * 5.4), c))
    o.append('<ellipse cx="500" cy="552" rx="300" ry="46" fill="none" stroke="#3c0c12" stroke-width="2" stroke-dasharray="3 4" opacity=".6"/>')
    # the tree: its shadow, the trunk, the branches, and a woven basket stand
    o.append('<ellipse cx="%s" cy="%s" rx="230" ry="34" fill="#0d0602" opacity=".55" filter="url(#soft2)"/>' % (_f(TREE_X - 20), _f(TREE_BASE + 16)))
    o.append('<path d="M%s %sL%s %sL%s %sZ" fill="#0b0602" opacity=".28" filter="url(#soft2)" transform="translate(-60 0)"/>' % (_f(TREE_X), _f(TREE_TOP + 20), _f(TREE_X - 210), _f(bb), _f(TREE_X + 120), _f(bb)))
    tp, half = _tree()
    o.append('<rect x="%s" y="%s" width="16" height="40" fill="#3a2210"/>' % (_f(TREE_X - 8), _f(TREE_BASE - 34)))
    o.append('<path d="M%s %sL%s %sQ%s %s %s %sZ" fill="#0e2618"/>' % (_f(TREE_X), _f(TREE_TOP + 24), _f(TREE_X + half(TREE_BASE) * .78), _f(TREE_BASE - 6),
             _f(TREE_X), _f(TREE_BASE + 12), _f(TREE_X - half(TREE_BASE) * .78), _f(TREE_BASE - 6)))
    o.append('<g filter="url(#tshadow)">' + "".join(tp.svg_paths()) + '</g>')
    o.append('<g filter="url(#grain)"><path d="M%s %sH%sL%s %sH%sZ" fill="#b5834a"/></g>' % (_f(TREE_X - 46), _f(TREE_BASE - 8), _f(TREE_X + 46), _f(TREE_X + 38), _f(TREE_BASE + 40), _f(TREE_X - 38)))
    o.append('<path d="M%s %sH%sM%s %sH%sM%s %sH%s" stroke="#7a522a" stroke-width="2.4"/>' % (_f(TREE_X - 44), _f(TREE_BASE + 4), _f(TREE_X + 44), _f(TREE_X - 42), _f(TREE_BASE + 16), _f(TREE_X + 42), _f(TREE_X - 40), _f(TREE_BASE + 28), _f(TREE_X + 40)))
    o.append('<rect x="%s" y="%s" width="96" height="7" rx="3" fill="#8c5f30"/>' % (_f(TREE_X - 48), _f(TREE_BASE - 10)))
    # light: the fire's warmth, the cold window light on the floor, a soft vignette
    o.append('<path d="M%s %sL%s %sL%s 600L%s 600Z" fill="#9fc0ff" opacity=".07" filter="url(#soft2)"/>' % (_f(WIN[0]), _f(bb), _f(WIN[2]), _f(bb), _f(WIN[2] + 120), _f(WIN[0] - 30)))
    o.append('<rect width="1000" height="600" fill="url(#dark)" style="mix-blend-mode:multiply"/>')
    o.append('<rect width="1000" height="600" fill="url(#warm)" style="mix-blend-mode:screen"/>')
    o.append('<rect width="1000" height="600" fill="url(#vig)"/>')
    o.append('</svg>')
    return "".join(o)
