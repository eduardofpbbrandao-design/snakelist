# Opening audit + cinematic opening + country card (preview)

Area "opening". Everything new here is behind a **preview switch**; with the switches off SnakeList looks and behaves as
before, except for two root-cause fixes (a pale stripe and a pale first frame, below) that remove artefacts without changing
the design.

| What | How to see it | Live? |
|---|---|---|
| Cinematic opening | `?opening=cinematic`, or `?preview=cinematic`, or Settings > Previews > Cinematic opening | preview only |
| Curated hero pool (22 photos) | used by the cinematic preview | preview only |
| Country card | `?preview=country`, or Settings > Previews > Country card | preview only |
| Pale stripe on the right of the opening (computers) | every opening | **fixed live** |
| Pale first frame before the opening appears | every opening | **fixed live** |

`?opening=wall` / `?opening=off` / `?preview=cinematic-off` turn the cinematic preview off again (`?opening=collage` too: the
collage preview steps aside while the cinematic one is on).

## 1. The current opening, frame by frame

Recorded with Chrome's screencast (Playwright CDP) at 1440x900, first and returning visits, at normal speed and with all
animations slowed to 0.25x (`Animation.setPlaybackRate`) to see every step; plus timed screenshots. The test machine was
heavily shared (load average 15-18 on 4 cores, several other browsers running), so absolute times below are slow; what matters is
*what* happens and in what order.

Findings (old "wall" opening):

1. **Pale stripe down the right edge, for the whole opening (computers).** `html { scrollbar-gutter: stable }` keeps a strip
   for the scrollbar while the opening locks scrolling (`sl-intro-lock`, `overflow: hidden`); that strip is painted with the page's
   own light background, so a ~10 px column of rgb(195,221,176) sat next to the dark green opening in every frame (measured on the
   screenshot: x = 1430-1439 at 1440 px wide). **Root cause fixed live**: `html.sl-intro-lock { background: #06140b }` (the opening's
   darkest green; verified: the strip now reads rgb(6,20,11)). Phones/tablets have overlay scrollbars and never showed it.
