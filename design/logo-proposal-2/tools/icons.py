"""App icons + favicons for A and B: the snake S (pattern + eye) on a contrasting ground."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import VARIANTS, SMALL, TINY, snake_inner, W

OUT = os.path.abspath(W + '../logo') + '/'
BG = {
    # A: today's pale field-guide paper, a touch more contrast at the edge
    'A': ('#f5f9ee', '#dce8cc'),
    # B: SnakeList's own forest green (the dark theme / app theme colour)
    'B': ('#2a7049', '#164229'),
}
# on the dark ground B's snake is lifted a step so it pops
SNAKE_ON = {'A': None, 'B': '#66c75c'}


def tight_vb(v, small):
    tip = {('A', False): 130.5, ('B', False): 140, ('A', True): 123, ('B', True): 128, ('A', 'tiny'): 126, ('B', 'tiny'): 129}[(v, small)]
    x0, y0, y1 = -14.5, 1.0, 148.5
    return x0, y0, tip - x0, y1 - y0


def snake_at(name, small, cx, cy, h, uid):
    v = dict((TINY if small == 'tiny' else SMALL if small else VARIANTS)[name])
    if SNAKE_ON[name]:
        v['snake'] = SNAKE_ON[name]
    x0, y0, w0, h0 = tight_vb(name, small)
    w = h * w0 / h0
    # optical centre: the head is heavy at the top right, nudge the coil a hair left/down
    return (f'<svg x="{cx - w / 2 - h * 0.01:.2f}" y="{cy - h / 2 + h * 0.01:.2f}" width="{w:.2f}" height="{h:.2f}" '
            f'viewBox="{x0} {y0} {w0} {h0}" overflow="visible">{snake_inner(v, uid, colors_as_vars=False)}</svg>')


def ground(name, size, radius=0):
    a, b = BG[name]
    r = f' rx="{radius}"' if radius else ''
    return (f'<defs><radialGradient id="g{name}" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="{a}"/>'
            f'<stop offset="1" stop-color="{b}"/></radialGradient></defs>'
            f'<rect width="{size}" height="{size}"{r} fill="url(#g{name})"/>')


def icon(name, kind):
    S = 512
    if kind == 'any':        # 192 / 512 / apple-touch: full square, the OS rounds it
        body = ground(name, S) + snake_at(name, False, 256, 258, 372, f'i{name}')
    elif kind == 'maskable':  # snake kept inside the 80% safe circle
        body = ground(name, S) + snake_at(name, False, 256, 258, 300, f'm{name}')
    elif kind == 'tile':      # browser tab / small sizes: rounded tile, small-size snake, fills the square
        body = ground(name, S, 104) + snake_at(name, True, 256, 258, 430, f't{name}')
    elif kind == 'tiny':      # 16 / 32 px tab icon
        body = ground(name, S, 96) + snake_at(name, 'tiny', 256, 258, 446, f'y{name}')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">{body}</svg>'


if __name__ == '__main__':
    os.makedirs(OUT + 'png', exist_ok=True)
    jobs = []
    for n in ['A', 'B']:
        for kind in ['any', 'maskable', 'tile', 'tiny']:
            f = OUT + f'icon-{n}-{kind}.svg'
            open(f, 'w').write(icon(n, kind))
        open(OUT + f'favicon-{n}.svg', 'w').write(icon(n, 'tile'))
        for sz in [16, 32, 48, 96]:
            jobs.append(dict(svg=OUT + f'icon-{n}-{"tiny" if sz <= 32 else "tile"}.svg', out=OUT + f'png/favicon-{n}-{sz}.png', w=sz, h=sz))
        for sz, nm in [(180, 'apple-touch-icon'), (192, 'icon-192'), (512, 'icon-512')]:
            jobs.append(dict(svg=OUT + f'icon-{n}-any.svg', out=OUT + f'png/{nm}-{n}.png', w=sz, h=sz))
        jobs.append(dict(svg=OUT + f'icon-{n}-maskable.svg', out=OUT + f'png/icon-maskable-512-{n}.png', w=512, h=512))
    json.dump(jobs, open(W + 'jobs-icons.json', 'w'))
    print(len(jobs))
