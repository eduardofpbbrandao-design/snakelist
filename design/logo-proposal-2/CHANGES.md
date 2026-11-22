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
2. **Head:** the head is scaled up from its back edge (A ×1.10, B ×1.07; round 2d: B was ×1.18, made smaller at Eduardo's request). A thin dark edge, clipped to the body, is drawn where the head lies over the coil, so the head reads as a head. The eye is bigger (r 4.26 → A 5.0, B 5.4) and has a small white highlight.
3. **S size:** `.snake-s` gets a wider viewBox (`-23.5 2 153 145.5` for A, `-23.5 2 156 145.5` for B) so the tongue is no longer clipped. Its height goes from 0.71em to 0.75em (A) or 0.79em (B), on `.sl-titletext`, `.hero-mark`, `.hero-title.hero-wm` and `.intro-title`. `margin-right` is adjusted to -0.012em / -0.0021em.
4. **Smaller tick, more space before it (round 2b, Eduardo's request):** the tick is about 12% smaller, so the snake S gets the most attention. Its height goes from 0.70em to 0.62em (A) or 0.63em (B), on `.sl-tick` and `.hero-title.hero-wm .sl-tick`. `.intro-box` gets the same height, with width `calc(<h> * 36.9 / 36)`. The shape, diamonds, rattle and colours do not change, and it stays on the baseline (`translateY(0.02em)` is kept). `margin-left` goes from 0.071em to 0.12em (A) or 0.135em (B).
   - **B only, longer tongue (round 2c, Eduardo's request):** B's forked tongue is about 35% longer and its fork is a little wider. In head coordinates the stem runs `M24.6 2.2 L33.2 3.9` and the forks end at `38.4 1.3` and `38.4 7.3`; the colour and stroke widths are unchanged.
     - B's viewBox widens to `-23.5 2 156 145.5`, so the tongue tip stays inside the logo.
     - `.snake-s` `margin-right` goes to -0.0021em. This cancels the wider viewBox, so the S size and the gap before "nake" are unchanged.
     - The 16/32/48/96 px favicons keep no tongue.
5. **Snake colour:** `--sl-snake` goes from #58b351 to #5bb853 (A) or #5fbf56 (B), a touch brighter. `--sl-eye` goes from #1b412b to #163a24 (A) or #123320 (B). A new variable is added: `--sl-pat-solid` (#1a412b for A, #173d27 for B).
6. **Lettering gradient, light mode:** `--mark-grad` gets slightly deeper toward forest green.
   - A: `#8fd672 / #66b94e / #4f9f3f 32% / #2f7426`
   - B: `#84cc69 / #5bab46 / #45923a 32% / #276522`

   Dark mode keeps today's gradient for A and uses a slightly brighter one for B, so the name never sinks into the dark page.
7. **Opening screen:** `.sl-hero` keeps the brighter gradient over the photo.
   - **Brighter "List" on dark grounds (round 2b, Eduardo's request):** "List" gets its own sweep in dark mode, on the opening photo and in the opening animation, so it no longer fades into the dark end of the word's gradient. The rule is:

     ```css
     [data-sl-theme="dark"] .sl-titletext em,
     .sl-hero .sl-titletext em,
     .sl-hero .hero-title.hero-wm .sl-titletext em .hl,
     .intro-title em {
       background-image: <list-grad>;
       background-clip: text;
       -webkit-text-fill-color: transparent;
     }
     ```

     - A: `radial-gradient(circle at 30% 40%, #74c85a, #62b84d 45%, #53a744)`
     - B: `radial-gradient(circle at 30% 40%, #7acb5f, #68bd51 45%, #58ad46)`

     It stays in the same green family, and the weights are unchanged ("nake" 600, "List" 500). Light mode keeps the deeper "List" so it stays readable on pale paper.
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
