"""The exact site changes per option (used both for the in-site preview screenshots and CHANGES.md)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import VARIANTS, snake_inner, vbstr, W
from harness import STYLE, DARK_GRAD


def site_css(n):
    v, st = VARIANTS[n], STYLE[n]
    cur = STYLE['cur']['grad']
    return (f":root{{--sl-snake:{v['snake']};--sl-eye:{v['eye']};--sl-pat-solid:{v['pat']};--mark-grad:{st['grad']}}}\n"
            f"[data-sl-theme=\"dark\"]{{--mark-grad:{DARK_GRAD[n]}}}\n"
            f".sl-hero{{--mark-grad:{DARK_GRAD[n] if n == 'B' else cur}}}\n"
            f".snake-s{{margin-right:{st['smr']}em}}\n"
            f".sl-titletext .snake-s,.hero-mark .snake-s,.hero-title.hero-wm .sl-titletext .snake-s,.intro-title .snake-s{{height:{st['sh']}em}}\n"
            f".sl-tick,.hero-title.hero-wm .sl-tick{{height:{st['th']}em;margin-left:{st['tml']}em}}\n"
            f".intro-box{{margin-left:{st['tml']}em}}\n"
            f"#tab-sightings .snake-s{{margin:0;--sl-pat-solid:rgba(0,0,0,0.45)}}\n")


if __name__ == '__main__':
    out = {}
    for n in ['A', 'B']:
        out[n] = dict(inner=snake_inner(VARIANTS[n], 'py'), vb=vbstr(VARIANTS[n]['vb']), css=site_css(n))
    json.dump(out, open(W + 'variants.json', 'w'))
    print(out['A']['css'])
