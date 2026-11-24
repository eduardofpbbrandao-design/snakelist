# 3D species inventory

## v6.26: skin, contact, heads by species, movement, habitats

What changed in this pass, all in `species/3d/viewer.js` unless marked. Before/after sheets (same species, pose, camera
and light): session scratchpad `batch103/3d/`.

**Skin (shader, `SKIN_SHINE_GLSL`, the scale-cell block in `map_fragment`).**
- Every body scale is its own small plate: its own tilt (about twice as much as before, less on keeled scales), its own
  specular strength (0.55-1.65x) and its own share of the gloss coat (0.3-1.4x). In any light some scales flash and their
  neighbours do not, instead of one even sheen sliding over the body.
- No specular and no gloss coat down in the skin between the scales (from the cavity map): the interstitial skin stays dull
  and dark, so each scale's outline reads in the highlights too.
- The gloss coat's normal follows each scale (0.85 instead of 0.5), so the coat breaks up scale by scale.
- Base values: roughness 0.66-0.32 (was 0.82-0.5), coat 0.18 + 0.7 x gloss (was 0.08 + 0.42 x gloss), coat roughness
  0.32-0.08 (was 0.45-0.14), IOR 1.55 (keratin), environment reflections 1.0 (was 0.85). Glossy snakes now have the crisp
  highlights of real scales; with the coat broken up per scale it is never a uniform wet film.
- The flat fill light on the skin is about two thirds of what it was (it washed colours to pastel); the contact shading
  and the darker skin between scales keep dark snakes readable.
- Belly plates: each ventral scute its own sheen and a slight tilt, a little glossier than the back.
- A fine micro-relief on each scale, faded out with distance (no shimmer far away).
- Head shields: flatter plates with a steeper edge into a narrower suture (were domed with a wide bevel - "clay"), less
  surface "wear", and as glossy as the body (the coat was cut by 55% on the head; now 20%).

**Contact and coil shading (`occSpheres`, `bakeOcc`, `SKIN_OCC_GLSL`).**
- Per vertex, once per pose: how much of the sky each point of the skin sees past the rest of the body (a chain of spheres
  along the body, the analytic sphere occlusion (r/d)^2 cos). Turns of a coil resting on each other and loops crossing the
  body darken where they touch. About 233k vertices on High; candidate spheres are found once per ring with a hash grid.
- The ground's share is worked out in the shader from the skin's height above the ground and which way it faces, so it
  follows the body when it moves. The baked coil share fades where the body has moved far from the pose it was baked for
  (See it eat, the idle head turn), so nothing dark is left floating.
- It cuts the indirect light (and a little of the direct), not the sun's shadows.
- The ground's contact shadow has two narrow dark passes under the soft wide one: the tight dark line where the belly
  touches.

**Heads by species (`HEAD_SET_SRC`).** 145 of the best-known species have hand-set heads: depth, snout width and height,
eye size and place, cheeks, loreal hollow, crown, brow, upturned snout, mouth-line curve. A hand-set depth is met both ways
(the puff adder's and Gaboon viper's heads are now flatter than their group's; tiger snake, ball python and green tree
python deeper). The coral snakes (Micrurus fulvius, M. tener, Micruroides) no longer have their red belly colour painted
on their lip scales: the snout is black, as in the photos.

**Mouth line (`lipBend` in `buildHeadSkin`).** The lips are no longer a straight cut: the line dips a little under the eye
and rises again to the corner of the mouth (`head.smile`, by group: 0.08 mambas, 0.05-0.06 colubrids and vipers, 0.02 sea
snakes, 0 sand boas). It is zero at the snout tip and at the jaw hinge, so Open mouth hinges exactly where it did.

**Movement (`extras.js` idle life, `flick` in `buildMouth`).**
- Breathing: each breath its own length (in 1.3-2 s, out 1.9-2.8 s), depth (0.65-1.1) and pause (1.5-5 s). It starts
  breathed in, so the body first settles as the view opens. Was a fixed 6.5 s cycle.
- Tongue: each flick its own length (0.55-1.15 s), reach (70-100%) and number of tip waves (2.4-4.8); one, two or now and
  then three in a row, 3.5-10.5 s apart.
- Tree pythons and tree boas (drape pose): each U-turn under the branch is tight, its two sides lying against each other,
  and hangs less deep. Before, every loop had a gap of more than a body width inside and read as a ring threaded on the
  branch.
- Sea snakes lie about two thirds under the surface (at least 1.45 x the half-depth; the yellow-bellied sea snake's
  profile had 0.3, which floated it on top like a toy), and the water is a little less clear.

**Habitats (`nature.js`, `SCENES` and the props in `buildScene`).**
- Grass near the snake (out to about 5 m or 1.5 x the near ground) is many narrow cards round each tuft's centre instead of
  two or three crossed cards over a metre wide that stood in the foreground as big flat cards. Further out the cheap wide
  clumps stay.
