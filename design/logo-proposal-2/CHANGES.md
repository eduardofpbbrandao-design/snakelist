# SnakeList logo proposal, round 2

This is a proposal only. Nothing on the live site changes until Eduardo picks A or B.

Round 1 was rejected because it started from old files in `brand/` and not from the real logo.
This round starts from the logo in `snakelist-synced.html`:
- the `#mark-snake` snake S
- the "SnakeList" lettering in "SL Mark" with `--mark-grad` and `--mark-shadow`
- the `.sl-tick` rattlesnake-tail checkmark

The "current" renders are screenshots of the running site. The A and B renders are the same running site with each option's changes put in place for the screenshot only (`shot-site.js` replaces `#mark-snake` and adds the CSS below).

## What stays the same in A and B
- **Snake S:** the body outline is the same path, and the 11 oval spots keep their positions and angles. The head shape is unchanged (it is only scaled) and the forked tongue stays.
- **Rattlesnake tick:** the geometry is identical, including the tapered stroke, the six dark diamonds and the six rattle segments. Its colours stay the same: `--sl-check #5fb246` and `--sl-tpat #1e3a24`.
- **Lettering:** same font ("SL Mark" / EB Garamond 600, with "List" at 500) and the same letter-spacing.
- **Colours:** the same green gradient family. Dark mode keeps today's gradient (A) or a brighter version of it (B).

## What would change on approval (in `snakelist-synced.html`, then `python3 build-site.py`)

### Both options
1. **Spots:** the `#mark-snake` spots are painted as one group at a single opacity, using `fill: var(--sl-pat-solid)` with group opacity in place of one semi-transparent fill per spot. Overlapping spots no longer form darker smudges. The spots shrink a little (A ×0.87, B ×0.93), so each one stays separate at small sizes.
2. **Head:** the head is scaled up from its back edge (A ×1.10, B ×1.18). A thin dark edge, clipped to the body, is drawn where the head lies over the coil, so the head reads as a head. The eye is bigger (r 4.26 → A 5.0, B 5.8) and has a small white highlight.
3. **S size:** `.snake-s` gets a wider viewBox (`-23.5 2 153 145.5` for A, `-23.5 2 158 145.5` for B) so the tongue is no longer clipped. Its height goes from 0.71em to 0.75em (A) or 0.79em (B), on `.sl-titletext`, `.hero-mark`, `.hero-title.hero-wm` and `.intro-title`. `margin-right` is adjusted to -0.012em / -0.013em.
4. **Space before the tick:** `.sl-tick` `margin-left` goes from 0.071em to 0.135em (A) or 0.16em (B), with the same change on `.hero-title.hero-wm .sl-tick` and `.intro-box`. For B the tick is 0.72em tall in place of 0.70em, so the `.intro-box` width and height calc needs the same 0.72em.
5. **Snake colour:** `--sl-snake` goes from #58b351 to #5bb853 (A) or #5fbf56 (B), a touch brighter. `--sl-eye` goes from #1b412b to #163a24 (A) or #123320 (B). A new variable is added: `--sl-pat-solid` (#1a412b for A, #173d27 for B).
6. **Lettering gradient, light mode:** `--mark-grad` gets slightly deeper toward forest green.
   - A: `#8fd672 / #66b94e / #4f9f3f 32% / #2f7426`
   - B: `#84cc69 / #5bab46 / #45923a 32% / #276522`

   Dark mode keeps today's gradient for A and uses a slightly brighter one for B, so the name never sinks into the dark page.
7. **Opening screen:** `.sl-hero` keeps the brighter gradient over the photo.
8. **My Sightings tab icon:** `#tab-sightings .snake-s` gets `--sl-pat-solid: rgba(0,0,0,0.45)`, so the one-colour tab icon keeps its spots.
9. **Icons:** these files are replaced:
   - `favicon.svg` and `favicon.ico` (16/32/48)
   - `app/favicon-48-s.png` and `app/favicon-96-s.png`
   - `app/apple-touch-icon-s.png` (180)
   - `app/icon-192-s.png` and `app/icon-512-s.png`
   - `app/icon-maskable-512-s.png`

   They come from `icon-<X>-{any,maskable,tile,tiny}.svg`. Sizes of 16 and 32px use the "tiny" art: fewer spots, a bigger eye and no tongue. 48 and 96 use the "tile" art.
   - **A:** the snake on the same pale field-guide paper as today's icon, with a slightly stronger edge.
   - **B:** the snake on SnakeList's own forest green (#2a7049 → #164229), with the snake lifted to #66c75c.
10. **Version:** bump `.sl-ver` by +0.01. Run `python3 build-site.py` and republish the claude.ai artifact, as CLAUDE.md asks.

## Files here
- `logo-choice.html`: the comparison page (self-contained).
- `sheet.png`: Current, A and B side by side.
- `snakelist-logo-{A,B}-{light,dark}.svg`: the full logo, with the font embedded.
- `snake-s-{A,B}.svg` and `snake-s-{A,B}-small.svg`: the snake S on its own.
- `icon-{A,B}-{any,maskable,tile,tiny}.svg`, `favicon-{A,B}.svg` and `favicon-{A,B}.ico` (16/32/48).
- `png/`: every PNG size (16/32/48/96 favicons, 180 apple-touch, 192, 512, maskable 512, wordmark renders at 1x/2x).
- `current/`: screenshots of today's live logo and copies of today's icons, for reference.
- `tools/`: the scripts that made all of the above. `gen.py` holds the snake/tick art, `harness.py` the CSS per option, and `shot-site.js` takes the real-site previews.
