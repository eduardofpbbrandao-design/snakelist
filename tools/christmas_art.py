"""Artwork for the Christmas preview, drawn as SVG by code (no outside images, so nothing to license).

  corner(side)   pine branches for an upper corner of the opening cover, with a string of
                 warm-white fairy lights and a few red and gold baubles
  sprig()        the small pine sprig with two berries that sits at the end of the wordmark
  hat_svg()      the Santa hat, in the coordinates of the logo snake's head (see xmas.js)
  icon(mark)     the app icon: the snake S from the live logo, with the hat, on evergreen

Everything is deterministic (fixed random seeds), so rebuilding gives byte-identical files.
"""
import math, random

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
            out.append('<path d="%s" stroke="#3a2a1c" stroke-width="%s" fill="none" stroke-linecap="round"/>' % (path, _f1(w)))
        for (d, col, w) in sorted(self.layers):
            out.append('<path d="%s" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>' % ("".join(self.layers[(d, col, w)]), col, _f1(w)))
        return out

def _bauble(x, y, r, kind, hang, uid):
    g = "xm-b-red" if kind == "red" else "xm-b-gold"
    s = []
    s.append('<path d="M%s %sL%s %s" stroke="#d8b76a" stroke-width="1" opacity=".85"/>' % (_f1(x), _f1(y - r - hang), _f1(x), _f1(y - r)))
    s.append('<circle cx="%s" cy="%s" r="%s" fill="url(#%s)"/>' % (_f1(x), _f1(y), _f1(r), g))
    # a soft band of pattern on the red ones, a fine ridge on the gold
    if kind == "red":
        s.append('<path d="M%s %sQ%s %s %s %s" stroke="#d8b76a" stroke-width="%s" fill="none" opacity=".75"/>' % (_f1(x - r * .92), _f1(y + r * .1), _f1(x), _f1(y + r * .45), _f1(x + r * .92), _f1(y + r * .1), _f1(r * .12)))
    else:
        s.append('<path d="M%s %sQ%s %s %s %s" stroke="#fff4cf" stroke-width="%s" fill="none" opacity=".5"/>' % (_f1(x - r * .95), _f1(y), _f1(x), _f1(y + r * .3), _f1(x + r * .95), _f1(y), _f1(r * .06)))
    s.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#fff" opacity=".55" transform="rotate(-35 %s %s)"/>' % (_f1(x - r * .38), _f1(y - r * .42), _f1(r * .28), _f1(r * .16), _f1(x - r * .38), _f1(y - r * .42)))
    s.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="url(#xm-cap)"/>' % (_f1(x - r * .28), _f1(y - r * 1.12), _f1(r * .56), _f1(r * .3), _f1(r * .08)))
    return "".join(s)

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
    body = p.svg_paths()
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" class="xm-corner-art" aria-hidden="true" focusable="false">' % (W, H), DEFS]
    svg.append('<g filter="url(#xm-soft)">' + "".join(body) + "</g>")
    wire, bulbs = _lights(lights)
    svg.append(wire)
    svg.append("".join(_bauble(x, y, r, k, h, i) for i, (x, y, r, k, h) in enumerate(ball)))
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

# the Santa hat in the coordinates of the logo snake's head as drawn today (head pointing right, eye at
# (9,-7), top of the head at y -16.5). xmas.js moves and scales it to the head it finds, so it follows
# a redrawn logo; it never reaches the eye (its right edge stays left of the eye's left edge).
HAT = ('<g class="xm-hat" transform="translate(2.6 -16) scale(1.32) translate(-2.6 16)">'
       '<path d="M0.5 -18.4C0.8 -27.6 -3.6 -35.4 -11.6 -38.8C-18.8 -41.6 -26.4 -39.4 -29.8 -33.2L-25.6 -31.2C-22.6 -34.4 -18.8 -34.2 -16.2 -31C-18.2 -27.2 -20.6 -22.4 -22.2 -17.4Z" fill="#A92E3E"/><path d="M-6 -20C-5.4 -27 -8.8 -33.6 -15 -36.6C-19.6 -38.4 -24.4 -37.6 -27.4 -34.8C-24 -38.6 -18.6 -39.6 -13.6 -37.6C-7.6 -35 -4.4 -28.2 -4.2 -20.4Z" fill="#C94657" opacity=".8"/>'
       '<path d="M-25.6 -31.2C-22.6 -34.4 -18.8 -34.2 -16.2 -31C-17 -29.4 -17.8 -27.8 -18.5 -26.2C-19.6 -29.4 -22.4 -31.4 -25.6 -31.2Z" fill="#6e1a27" opacity=".55"/>'
       '<path d="M-4.4 -21.4C-4.6 -28.2 -7.6 -33.4 -12.8 -36" stroke="#e0707e" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>'
       '<path d="M-24.6 -15.6Q-11 -22.4 2.6 -18" stroke="#fff8ed" stroke-width="6.6" fill="none" stroke-linecap="round"/>'
       '<path d="M-24 -13.6Q-11 -20 2.2 -15.8" stroke="#d9cdb8" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>'
       '<circle cx="-29.6" cy="-31.8" r="4.9" fill="#fff8ed"/><circle cx="-28.6" cy="-30.4" r="3.4" fill="#e6dccb" opacity=".6"/><circle cx="-31" cy="-33.4" r="1.6" fill="#fff"/>'
       '</g>')
HAT_DEFS = ('<linearGradient id="xm-hat-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c94657"/><stop offset=".55" stop-color="#a92e3e"/><stop offset="1" stop-color="#7c1d2b"/></linearGradient>')

def icon(mark_inner, mark_viewbox="-23.5 2.0 144.7 145.5"):
    """the app icon: the logo's snake S (with the hat) on a deep evergreen tile with a fine gold ring.
    mark_inner is the inside of the live logo's <g id="mark-snake">, the hat already added."""
    vx, vy, vw, vh = [float(v) for v in mark_viewbox.split()]
    # the S fills about 70% of the tile, a touch low so the hat has room
    size = 512
    s = size * 0.6 / vh
    tx = size / 2 - (vx + vw / 2) * s
    ty = size * 0.57 - (vy + vh / 2) * s
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
            '<defs><linearGradient id="xm-ibg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#216b45"/><stop offset="1" stop-color="#0f3323"/></linearGradient>'
            '<radialGradient id="xm-ihl" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff8ed" stop-opacity=".16"/><stop offset=".6" stop-color="#fff8ed" stop-opacity="0"/></radialGradient>'
            + HAT_DEFS + '</defs>'
            '<rect width="512" height="512" rx="112" fill="url(#xm-ibg)"/><rect width="512" height="512" rx="112" fill="url(#xm-ihl)"/>'
            '<rect x="14" y="14" width="484" height="484" rx="99" fill="none" stroke="#d8b76a" stroke-width="5" opacity=".9"/>'
            '<g fill="#fff8ed" opacity=".55"><circle cx="96" cy="120" r="5"/><circle cx="420" cy="96" r="4"/><circle cx="436" cy="300" r="5"/><circle cx="78" cy="372" r="4"/><circle cx="380" cy="420" r="3.5"/><circle cx="140" cy="440" r="3"/></g>'
            '<g transform="translate(%s %s) scale(%s)" style="--sl-snake:#6cc85f;--sl-pat:rgba(13,51,34,.55);--sl-eye:#0d3322">%s</g></svg>'
            % (_f(tx), _f(ty), "%.4f" % s, mark_inner))
