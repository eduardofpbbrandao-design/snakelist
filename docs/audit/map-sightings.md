# Audit: map sightings (batch109, area "map-sightings")

Scope: the Sightings layer on the map (`snakelist-synced.html`, "Sightings (v4.62)" through "wiring"), its card, the
place panel's iNaturalist wording, and the phone map height. Earlier requests kept: the dot card says "See the spot"
(no Explore in 3D, no Species page button in the live card), it stays small with name + date + who found it under the
title, the exact-spot mini-map zooms at once, and the location shown is iNaturalist's public spot.

Tests: `tests/map-clusters.js` (new), `tests/map-sightings.js`, `tests/sightings-card.js`, `tests/map-place-species.js`,
`tests/sightings-empty-search.js`, `tests/data-safety.js`.

## What was wrong (before)

| # | Finding | Severity |
|---|---|---|
| 1 | Whole-world view with Sightings on: ~13,000 overlapping dots (iNaturalist's tile sample) cover every continent - no way to see density or click a single record. | High |
| 2 | The key said "One iNaturalist sighting" per dot and, on the same line, "2,228,738 sightings in view" - while only ~12,900 dots were drawn. Nothing said the dots were a sample. In list mode "the newest N of M" didn't say it was a loaded part. | High |
| 3 | "Show all dots" zooms out; zoomed out, iNaturalist's tiles are a sample, so not "all dots". "Most popular sighting" (measured by favourites) only said so in a hover title (titles are removed on buttons). | Medium |
| 4 | City dot panels said "within 25 miles" - iNaturalist's `radius` parameter is kilometres. | Medium (wrong fact) |
| 5 | The introduced-only place fallback could print "0 snakes were brought here by people (introduced) - none of them is native here." | Low |
| 6 | Stale requests: tiles for a view already left kept the 6 download slots busy (the new view waited behind them); the per-view count for an old view wasn't aborted; a "Most popular" answer for the previous snakes could still open after the snakes changed; a failed count was silent. | Medium |
| 7 | Escape in full screen closed the card **and** left full screen (both document listeners ran). After closing, focus went to `<body>` (the dot was clicked on the canvas). When a tile dot's card was filled, focus on its title was lost. | Medium (a11y) |
| 8 | Names: the card used iNaturalist's common name ("Viperine Water Snake") while the checklist, photo viewer and 3D panel use SnakeList's ("Viperine Snake"); See the spot was handed iNaturalist's name too. | Medium |
| 9 | Card photo cropped to 168 px (`object-fit: cover`) - heads cut off; no swipe. Photo licence shown, record (data) licence not. | Medium (design - preview) |
| 10 | Phone: map is 56% of the screen height, with the toolbar on top of it. | Low (design - preview) |

The map never says observation density = snakes alive: the heatmap's "Where seen" key already says "where people
looked and posted, not how many snakes live there"; that sentence now also sits in the Sightings key (title and
preview key). Native / introduced / country-level-only records stay separate in the place panel (unchanged, verified in
code: "Possible: country-level record only", introduced pins orange).

## What changed

### Live (keeps the look: same green dots, same pill, same card)
- **Groups** (`sgClusters`, `sgGroupSprite`, `sgGroupOpen`, `sgSpider`): dots closer than 22 px, 3 or more, become one
  bigger dot in the same green/edge/halo with a thin inner ring. Recomputed per zoom step with a 200 ms cross-fade
  (none with reduced motion). Single dots are drawn on top of groups. Clicking a group zooms to its dots (an Undo
  step). Close up (world width >= 256 x 2^16 px) only dots on the same spot are grouped; clicking them fans them out
  (spiderfy), each clickable; a click on empty map folds them back. List-mode piles already fanned (v5.68) stay fanned
  below world scale. **No numbers on the groups** - Eduardo asked for "no numbers on the sightings dots" (v4.54); the
  numbers are in the preview for him to decide.
- Selected dot: the existing white-ring marker, drawn on top of groups.
- **Counts** (`sgStatus`): "2,228,747 iNaturalist sightings in view · 12,863 shown (a sample - zoom in for more) · 253
  groups"; "all N sightings in view on the map" when complete; list mode "N in view · the newest 2,000 loaded (only a
  part) · M on the map"; "loading more…" while tiles load; "iNaturalist's total for the view couldn't load" on failure.
  Dots and groups are counted in view only. Key adds "◉ a group of nearby dots (click to zoom in)" when groups show.
- Buttons: **"Zoom out to all sightings"** / "Zoom out" (phone); **"Most favourited sighting"** / "Most favourited";
  the card banner: "Most popular sighting in X, by iNaturalist favourites · N people made it a favourite".
- "within 25 miles" -> "within 25 km" (5 places); no "0 introduced" line.
- Stale: per-tile AbortController - tiles no longer wanted are called off when the view changes; the count request is
  aborted for a new view; "Most popular" is dropped if the snakes/place changed (and when Sightings goes off).
- Escape: a capture listener closes only the card (and yields to the 3D panel, the bigger photo, the Map style menu or
  a panel the keyboard is in); focus returns to the map canvas (`tabindex=-1`), and stays on the card title when the
  card is refilled.
- One main name: SnakeList's checklist name in the card and passed to See the spot / 3D; iNaturalist's name kept as
  "Also called" in More details. The record's own licence (`license_code`) is kept.
- Photo swipe (left/right) in the card.

### PREVIEW "sightings" (`?preview=sightings`, `tools/previews.js` DEFS)
- Panel docked at the right of the map (left, below the buttons, when the dot would be under it), 344 px, full map
  height; on a phone a bottom sheet with a grab bar (up to 74 %).
- Photo first and whole (`object-fit: contain`, 216 px frame), swipe, < >, "1 / 2", credit + licence under it.
- Title = SnakeList name; scientific name + "also called …" small; Seen / Where (with privacy/accuracy note) / Found by
  / Quality / Source (See in iNaturalist + observation id); View species (species page) and See the spot; More details
  with photo licence(s) and record licence apart, folded observer's notes, exact-spot map, About this snake.
- Close keeps the dot picked (ring) and puts the map back where it was if the panel moved it ("Zoom the map here").
- Compact collapsible key (Key ▸ + short counts; opens to dot / group with number / picked dot / sample and "not how
  many snakes live there") replacing the long pill; chip row of active filters (Snakes always; Place, Filters, Dates,
  Quality when set) with × to clear a search; numbers on groups; phone map ~74 % of the screen height.
- **Note for Eduardo:** "View species" is a Species page button, which he removed from the live card (v6.28 L9). It is
  only in the preview so he can decide.

## Evidence
Screenshots (real iNaturalist data, deviceScaleFactor 1): `before-world-*`, `before-panel-*`, `after-live-*`,
`after-preview-*` in the batch109/map-sightings scratch folder.

## Remaining
- The Leaflet map styles (not the SnakeList map / Satellite) still draw every dot without groups.
- Keyboard users can't reach individual dots on the canvas (pre-existing).
- Eduardo to approve: numbers on groups, docked panel / sheet, View species, compact key + chips, taller phone map.