- The sea floor and reef: real reef colours (pale coral heads, ochre and grey rubble, dark rock) tinted only a little by the
  water, flatter shapes, the sand's grain and moving caustics. They were mixed 40% with blue: cartoon-blue pebbles.
- Soil (986 species: blind snakes and other burrowers): moist crumbly soil with many small dark leaf fragments (no whole
  leaves as big as the snake lying flat like stickers), dull crumbs (their highlight read as water drops), fine rootlets
  painted and in 3D, clods half sunk in the soil, small moss cushions, and the flat stone it was found under lying close by.
- Desert stones are a weathered red-tan instead of brick red (they read as a scatter of chocolate drops). (Lighting the
  deserts with the clear-sky panorama was tried and dropped: the sand and the snakes on it came out washed pale.)


How the 4,243 3D models in `species/3d/models.json` get their shape, which shared rules cover each group, and which
species were looked at one by one. Colours and patterns are unchanged from the v6.13 photo audit
(`data/snake-model-audit.json`, `tools/3d-audit-log.md`).

## How a model is built

`normProfile` in `species/3d/viewer.js` turns each profile into a full model in this order:

1. Body plan defaults (`PLANS`: viper, pitviper, python, colubrid, elapid, blind, sea).
2. Head group by genus (`HEAD_FORM` / `HF_GENUS`): head length range, length-to-width ratio, head width against
   the body, head width against the neck.
3. **v6.20** body build by genus (`BUILD_GENUS`): tree snakes deeper than wide with sloping sides (`body.tri`,
   `body.xs`), kraits with a raised vertebral ridge.
4. **v6.20** head depth and sculpting by group (`HEAD_FORM.hl`, `cheek`, `lor`, `crown`):
   - `hl`: head depth (crown to chin) over head length. The head is made deeper to reach it, but never deeper than
     it is wide (burrowers and blind snakes 1.1).
   - `cheek`: jaw-muscle swelling low at the back of the head (non-vipers; vipers keep their `jowl`).
   - `lor`: the loreal hollow between nostril and eye, under the canthus.
   - `crown`: a slight dome over the parietals.
   Each value can be set per species as `head.hl`, `head.cheek`, `head.lor` or `head.crown`.
5. Per-species overrides: hand-made profiles (`data/snake-models.json`), `CURATED` in `tools/auto_models.py`, and
   `SPECIES_LOOK` in the viewer.

## Groups and what they get

The counts come from running the real generator over all of `models.json` (`groups.mjs`, scratchpad). "Neck deeper"
counts the models whose neck, 1.4 head lengths back, was deeper than the head, so the neck rose above the head in
profile.

| Group (genera) | Models | Head depth/length, before -> after | Neck deeper than head, before -> after | cheek / lor / crown | Tree-snake body section |
|---|---|---|---|---|---|
| colubrine (other colubrids) | 1964 | 0.36 -> 0.43 | 1946 -> 1 | 0.045 / 0.02 / 0.045 | 146 (arboreal genera) |
| natricine (water and garter snakes) | 235 | 0.36 -> 0.44 | 0 -> 0 | 0.05 / 0.022 / 0.05 | - |
| broad (cat, snail-eating, hognose) | 248 | 0.33 -> 0.46 | 184 -> 0 | 0.08 / 0.018 / 0.06 | 54 |
| vine (Ahaetulla, Oxybelis, Thelotornis...) | 51 | 0.24 -> 0.33 | 8 -> 0 | 0.05 / 0.035 / 0.03 | 51 |
| burrow (Atractaspis, pipe and shieldtail snakes, Calamaria...) | 222 | 0.36 -> 0.49 | 222 -> 88 (most burrowers have no distinct head) | 0 / 0 / 0.02 | - |
| elapid (other elapids) | 277 | 0.36 -> 0.44 | 270 -> 18 | 0.055 / 0.014 / 0.05 | 16 (kraits) |
| cobra (Naja, Ophiophagus, Hemachatus...) | 46 | 0.37 -> 0.42 | 46 -> 46 (the neck is where the hood starts; cobra heads are barely distinct) | 0.04 / 0.012 / 0.04 | - |
| mamba (Dendroaspis) | 4 | 0.28 -> 0.40 | 4 -> 0 | 0.035 / 0.03 / 0.035 | - |
| sea snakes | 84 | 0.34 -> 0.42 | 84 -> 84 (the body is laterally flattened, so this is expected) | 0.02 / 0 / 0.03 | - |
| viper (true vipers) | 84 | 0.39 -> 0.39 | 0 -> 0 | jowl / 0.03 / 0.02 | 19 (Atheris) |
| bitis (Bitis, Cerastes...) | 26 | 0.43 -> 0.44 | 0 -> 0 | jowl / 0.025 / 0.015 | - |
| pitviper | 291 | 0.40 -> 0.41 | 0 -> 0 | jowl / 0.04 / 0.02 | 82 (Trimeresurus, Bothriechis...) |
| python | 166 | 0.32 -> 0.42 | 6 -> 0 | 0.07 / 0.03 / 0.05 | 9 (Morelia) |
| boa | 48 | 0.30 -> 0.44 | 1 -> 0 | 0.07 / 0.028 / 0.05 | 17 (Corallus, Sanzinia, Candoia) |
| sandboa | 19 | 0.38 -> 0.47 | 19 -> 18 | 0.02 / 0 / 0.03 | - |
| blind snakes | 478 | 0.81 -> 0.82 | (no distinct head) | 0 / 0 / 0.02 | - |

