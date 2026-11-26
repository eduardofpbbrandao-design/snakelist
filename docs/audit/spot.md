# Audit: "See the spot" (3D reconstruction of a sighting's place)

Area key: `spot`. Code: `window.SL_3D.spot` in `snakelist-synced.html` (the 3D panel, and `spotOf()` next to
`observedTxt()` which builds what the panel is given), `species/3d/spot.js` (the place), `species/3d/tz.js` (new: time
zone of a place), `species/3d/daynight.js` (night, torch), `species/3d/extras.js` (photo beside the scene),
`species/3d/viewer.js`. Tests: `tests/spot-3d.js` (extended).

Test sightings (real iNaturalist data, fetched for the audit; satellite and land-height tiles were real, OpenStreetMap's
Overpass API is unreachable from the build machine, which reproduced the "roads and water could not load" report):

| case | iNaturalist | what it shows |
|---|---|---|
| `guat-ny` | Imantodes cenchoa, obs. 20557922, Suchitepéquez, Guatemala, 26 Jan 2019 22:30, ±695 m, listed in **America/New_York** | wrong time zone, night, big uncertainty |
| `guat-tall` | Imantodes cenchoa, obs. 381691335, Ranchitos del Quetzal, 15 Jul 2026 08:45, ±218 m, **portrait photo** (1153×2048) | daytime forest, tall photo |
| `taipan` | Oxyuranus microlepidotus, obs. 339867326, The Kempe Rd, Coober Pedy SA, 22 Feb 2026 10:31, ±3 m | desert ground scale |

Screenshots (1280×860 and 390×844, device scale 1, the same fixed cameras before and after: `open` = the app's own first
view, `cam1` = 3/4 view at 1.3 × the fit distance, `close` = low view of the ground by the snake, `wide` = 9 × the fit
distance): `scratchpad/batch109/spot/before/` and `.../after/` (`-live-` = preview off, `-pv-` = preview on).

## Findings and fixes

### 1. Truth - "exact spot" with a 695 m radius (LIVE fix)
*Cause:* the card always said "Exact spot within about N m", the pin said "Seen here" and a light beam marked the point,
whatever the accuracy; an obscured sighting's accuracy was the hidden point's own (`positional_accuracy`), not the size
of the area iNaturalist hides it in.
*Fix:* the card says **"Approximate observation area (±695 m): the snake was somewhere in the yellow circle; it is drawn
at its centre"**; with no accuracy recorded it says so. The pin says "Centre of the observation area · ±695 m" from 15 m
up. The scene is labelled **"Recreated scene based on location data"** - the map layers are real data, the plants, ground
detail and snake are SnakeList's. An obscured sighting uses `public_positional_accuracy`, says the location is hidden and
the point is not the real spot, and gets no beam (nothing marks the random public point as a spot); nothing is derived
from its coordinates beyond showing the general area.

### 2. Time - America/New_York for a Guatemala sighting (LIVE fix)
*Cause:* iNaturalist's `observed_time_zone` is often the observer's account zone, not the place's. The panel showed it
verbatim and the sun was placed from that instant.
*Fix:* `tz.js` (no network): each IANA zone's main place (tz database `zone.tab`); the place's zone is iNaturalist's when it
is one of the 6 nearest zones or has the same UTC offset there, otherwise the nearest zone's offset (labelled "time zone
estimated from the location"). When iNaturalist's zone doesn't fit, the recorded clock time is read as local time at the
place (`reread`) - that moment lights the scene (sun / night) and the card shows "… 10:30 PM - local time at the spot
(UTC−06:00, time zone estimated from the location)" with a note that iNaturalist lists it in New York time. The viewer's
own time zone is never shown. (Checked: Guatemala/New York → UTC−06:00; Windorah/Brisbane and Coober Pedy/Adelaide kept;
Madrid/London → Madrid; Livingston/Amsterdam → UTC−6.)

### 3. Partial data - "roads and water could not load" (LIVE fix)
*Cause:* one line of text; nothing to do about it; the card never said which layers made it in.
*Fix:* a "Map data layers" list (Satellite pictures / Land height / Roads and water: loading… → loaded / couldn't load),
"This is not the full scene" when one is missing, "1 layer missing" on the card's title even while it is shut (the
card opens by itself on a computer; on a phone it stays shut, as the open card would cover the scene), and **Retry missing layers** asks again
only for the missing ones and rebuilds the place round the same view (`S.refetch()` + new `V.rebuild()`). Every download
has a time limit (tiles 15 s, Overpass 16 s per server, the build waits ≤ 25 s), so no spinner runs without end.

