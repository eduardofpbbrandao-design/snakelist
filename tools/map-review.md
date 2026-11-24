# Map review (S6) - 2026-11-24

Inspected in Chromium (Playwright) on the built `index.html`, with iNaturalist mocked or blocked
(this machine cannot reach it), at desktop 1366x860, phone portrait 390x844 (touch), phone
landscape 844x390 (touch) and in the map's full screen. Screenshots: `batch100/map/before` and
`batch100/map/after` in the session scratchpad.

## Inventory: controls and states exercised

| Area | Controls / states tried | Result |
|---|---|---|
| Search + geography | search box (country "Portugal", species names), Enter, menu, Undo, See species, See districts/states, See cities, See islands, Most/Fewest lists (by test), Clear, Close, Reset view, back from a species page (by test) | worked; Undo restores the exact earlier map |
| Toolbar | Species Heatmap, Sightings, Habitats, Filters (labels collapse to icons on a phone) | no overlaps found at any size |
| Heatmap | on/off, species search, category, Where they live / Where seen, Today/This month/This year/All time, collapse | **problems 3, 4** |
| Habitats | open, pick Tropical Rainforest, legend, collapse on phone | worked; legend explains "of its snakes", estimate wording present |
| Filters | open panel, groups, Clear all, Done, Escape; phone bottom sheet | worked (phone sheet covers the 3D button while open, by design) |
| Sightings | on/off, dots, tap a dot, big view (photo, species, date, observer, licence/credit, place, accuracy, quality, link to original, exact spot, Show on the map), Back/X, fanned-out stacks, failure + Retry, offline | worked; **problem 6** (no key; dots lost on green shading) |
| Map styles | Map layers menu, SnakeList map, Satellite (and its offline note), Heatmap style | worked; **problem 1** on satellite |
| Show colours / Hide colours | per species card in the map list, key, Close, with Sightings on top, close up, satellite | **problems 1, 2** |
| 3D map | 3D toggle; offline it falls back to the flat map with a message | fallback message is clear; full 3D covered by `tests/map-3d-mode.js` |
| See near me | signed in (record present), signed out, permission denied, Time on/off, Turn off location, Clear/Close | **problem 5** |
| How to find it | open from the near-me list, best spot + Show on map, sections, Compare, Escape/X, desktop/phone/landscape | content already species-specific with "no guarantee" wording; **problems 7, 8** |
| Full screen | toolbar, zoom column, panels, observation view | no overlaps found |
| Small targets | every visible button in the map measured | **problem 9** |

## Problems found and fixes

1. **Range shading hid the map.** "Show colours" filled the range with solid green: on Satellite the
   imagery vanished under it, close up the land, coast and labels underneath were gone.
   Fix: the range is painted on its own layer and laid on the map see-through (74% on the SnakeList
   map, 60% on Satellite), with a crisp outline round the range so its edge stays clear.
2. **The range key said "more ... less" without saying more of what**, and nothing said the shading is
   not a count of snakes; introduced places were only "shaded too". Fix: the scale reads
   "Core - Edge of range"; the key says it is an estimate from range maps and records, not a count of
   how many snakes live there; introduced places are named ("Introduced (brought by people, not
   native here): Ibiza and Formentera (Spain)"). The key's Close is now a 32px target (was 60x21).
   On a phone the source citation is left out so the key stays short.
3. **Where seen showed range colours under a "Fewer sightings / More" key when iNaturalist failed** -
   a misleading picture. Fix: the legend switches to the range key and the panel says
   "Couldn't load sightings from iNaturalist just now, so this shows where these snakes live
   instead", with a Try again button. The sightings legend also says the numbers are relative
   iNaturalist records, not how many snakes live there.
4. **Turning on the Heatmap or Habitats silently cleared the search / picked country** while its note
   said "the search and Filters above stay as they are". Fix: the note now names what was put aside
   and that Undo brings it back (the one-view-at-a-time behaviour itself is kept).
5. **See near me existed only for signed-in users who had said yes to a one-time prompt**; anyone
   else never saw the button, and a denied location had no alternative. Fix: the button is always
   in the map's control column (with a tooltip). Without a location it opens a panel that explains
   why the location is needed and what is kept or sent, with "Use my location" and "Or choose a place
   instead" (type a town or city). Denied, unavailable and unsupported each get their own message
   pointing to the alternative. Signed out, the position is used for this visit only and never
   saved; signed in, the account's own setting is used as before.
6. **Sightings had no key and the dots were hard to see on green shading.** Fix: while Sightings is on,
   the hint pill becomes its key ("One iNaturalist sighting - tap a dot for its photo and details");
   dots get a thin light halo so they stand out on the range shading and heatmap.
7. **The best-spot tag was cut off at the map edge** and, once the guide was closed, didn't say which
   snake it was for. Fix: the tag stays inside the map and reads "Best spot for the Ladder Snake".
8. **How to find it on a sideways phone** was a bottom sheet over the spot it marks, leaving a thin strip
   of map. Fix: it runs down the right side in landscape.
9. **Small targets**: the heatmap/habitat collapse buttons (24x22) are now 32x32; the guide and info
   panels' close X is 34px (was 28px).
10. **Touch wording**: a phone first showed "scroll to zoom - click any country"; it now says
    "pinch to zoom - tap a country" from the start.

## Checked and left as they are

- Sighting details (species, photo, date, observer, licence, link to the original, place, accuracy,
  quality), missing photo, broken photo + Retry, deleted record, stale-answer protection, list
  failure + Retry, stacked records fanned out: all already present and covered by
  `tests/map-sightings.js`.
- How to find it content: spots, season, time of day, weather, microhabitats, behaviour, diet, similar
  species + Compare, what to bring, ethics, photo tip, safety; "no guarantee" wording already there.
- Undo / Reset view / Clear / Close: Undo = one step back, Reset view = only the view, Clear = let go
  of the selection, Close = hide the panel and keep the selection. Consistent across country, state,
  city and near-me panels.

## Not done / remaining

- Introduced ranges are named in the key but not drawn in a different style (the range files merge
  native and introduced parts; separating them needs `tools/build_ranges.py` to keep them apart).
- Real satellite tiles, iNaturalist and MapTiler (3D) could not be reached from this machine; they
  were tested through the existing mocks only.
- Choosing a place offers SnakeList's own city list only (no free geocoding), so very small places
  need a nearby town.
