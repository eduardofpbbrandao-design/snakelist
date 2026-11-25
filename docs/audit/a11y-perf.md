# Accessibility + performance + cards audit (area "a11y-perf")

Audited on the built site (`python3 build-site.py`, served locally) with Playwright/Chromium: the Chrome accessibility
tree (CDP `Accessibility.getFullAXTree`), Playwright aria snapshots, a CPU profile and a performance trace of the first
8-12 s, `PerformanceObserver` (long tasks, LCP, CLS) in the page, a keyboard Tab walk, and a DOM scan for nested
interactive elements. Computer (1280x860) and phone (412x915, touch), returning visitor (intro keys set) and first visit,
with and without a seeded list (708 species seen, notes, a user photo).

Status key: **FIXED** (in this branch, live - nothing looks different), **ROUTED** (another area's code - not touched
here), **OPEN** (found, not fixed).

## Measurements

The machine the measurements ran on was heavily loaded (load average 15-19 on 4 cores, other agents running browsers),
so single runs vary by +-50 %. The numbers below are medians of 3 interleaved runs, before (HEAD build) and after (this
branch), same machine, same moment. Script time is the most stable signal.

Seeded list (708 seen), returning visitor, first 9 s (median of 3; two separate A/B sessions):

| | script time | style recalc | longest task | long tasks, total | DOM | AX nodes | LCP | CLS |
|---|---|---|---|---|---|---|---|---|
| computer, before | 3.2 s / 5.6 s | 2.7 / 4.5 s | 1.06 / 2.57 s | 7.5 / 12.3 s | 30,107 | ~2,200 | ~1.0 s | 0.004 |
| computer, after  | 2.2 s / 4.5 s | 1.3 / 2.2 s | 1.14 / 1.68 s | 5.4 / 8.9 s | 30,114 | ~2,150 | ~1.1 s | 0.004 |
| phone, before    | 3.8 s / 3.9 s | 2.5 / 1.6 s | 2.45 / 1.56 s | 7.8 / 6.4 s | 30,103 | ~2,200 | ~0.6 s | 0 |
| phone, after     | 3.0 s / 2.4 s | 2.4 / 1.6 s | 1.35 / 1.10 s | 6.7 / 5.7 s | 30,100 | ~2,150 | ~0.8 s | 0 |

CPU profile, same seeded load (one run each, inclusive time): `refresh` 1,497 -> 184 ms, `countTotal` 1,321 -> 82 ms,
`renderChips` 1,140 -> 85 ms, `pick` 1,176 -> 418 ms.

Empty list (new or returning visitor, nothing seen): no measurable change - before and after are within the noise
(script 1.0-2.5 s, longest task 0.8-1.8 s in both). The chip counts were the cost that grows with your list, and
"Picked for you" only runs with something on your lists.

Long tasks after the opening: with the page open and left alone (from ~4 s after entering SnakeList, for 6 s) there was no
task over 200 ms in any run of `tests/a11y-perf.js` (computer and phone).

Raw numbers: `ab-seeded.json`, `ab-seeded-final.json`, `ab-plain-final.json`, `before*.json` / `after*.json` in the
batch109/a11y-perf evidence folder.

What did not move (and why): DOM size (~30,100 elements; the 4,243 cards are already "light" - name + two buttons - and
only 60 are shown), the accessibility tree (~2,100 nodes with 60 cards on show; the hidden cards are `display:none` and
never reach it), LCP (the opening photo) and CLS (~0). The remaining long tasks are style recalculation of the whole page
when the opening hands over to SnakeList (`__introUnhide` + `html.sl-restyle`, see "Opening" below) - that is the
opening area's code.

## Critical

- **FIXED - Chip counts walked all 4,243 cards once per chip** (`countTotal`, ~150 chips -> ~600,000 `passes()` calls on
  the first render; 1.3 s of script on a computer with a seeded list). The type / continent / family rows are now counted
  in one walk (`rowCounts`), and `passes()` only works out constriction when a constriction filter is on (it was the
  slowest part of every call). Counts verified identical to before for all 44 chips.
