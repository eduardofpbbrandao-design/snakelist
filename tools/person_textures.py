#!/usr/bin/env python3
# Makes the person's textures for the 3D viewer's "Size vs person" (species/3d/person/*.webp) from the
# Microsoft Rocketbox avatar "Male_Adult_05" (MIT licence, https://github.com/microsoft/Microsoft-Rocketbox):
# the 2048 px TGA maps are reduced (the face 1024 px, the rest 512 px: about 10 MB on the graphics card) and saved as WebP (colour, normal; the hair cards' colour with its alpha).
# Run (dev only): python3 tools/person_textures.py <folder with the m009_*.tga files>
import sys, os
from PIL import Image
src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'species', '3d', 'person')
os.makedirs(out, exist_ok=True)
def tga(n): return Image.open(os.path.join(src, 'm009_' + n + '.tga'))
jobs = [  # (source, output, size, mode, quality)
    ('head_color', 'head.webp', 1024, 'RGB', 86),
    ('head_normal', 'head_n.webp', 512, 'RGB', 90),
    ('body_color', 'body.webp', 512, 'RGB', 88),
    ('body_normal', 'body_n.webp', 512, 'RGB', 90),
    ('opacity_color', 'hair.webp', 512, 'RGBA', 90),
]
for n, o, s, mode, q in jobs:
    im = tga(n).convert(mode).resize((s, s), Image.LANCZOS)
    if mode == 'RGBA':  # (the colour where the cards are clear is never seen: flatten it so it packs small)
        px = im.load()
        for y in range(s):
            for x in range(s):
                r, g, b, a = px[x, y]
                if a < 6: px[x, y] = (58, 44, 34, 0)
    im.save(os.path.join(out, o), 'WEBP', quality=q, method=6)
    print(o, os.path.getsize(os.path.join(out, o)))
# the head's roughness (green channel, as three.js reads it) from its specular map: glossy eyes and lips, matte skin
sp = tga('head_specular').convert('L').resize((256, 256), Image.LANCZOS)
rough = sp.point(lambda v: int(max(0.12, min(0.8, 0.78 - (v / 255) * 1.1)) * 255))
Image.merge('RGB', (rough, rough, rough)).save(os.path.join(out, 'head_r.webp'), 'WEBP', quality=88, method=6)
print('head_r.webp', os.path.getsize(os.path.join(out, 'head_r.webp')))