2. **Logo before the photos (empty wall).** The logo's fade (`fade-up`, 0.22 s) and the tick (`box-in` 0.28 s, `tick-wipe`
   0.42 s) run on their own CSS clocks from the first frame, while each wall photo waits for its own decode (`ph-wait` pauses it).
   On a busy device the logo and tick finished on a plain dark green screen and the eight photos arrived together later (in one
   recording: 0.5-3.6 s logo only, then the wall in one go - a frame-to-frame change of 31.6/255 between two consecutive captured
   frames 0.56 s apart). Shared cause: ~12 independent clocks (wall-in 1.6 s, ph-in x8 with their own delays, wall-drift 16 s,
   intro-light 1.4 s, sheen 3.2 s, fade-up, box-in, tick-wipe, tick-detail, the 2.1 s JS release timer, the 50 ms "calm" polling,
   the 1.8 s / 4.5 s fallbacks, the rAF glide, the 0.22 s finish timeout, the hero's 3.2 s CSS settle, the 15 s watchdog), none of
   which knows about the others.
3. **Long hold on the finished wall.** The glide waits for the page to be read in and calm (`calmly()`), up to 4.5 s; on the
   shared machine the static wall held for 4-6 s before the glide (screencast: frames 4.2-9.0 s unchanged).
4. **Long tasks during the glide.** `tests/opening-continuous.js` against the unchanged page (copied to `base.html`) on this
   machine: long tasks of 513-2065 ms (at 4x CPU slowdown) while the logo glides onto the photo, and on the first visit a
   6.77/255 change after the hand-over (the test allows 3). The glide is frame-stepped (rAF on the main thread), so it pauses
   rather than jumps - but it does pause.
5. **A pale first frame.** In a Playwright video of a first load (desktop), the frame after the blank pre-navigation page showed
   SnakeList's light background gradient (`.sl-root`, `--bg-grad`) for a moment before the dark opening appeared: the browser
   painted the page before the opening's own element had arrived. **Root cause fixed live**: the head script that already knows
   whether the opening will play (no `?sp=` link, not coming back, not a quick reload) adds `sl-intro-lock` at once, and while it is
   on `html`, `body` and `.sl-root` have the opening's darkest green (`#06140b`). The opening's script keeps the class and removes it
   at the end exactly as before. Re-recorded: the first painted frame is now dark (mean grey 15/255 desktop, 34/255 phone; the only
   white frame left is the browser's own blank page before navigation).

What was not changed live: findings 2-4 are timing behaviour of the approved opening; changing them changes how it looks, so
they are only solved in the cinematic preview (one timeline, compositor-driven, see below).

## 2. Cinematic opening (preview "cinematic")

Code: `snakelist-synced.html`, block `sl-cine-css` + the script after it (between the collage preview and the opening's own
script), the Settings rows (`#sl-set-cine`), and a 3-line hand-over in the opening script (`if (window.SL_CINE && lockOn)`).

Sequence (full version, first visit; times from the first frame on a fast device):

| t | beat |
|---|---|
| 0 | Dark tropical night from the first frame (never black): radial green-black sky, three depths of original leaf/frond silhouettes framing the middle (drawn in SVG by the script, seeded so it is always the same forest), two drifting mists, three faint light shafts, 13 drifting motes. The forest pushes in slowly. Skip and Sound buttons are there at once. |
| ~0.7 s (once the page is read in and calm, at most 4.5 s) | **Assembly.** The snake-"S" slithers in from the lower left on a winding curve from close to the camera; n-a-k-e-L-i-s-t come in one after another from both sides, above and below, some from far away (small) and some from close (large), each on a cubic curve, rotating into place. |
| +1.13 s | The **tick** swings in from the upper right in a wide arc, lands a little past its size and settles; the whole wordmark gives a small nod (scale 1.022) - lock at +1.95 s. Soft chime here if sound is on. |
| lock (+ photo decoded, page calm - at most 3 s / 2.5 s more) | **Gold light**: a #F2D58A bloom (radial gradient, peak opacity 0.85, no white) grows from the logo and fades over 1.5 s. |
| +0.16 s | **Reveal**: the dark sky fades and a soft iris (a radial-gradient hole, scaled 0.92 -> 2.5) opens outward from the centre while the three foliage layers fly past the camera (scale 1.35/1.6/2.1 and fade) - the light reveals the opening photo; the photo itself settles from 1.07 to 1 (the existing focus-pull). |
| +0.42 s | The wordmark glides (1.05 s) onto the photo's own identical logo; on landing the photo's logo is shown under it and the opening fades in 0.22 s (no crossfade between two logos). |
| then | The photo screen: logo, the short line ("Explore, identify and discover all 4,243 snake species..."), the **Explore the species** button, the snake's name and credit. |

By design about 4.4 s from the first frame to the hand-over when the page is calm (0.7 s forest + 1.95 s assembly + ~1.7 s
light/reveal/glide), plus up to 1 s for the words and the Explore button to fade in; the returning-visitor version runs at 0.55x
duration (~2.5 s). Settings > Display > Opening > **Replay** plays the whole one again from the top.

**Measured here (be careful with these):** the test machine was shared by several agents running browsers (load average 15-28
on 4 cores - roughly a 4-7x slower CPU). There the page's own start-up work produced long tasks for ~12-15 s after loading, with or
without the cinematic opening (same totals: 3.4-5.8 s of long tasks in the first 12 s either way), so the two waits for a calm page
(at most 4.5 s before the assembly, 2.5 s before the light) were hit and the sequence stretched to ~10-14 s from assembly to
hand-over; the unchanged opening's own timing checks fail the same way on this machine (section 1, item 4). Every functional check
passes; the timing checks (no long task > 100 ms in the sequence, 2.5-7.5 s duration) need a re-run on a quiet machine or a real
device before this is judged.

How it is built (and why it fixes the shared causes):

* **One timeline**: every moving thing is a Web Animation (`element.animate`) on `transform`/`opacity` only, created from one
  table of times. There are exactly two sync points, both waiting on real things instead of timers: (A) the assembly finished,
  and (B) the photo is decoded - then the reveal starts. Because Web Animations on transform/opacity run on the compositor, the
  page still arriving cannot make the letters stutter; a busy main thread can only delay a sync point (the scene keeps moving).
* **No full-screen blur, no filters animated.** The bloom and the iris are gradients, scaled; the letters keep the opening
  logo's static drop-shadow.
* **The logo is the opening's own**: the wordmark (`.intro-line`, already sized to the photo's logo) is cloned into 10 pieces,
  each clipped to one glyph (measured with `Range.getClientRects`) - so the assembled logo is pixel-identical to the real one,
  gradient, shadow and rattlesnake tick included, and the hand-over to the photo's logo is invisible.
* **Preload**: the opening photo is already preloaded at the top of the page; the reveal waits for `img.decode()` (max 3 s); if
  the photo fails, the next pool photo is tried; if that fails, the light opens onto the photo screen's own green (no broken image).
  The logo waits for its built-in font (max 0.3 s).
* **Interruptible**: Skip (button, Esc, Enter, a tap) plays whatever is left 4x faster (nothing cut, nothing jumps) and ends on the
  photo; a scroll/swipe/arrow-down ends it the same way and then carries on down into SnakeList (as the old opening does); a
  species link (`?sp=` etc.), coming back, or a reload within a minute: no opening at all. The page never scrolls during it
  (`sl-intro-lock`) and is never moved to the top afterwards (it is already there). The watchdog (15 s) still applies.
* **prefers-reduced-motion** (or Settings > reduce motion): the scene is still, the logo fades in where it is (no flights), then a
  plain fade to the photo.
* **Safe areas**: Skip/Sound use `env(safe-area-inset-*)`; checked at 390x844, 1180x820, 1440x900, 2560x1080 (the assembled logo
  fits the screen, the buttons are inside it).
* **Sound (optional, off by default)**: synthesised with Web Audio, no files - a breeze (filtered noise with a slow swell),
  insects (a narrow high band of noise pulsing at 31 Hz in slow waves), now and then a bird (2-4 falling notes, panned), and a
  soft four-partial chime at the lock. It only starts after a tap/key (browser rule) and only if you switched it on (the Sound
  button, or Settings > Opening sound; remembered as `sl-cine-sound`). Quiet (master 0.55, fades in 1.4 s, out 1.6 s), suspended
  while the tab is hidden, fades out when you go into SnakeList (or 14 s after the opening), and never plays while the Christmas
  music or fire is on (`SL_XMAS_AUDIO.state()`, checked every second - it steps aside).
* **Christmas**: the photo screen and its Santa hat are the existing ones (the hat is placed on the hero photo when it loads),
  so hats keep working; pool photos without hat data simply get none. The collage preview is skipped while this one is on.

Files/keys: `sl-art-preview-cinematic`, `sl-cine-seen` (short version next time), `sl-cine-sound`, session `sl-cine-replay`.

## 3. Hero photo pool (`data/hero-pool.json`)

22 photos, all `commercialOK` (CC0 / CC BY / CC BY-SA with credit) in `data/photo-licences.json` terms, living snakes in natural
surroundings, eye or head clearly visible, no handling, no dead or feeding animals, species as in SnakeList:

* 12 of the existing opening photos (left out: the Smooth Green Snake - licence unknown, permission needed; the Central Plains
  Milksnake and Texas Coral Snake - head too small for an opening).
* 10 new ones from the species photos' own commercially licensed iNaturalist originals, cropped to the opening's 2560:1658 shape
  and saved at 900/1400/1920 px (smaller originals: up to their own width): Eyelash Viper, Banded Krait, Common Bamboo Viper,
  Boomslang, Four-lined Snake, Red-Tailed Racer, Grass Snake, Australian Black Snake (*Pseudechis porphyriacus*), Wagler's Pit
  Viper, European Adder. Each focal point was checked on the cropped photo. Credits are in the JSON (shown on the photo screen).

Each entry has the focal point (the eye/head as fractions of the photo), `crop.phone` (the object-position for upright phones)
and `crop.desktop`. The page carries a copy (`SL_HERO_POOL` markers) written by `tools/hero_pool.py`. Stable for the visit
(`sl-hero-now`), never the same as last visit (`sl-hero-last`); the very first visit opens on the Asian Vine Snake.

**Suggestion**: use the pool live too - it is the existing rotation minus the one photo whose licence is unknown, plus ten strong
new ones. Switching it on for everyone is one line (`if (CINE)` -> always) once Eduardo has looked through the photos (thumbnails
are in `species-photos/hero/thumb/`). Before that, the Smooth Green Snake first-visit rule should be dropped, because its licence
is still unknown.

## 4. Country card (preview "country")

A compact card at the top of the Species Checklist (under the photo screen, not over it, not a pop-up):

* **Known country**: "Explore snakes in Portugal" + "11 species" (the checklist's own count for that country under the current
  filters - the exact number the list shows) + `[See snakes]` `[Change country]`.
* **Unknown**: "Find snakes in your country" + `[Choose country]` -> a searchable country list (type, arrow keys, Enter), each with
  its species count or "no snakes recorded".
* The country is your choice if you made one (`sl-cc-pick`, never overwritten by detection) or else the approximate country from
  the internet address (the existing "See snakes from" lookup, only after the opening has finished). A detected country is
  correctable with Change country.
* **See snakes** applies the checklist's own country filter: the card becomes "Snakes of Portugal - 11 species in the checklist
  below", with a `Portugal x` chip that takes the filter off and **View on map** (the Map on that country). The normal Active
  filters row shows it too.
* **Empty**: "No snakes recorded in Iceland - SnakeList has no records of wild snakes living there."
* No location is asked for unless you press **See snakes near me** (then the Map's own location question opens).
* While the card is on, the "See snakes from" corner panel does not also appear.

## 5. Tests

* `tests/opening-cinematic.js` - long tasks during the sequence, Skip, scroll during the sequence, returning (short), reload (no
  replay), reduced motion, species link, preview off (old opening untouched); 4 screen sizes; optional webm videos.
* `tests/country-card.js` - preview off, PT detected, See snakes filter + heading + chip + View on map, unknown + search,
  manual choice kept over detection, Iceland, no geolocation, desktop + phone.
* Re-run: `data-safety.js`, `opening-continuous.js`, `hero-scroll.js`, `ip-country.js`, `previews.js` (results in the hand-over
  report; the machine was shared and heavily loaded, so timing checks were compared with the unchanged page run the same way).