- **FIXED - "Picked for you" (`pick()`) re-read every card's data attributes and the filter state for every card** on
  every run (1.2 s inclusive with a seeded list, runs at start and after each filter change). The filters are now read once
  per run (`SL_PASSER`) and each card's (never-changing) data is read once and kept (`__slPk`).

## High

- **FIXED - Escape closed every open layer at once.** Each sheet has its own document-level Escape handler; with two
  layers open (e.g. Settings over a seen card's sighting sheet) one Escape closed both. A capture-phase coordinator now
  presses only the top layer's close button when two or more layers are open (verified: before = both closed, after = top
  only, next Escape closes the other).
- **FIXED - No modality.** Nothing behind a dialog was inert: Tab and screen readers walked out of Settings, the 3D viewer,
  the sighting sheet, your-photos sheet etc. into the 4,000-card page behind. While a full-screen layer is open, its
  page-level siblings are now `inert` (small pop-ups such as menus, toasts and the cookie bar stay usable), and released
  when it closes.
- **FIXED - Focus did not always go into dialogs or come back.** The keyboard now moves into a layer that opens without
  taking focus itself (the note sheet and your-photos sheet left it on the card), and returns to the opener on close -
  through a chain when one dialog replaced another or the opener was inside a dialog that closed first (Settings -> note
  sheet -> Escape x2 -> back on the Settings button; before: lost to `<body>`).
- **FIXED - "Your photos" sheet (`#ps-sheet`, `role=dialog aria-modal`) had no Escape at all.** A single open layer
  that does not react to Escape within 350 ms now gets its own close button pressed.
- **FIXED - Button inside a button on every card with a user photo**: `span.photo-btn[role=button]` contained
  `button.photo-btn-clear` (4,243 in the DOM; drawn on every card with a photo). With a photo, the box is now a plain
  container holding two sibling buttons - "See your photos" (fills the box) and "Remove photo" - same look. Without a photo
  the original button-like box is unchanged (its inner remove button is `display:none`, so nothing nested is drawn).
- **FIXED - Possible double action on the remove-photo / photo keys**: `photoAct` acted on keydown Enter/Space *and* the
  native button click could follow (Firefox fires Space's click on keyup even after keydown's preventDefault) - removing
  two photos with one key press. Real buttons are now left to their own click.

## Medium

- **FIXED - Logged sightings were unreadable to screen readers**: the note button's `aria-label` ("Log the date and place
  you saw this") hid the logged date and place drawn by CSS. It now reads e.g. "Your sighting: 12 May 2024, Tortuguero,
  Costa Rica. Change the date and place" (kept in step by a MutationObserver on `data-when/where/n`).
- **FIXED - Drawn "+ date & place" / "+ photo" were read as text inside the buttons** (Playwright aria snapshot:
  `button "Log the date and place you saw this": + date & place`, once per seen card on show). CSS generated content now
  carries empty alt text (`content: "+ photo" / ""`), with the old declaration first as the fallback for older browsers.
- **FIXED - Following: "Loading facts..." could spin for ever, and a Wikipedia error said "Very little has been written
  about this snake yet"**. An error or a 25 s wait now says what happened, with Retry (the same Retry the sightings box
  already had).
- **FIXED (no visual change) - Header icon buttons are 28x28 px on phones** (34 px on computers). On touch screens each
  one now answers a 44 px tall tap (an invisible `::after` 8 px above and below; never sideways, so neighbours keep
  theirs).
- **OPEN - Other small touch targets** (phone): card Follow bell 30x30, 3D 34x31, Mark Seen / See more info 31 px tall,
  Want to see 26 px tall, Show 60 more 38 px, tabs 41 px. Enlarging them changes the card layout - needs Eduardo's
  approval (would go behind the `cards` preview).