### 4. Night (PREVIEW `spot`)
Night stays night (moon, dark sky, the old torch). With the preview, a labelled **"Inspection light: on/off"** button
(bottom right, only for night sightings, on at first) makes the torch wider and stronger on the snake; off leaves the
moonlight only. (`daynight.js` `lamp(k, w)`.)

### 5. Look (ground scale LIVE; the rest PREVIEW `spot`)
*LIVE - ground scale:* desert "stones" were 4-54 cm across, pale and few - boulders bigger than an Inland Taipan's head
(see `taipan-desk-before-close.png`). Now 2600 pebbles (900 on phones) of 1-6 cm with the odd 5-13 cm one, densest near the
snake, dark grey and red-brown as on the gibber plain in the sighting's photo, and round (each corner of a stone used to be
moved separately for each of its triangles, so they came out cracked and spiky). Leaf litter (5-14 cm, rainforest 8-26 cm) and the ground detail photos (their
real widths) were already at real size.
*PREVIEW:* trees of three broadleaf / two conifer crown shapes with their own width, height and fullness, the odd
emergent; trunks of their own thickness, lean, bark colour and a flared base; limbs into each near crown; a soft contact
shadow under each near tree; two leaf textures; smaller and more varied leaf litter; a lighter forest floor; mid-scale
ground variation (0.3-6 m, fading out by 70 m) so the close ground isn't one stretched satellite blur.

### 6. Compare (live correctness fixes; layout PREVIEW `spot`)
*LIVE:* the panel beside the place showed **the species' card photo instead of the sighting's own** whenever the
sighting's photo URL was already iNaturalist's "large" size (`extras.js` put the species' file first) - fixed: a sighting's
own photo (`own: true`) is never replaced; its panel is titled "Photo of this sighting". Touch screens get touch
instructions ("Drag to go round it · two fingers to move · pinch…") at any width, not W A S D.
*PREVIEW:* the photo opens whole (fit/contain, not a tall crop), with **Fit photo / Reset camera / Focus snake** and
**Bigger photo / Bigger scene**; on a phone (≤ 900 px) a **Photo | Scene** switch shows one at a time (scene first) instead
of two squeezed panes; the photo credit is a readable line of its own and the zoom hint sits at the top of the photo and
fades; the map credits move to the top corner, away from the controls instructions.

### 7. Performance (LIVE fix)
*Cause:* the viewer's loading cover is hidden with the `hidden` attribute, but its CSS `display:flex` overrode it, so its
spinner kept animating (invisibly) for as long as the view was open; the photo panel's ResizeObserver was never released.
*Fix:* `.sp3d-busy[hidden]{display:none}`; one observer, disconnected with the panel; the viewer also stops drawing
while its own stage is hidden (the preview's phone Photo | Scene switch on Photo), as it already did when the page was. Verified on close: no frame is
drawn afterwards, no spinner or spot element is left, and the renderer's GPU geometries and textures go to 0
(19 / 21 → 0 / 0 in the test).

## Tests
`tests/spot-3d.js` (mocked network) now also checks: no "exact spot", the approximate area text, "Recreated scene…", the
three layers listed, Retry bringing a failed Overpass layer back, the place's local time, a New York-listed sighting in
Portugal shown at 23:10 local and lit as night, touch vs keyboard instructions, nothing drawn and GPU memory released
after closing, no preview pieces without the preview, and with `sl-art-preview-spot` = 1: Inspection light on/off, the
photo at fit with its buttons, Photo | Scene on a phone.

## Left to do
- The sighting card on the map (`observedTxt`) still shows iNaturalist's zone as given (outside See the spot).
- `tz.js` is a nearest-main-place estimate: near a border between zones with different clocks and no usable zone from
  iNaturalist it can be an hour (or half an hour) out; it says "estimated" when it is.
- Overpass could not be reached from the build machine, so roads and water were verified with the mocked data only.
- The preview's look needs Eduardo's approval before it goes public.