Shared changes for every model:

- **Head-to-body transition.** The head shields, the sculpted head relief and the body's scale relief now fade out
  over a fifth of a head length. The fade is further back on the crown than on the throat, so it makes a V at the
  nape instead of a straight ring.
- **Head shields.** Sutures are finer and shallower, with less surface "wear", so the shields are smooth plates
  rather than carved wood. Python and boa head scales are smaller and flatter. Before, they were cobbles about twice
  the size of a body scale.
- **Eyes.** The family default irises are bronze to brown instead of bright gold. 4,129 models have no iris colour
  of their own. The paler zone round the pupil is subtle, not a cream ring. The iris glows about half as much, and
  the spectacle's reflections are restrained.
- **Resting coils (`stack` pose).** The coil follows a lumpy, slightly oval outline that averages to its old size. The outline is the same for every turn and is never pinched by more than the slack between turns, so the turns cannot cut into each other. Before, it was a perfect lathe-turned disc, a "tyre".
  pulled inward, so the turns cannot cut into each other. Before, it was a perfect lathe-turned disc, a "tyre".

## Species individually reviewed

For each species below, the model was rendered before and after under the same camera and light (app view, top,
side, below, face) and checked against its SnakeList photo. The sheets are in the session scratchpad:
`batch100/3dmodels/`.

| Species | Notes |
|---|---|
| Inland Taipan (Oxyuranus microlepidotus) | Identity checked: the photo and profile are O. microlepidotus (dark glossy head, olive-brown body, yellow lower flanks, 23 rows). The head is now deeper than the neck (before, it was 0.83 as deep as the neck). The dark head grades into the neck, further back along the crown (`SPECIES_LOOK.patch`). Before, it ended in a straight ring. |
| Smooth Green Snake (Opheodrys vernalis) | Kept plain, slender (ld 62) and smooth. The head is deeper (0.30 -> 0.39 depth/length) and slightly distinct from the neck. The eye stays dark. The pale lips and green transition are unchanged. |
| Gaboon Viper | Coil is no longer a perfect disc. The head was already broad and flat. |
| King Cobra, Indian Cobra | Head deeper. Cobras lie close to the neck (hn ~1.05). |
| Ball Python, Reticulated Python | Head deeper (0.29 -> 0.44). Head scales are smaller and flatter. |
| Boa constrictor, Green Anaconda, Emerald Tree Boa, Green Tree Python | Head deeper. The tree boa and python get the tree-snake section. |
| Yellow-bellied Sea Snake | Head deeper. The body section is unchanged (already compressed). |
| Brahminy Blindsnake | No change needed: no distinct head and no eyes. |
| California Kingsnake, Corn Snake, Common Garter Snake, Grass Snake | Head deeper. The cheeks and loreal hollow give a colubrid head, not a cylinder. |
| Eastern Hognose | Upturned snout kept. The broad head is deeper. |
| Boomslang | Big eye kept. The tree-snake section is applied. |
| Western Diamond-backed Rattlesnake, Russell's Viper, Eyelash Viper | Coils are irregular. The loreal hollow sits under the canthus. |
| Black Mamba | Long coffin head, now deeper (0.28 -> 0.40). |
| Banded Krait | Raised vertebral ridge and a triangular section. |

**Counts:** 24 species were individually reviewed against their photo in this pass. The other 4,219 models are covered
by the shared group rules above, not reviewed one by one. Their colours and patterns come from the v6.13 audit, which
checked 3,099 species against photos.

## Still to do

- Per-species head values for more famous species: only the taipan and Smooth Green Snake have hand-set values in
  this pass. The rest use their group's defaults.
- The drape pose of tree pythons and boas reads as closed loops when seen along the branch.
- Habitat scenes were not rebuilt in this pass. Seen in the before sheets: foreground grass cards in grass scenes,
  cartoon-blue pebbles under the sea snake, and a soil scene for blind snakes with little relief.
- Mouth-line curvature (the "smile") is still a straight line along every head. It is shared with the Open-mouth
  feature, so it was left alone.