- **ROUTED (opening) - Whole-page restyle at the hand-over**: `__introUnhide` adds `html.sl-restyle`, removes
  `.intro-on`, and forces a layout of the full page (`void de.offsetHeight`) - 0.5-0.7 s of a single task, and 1.3-2.7 s
  of style recalculation in total in the first 9 s. This is by design (to avoid jank later) but it is the largest
  remaining long task.
- **OPEN - The "Loading..." spinner helper** (v5.38 script) watches the whole `<body>` subtree with `characterData` -
  every text change in 30,000 elements goes through it.
- **OPEN - The pop-up stacker (v5.49) runs `setInterval(soon, 200)` all the time**; there are also
  `setInterval(sync, 800)` (habitat menu button text, polling a `<select>` already watched by a MutationObserver) and
  `setInterval(look, 2500)` (achievements). None stop when the tab is hidden (browsers throttle them to 1/s).

## Low

- **OPEN - Nested in the DOM, never drawn**: `span.chip[role=button] > button.chip-pic-btn` (12, in the Type and
  Continent rows, where `.chip-pic-btn` is always `display:none`) and the photo box's remove button on cards without a
  photo. Not exposed to assistive tech; the markup is the static card HTML (4,243 lines) and `build-site.py`'s card
  compressor - changing it would collide with the data/SEO work.
- **OK - Card buttons**: Follow, Want to see, 3D and See more info never mark the card seen (checked by test). The card
  name/photo opens the species page by design.
- **OK - Focus rings**: every Tab stop has a visible indicator (the sort button and search box use a border colour, not an
  outline).
- **OK - Reduced motion**: with `prefers-reduced-motion: reduce` no CSS/Web animation keeps running after the opening.
- **OK - Accessibility tree during the opening**: 64 nodes (only the opening) until SnakeList is shown; the hero photo
  is in normal flow above SnakeList, so SnakeList below it being in the tree is correct.
- **NOT VERIFIED - 3D viewer disposal / hidden-tab pause**: headless Chromium here has no GPU, so the viewer's WebGL
  canvas never started; its render loop uses requestAnimationFrame (paused by the browser in hidden tabs). No audio
  playback was found in `snakelist-synced.html` (the Christmas/events code was not audited). (3D area.)

## Routed to other areas

- **Opening**: the whole-page restyle above; also `window.__introUnhide` is the largest self-time JS function in the
  profile (0.46-0.66 s).
- **Map / sightings**: `SL_getJSON` has no timeout - a hung iNaturalist request leaves "Loading sightings..." up until the
  browser gives up (minutes). The sightings box has a Retry for errors, not for hangs.
- **3D**: `td-card-btn` reads "See <name> in 3D" on every card; for species without a real model the viewer shows a
  generated 3D profile - worth checking the wording is honest there as it is for fossils ("3D Reconstruction
  Unavailable").
- **Data/SEO**: if the card markup is ever regenerated, emit the photo box as a plain `span` with two sibling buttons (as
  the app now does at runtime once a photo is added) and drop `role=button` from the Type/Continent chip wrappers'
  never-shown picture button.

- **Christmas / events**: `tests/hero-scroll.js` fails on HEAD as well as on this branch (19 and 25 FAIL lines in two
  runs on a heavily loaded machine; same kinds both times): the public countdown (`#sl-ev-pub`, inserted into `.sl-body`
  while the page scrolls) adds a button and runs `sl-ev-din/dout` animations mid-scroll, plus "nothing jumps" /
  layout-shift failures. Not caused by this branch.
- **3D**: once, on the loaded machine, the page stopped answering for over 30 s right after the 3D viewer opened
  (software GL in headless Chromium). Not investigated; worth a check that the viewer's start-up work is chunked.

## Tests

`tests/a11y-perf.js` (PORT env): no drawn nested buttons/links, card buttons don't mark seen, sighting button names,
photo buttons side by side, no "+ date & place"/"+ photo" read out, accessibility-tree budget (3,500 nodes; 64 during the
opening), focus into / back from Settings, 3D and your photos, background inert, Escape closes only the top of two
layers, Following facts error with Retry, and no long task over 200 ms while the opened page is left alone.
