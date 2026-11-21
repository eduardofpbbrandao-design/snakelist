#!/usr/bin/env python3
# Makes the 3D viewer's close-up ground detail (species/3d/env/detail-<ground>.webp) from Poly Haven textures (CC0 1.0,
# https://polyhaven.com): for each kind of ground one photographed surface - its 1k colour map and its OpenGL normal map -
# packed into one 1024 px image: red and green = the normal's x and y, blue = the colour's brightness around its mean
# (high-passed; 0.5 = no change). viewer.js keeps the habitat's own colours and only takes the fine detail from it, close to the camera.
# Run (dev only, needs network): python3 tools/ground_detail.py
import io, os, json, urllib.request
from PIL import Image, ImageStat, ImageFilter, ImageChops
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'species', '3d', 'env')
# ground kind (models.json scene.ground) -> Poly Haven texture; its real width is in CREDITS.txt and viewer.js DETAIL
KINDS = {
    'litter': 'leaves_forest_ground', 'soil': 'brown_mud_leaves_01', 'gravel': 'red_laterite_soil_stones',
    'heath': 'forrest_ground_01', 'pebbles': 'damp_sand', 'dry': 'brown_mud_dry', 'sand': 'dense_sand',
    'gibber': 'red_mud_stones', 'rock': 'rock_04',
}
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'texture-fetch'}), timeout=120).read()
import sys
for kind, name in KINDS.items():
    if len(sys.argv) > 1 and kind not in sys.argv[1:]: continue
    files = json.loads(get('https://api.polyhaven.com/files/' + name))
    diff = Image.open(io.BytesIO(get(files['Diffuse']['1k']['jpg']['url']))).convert('L').resize((1024, 1024), Image.LANCZOS)
    nor = Image.open(io.BytesIO(get(files['nor_gl']['1k']['jpg']['url']))).convert('RGB').resize((1024, 1024), Image.LANCZOS)
    # only the fine detail (a high-pass: the brightness against its own blur over ~3 cm), so no big blotches fight the
    # habitat's painted ground; 128 = no change
    blur = diff.filter(ImageFilter.GaussianBlur(20))
    lum = Image.eval(ImageChops.subtract(diff, blur, 1.0, 128), lambda v: max(0, min(255, int(round(128 + (v - 128) * 1.15)))))
    r, g, _ = nor.split()
    Image.merge('RGB', (r, g, lum)).save(os.path.join(OUT, 'detail-' + kind + '.webp'), 'WEBP', quality=78, method=6)
    print(kind, name, os.path.getsize(os.path.join(OUT, 'detail-' + kind + '.webp')))
