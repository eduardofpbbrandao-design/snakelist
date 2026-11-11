# SnakeList overhaul (brief of 11 Nov 2026)

One checklist for the whole brief. Every item says what kind of issue it is:
**D** = reproduced defect · **I** = data or wording inconsistency · **R** = requested design change ·
**P** = proposed improvement · **U** = unverified concern (needs more testing).
Status: ⏳ not started · 🔧 in progress · ✅ done and tested · ⚠️ done in part (see note) · ⛔ blocked.

Workstreams: **A** 3D viewer · **B** species pages, taxonomy, species data · **C** places (country/region/city pages, counts, habitats) · **D** app map and sightings · **E** whole-app visual system and supporting flows.

Environment limits: iNaturalist, Wikipedia, Wikidata, GBIF and the Reptile Database cannot be reached from the build machine (web search works). Features that fetch from them at run time are tested with recorded/mock responses and say so here.

| # | Requirement | Type | Stream | Status | Notes |
|---|---|---|---|---|---|
| 1 | Real-life module rebuilt around appearance: "Explore in 3D", photos kept as reference gallery | R | A | ✅ | Button and app label "Explore in 3D"; dialog with a 3D model tab and a Photos tab (page photo + iNaturalist research-grade gallery). |
| 2 | Anatomically and visually convincing, species-specific models (proportions, taper, head, eyes, scales, keels, pattern, pose, lighting) | R | A | ⚠️ | 40 species profiles in `data/snake-models.json` (including all 8 validation species), each citing its account, reference photo and any extra sources, and each checked against its photo tile. Procedural: swept body with real taper; head outline per head type (triangular viper heads with a distinct neck, oval colubrid/python/elapid heads, blunt blind-snake heads, sea-snake paddle tails) with its own depth profile; species eyes; generated scale normal map (keeled/smooth/juxtaposed); layered patterns including chevrons and hourglasses. Still visibly procedural up close (see stream A report). Reliability tests: `tests/viewer3d.js` (42 checks). |
| 3 | Believable scenery from well-supported species habitat only; labelled as reconstruction | R | A | ✅ | Ground, props, fog and sky dome per profile scene; habitat taken from the species account (quoted under "About this model"), never from country estimates; labelled "Representative reconstruction - not a photograph of a real encounter." |
| 4 | Bounded, smooth camera (orbit, limited zoom, reset/fullscreen/views; mouse/touch/keys; limits scale with model) | R | A | ✅ | Bounded orbit (8-80 degrees, camera kept above the body), zoom limits from model size, zooming in moves the focus to the head, no pan; Reset/Fullscreen/Front/Side/Top; mouse, touch, keys. Tested with Playwright. |
| 5 | Reliable 3D: on demand, loading/fail/retry, device-scaled quality, pause when hidden, dispose, context loss, reduced motion, honest "no model" | R | A | ✅ | three.js vendored in species/3d and loaded on open; loading/error/Retry; WebGL fallback; context loss and restore; render on demand, paused when hidden; full dispose on close; no idle animation. Tested with Playwright. |
| 6 | Polished viewer UI: large view, compact toolbar, settings panel, labelled length comparison, appearance details, credits | R | A | ✅ | Toolbar (views, Reset, Fullscreen, Scale, Details, Settings); Scale = typical-adult ruler + 1.5 m figure (maximum only as text); detail markers; credits; phone and desktop, light and dark. |
| 7 | Species fact grid redesign (labels Venom, Adult length, Diet, Reproduction, Conservation status, Distribution; etymology out of the grid) | R | B | ✅ | B: six fixed labels (Venom, Adult length, Diet, Reproduction, Conservation status, Distribution) with "Not known" for gaps; fossils get Status, Geological age, Fossils found in, Estimated length, Diet, First described; etymology moved to Taxonomy. |
| 8 | Species page reading order, separate actions, section nav, no repeated panels | R | B | ✅ | B: header → key facts + actions → Identification → Distribution → Behaviour → Conservation → Similar/related → Taxonomy → Sources; sticky section nav; Mark seen / Want to see open the app at the card (never mark by themselves). |
| 9 | More sourced information; unknowns stay unknown | P | B | ⚠️ | B: rewritten Natrix maura, Malpolon, Bitis gabonica, Python bivittatus; fossil accounts Titanoboa, Portugalophis. Other 46 accounts not expanded; 4,195 species still have no account (sources like Wikipedia/Reptile Database not reachable here). |
| 10 | Viperine Snake distribution (North Africa missing from map/summary), countries vs territories, introduced vs invasive | D/I | B | ✅ | B: Natrix maura 9 countries + Gibraltar, Africa + Europe; "N countries and N territories" on every page; data/introduced-status.json separates introduced vs invasive; Mallorca/Menorca "Introduced … in antiquity". Lead: region pages tag introduced species in their lists. |
| 11 | Fossils separated from living species everywhere (counts, map lists, related lists) | D | B+C+D | ✅ | B species pages, C place pages, D map (living-only counts and shading; "Fossil and extinct snakes (not counted above)" section; fossil-only view from the caption). Portugal: "10 living species recorded here · 1 fossil or extinct listed apart". |
| 12 | Author/year attribution fixed at source (Malpolon "Faber 1912" → Hermann 1804); no implementation messages in content | D | B | ✅ | B: wd.js uses the taxon's own taxon-author statement and checks surname + year against the authority; data/authorities.json; Porto shows Hermann 1804; tests/wd-authority.js 23/23 (mocked Wikidata). |
| 13 | Correct administrative terms (Porto = district), place identity, explicit wording | D/I | C | ✅ | C: admin terms from the app SUBDIV/NON_SOVEREIGN tables; places stored with id/type/parent/country; Porto District vs Porto city wording. |
| 14 | Map vs page counts reconciled (Porto 10 vs 8), every count defined | D | C+D | ✅ | Root cause: map livesNear pooled fossils + country-only records. Pages, map and species/place-counts.js now agree: Porto "8 recorded in Porto district · 1 possible" on map, region and city pages (checked in the merged build). |
| 15 | "Fewest species" excludes zero, shows ties, full dataset; cities/regions/islands | R | D | ✅ | D: Fewest added beside Most for cities, states/regions and islands; full eligible set; zeros excluded and counted; ties expandable; all-ones and no-results messages. Tested. |
| 16 | City evidence levels separated (in city / in district / possible by range); "nearby" wording | I | C+D | ✅ | C city pages split by evidence level; D map rows say "N recorded in X district · N possible (country-level record only)", no "nearby". |
| 17 | Sightings button: restrained teal, label "Sightings", one toggle, options panel | R | D | ✅ | D: "Sightings", deep teal #0b6a63 with ring and tick when on; status bar with species, counts, date range; Options panel; one toggle. |
| 18 | Sightings markers: consistent, clusters with counts, hit areas, overlap lists | R | D | ✅ | D: one small dot per observation with 28 px hit area; teal-ring clusters with counts (tap zooms or lists); overlap pick list; gold ring on the open record. |
| 19 | Honest sightings totals; viewport loading; date range; load more; dedupe by id; no "live" misuse | R | D | ⚠️ | D: bounding-box loading, 200/page, Load more, cap 2,000 stated, date range, dedupe by id, no "live". Tested with mocked iNaturalist only (blocked here). |
| 20 | Marker opens the exact observation (photos, names, date/time/zone, observer, licence, locality, accuracy, grade, notes, links) | R | D | ⚠️ | D: panel per observation id with its own photos/licence, rank-level names, observed vs uploaded dates with time zone, observer, locality, accuracy/obscured, grade, notes, both links; never a substitute photo. Mock-tested only. |
| 21 | Observation photos and metadata kept together; stale responses ignored; retry | D/R | D | ⚠️ | D: stale answers ignored (token + AbortController), cache by id, 15 s timeout + Retry, deleted records removed. Mock-tested only. |
| 22 | Trail cameras separated into their own "Cameras" layer, honest wording | R | D | ✅ | D: separate Cameras layer and key, square markers, kinds from real fields (media / stream link "not checked - may be offline" / place only), pending dashed; nothing claims live. |
| 23 | Predictable map state (close vs clear, return from pages, back/forward, reset view vs reset filters); keep zero-match fix | R | D | ⚠️ | D: Close keeps the selection; Clear selection; Reset view separate; Sightings no longer clears the country; map state saved and restored on return. Restore after a real page reload not proven separately (browser back cache). |
| 24 | Full map correctness audit (races, filters, alignment, islands, hit tests, popups, touch, failures, legends) | U | D | ⚠️ | D: fossils, 60-city cap, same-name cities, mixed legend, close/reset discarding, sightings clearing country, unclickable close, popups over buttons, dark dots, stale markers, substitute photo - fixed. Touch pan/pinch, small islands, native/introduced switch only partly checked. |
| 25 | Weak habitat estimates replaced or clearly labelled; not used for 3D scenery | I | C+A | ✅ | C: habitat bar counts removed; region pages quote reviewed-account habitat text with sources, clearly general. |
| 26 | Country/region/city/family/genus/fossil templates each with a real purpose; honest "most recorded" | R | C | ✅ | C: region/city/country/family/genus/fossil templates reordered with distinct purposes; "Most recorded worldwide" labelled global. |
| 27 | Full wording and terminology review in templates and generated text | I | B+C+E | ⏳ | |
| 28 | Conservation with provider/category/year/scope; citations that support statements; meaningful review dates | I | B | ⚠️ | B: provider/category/scope/year/link shown; Natrix maura, Bitis gabonica, Python bivittatus citations checked; others not line-by-line; Red List years for 4 species from secondary sources (flagged). |
| 29 | Reference-site patterns used selectively (AirNav, Florida Museum, Reptile Database, iNaturalist) | P | A+B | ⏳ | |
| 30 | Consistent visual system across app and pages; contrast; both themes; zoom; narrow screens | R | E | 🔧 | E: light-theme filter boxes get a firmer edge (no pale-on-pale); header buttons fit one row on 360-430 px phones; map caption links use straight underlines (the rounded ones looked like stray commas). No horizontal overflow at 390/1280 in either theme. Species-page and place-page styles come from streams B/C. |
| 31 | Supporting flows audit (checklist, sightings, want/following, achievements, quiz, camera ID, install, About, creator, credits, privacy, terms); stale totals | I/U | E | ⚠️ | E: About photo total from data; feature descriptions match (sightings not "live", Impossible quiz, email accounts); Wikidata in privacy list; "Harmless" filter -> "Low risk". Quiz levels show their timing. Saved records/sync/backups not re-tested in this pass. |
| 32 | Complete, reviewable result: this checklist, validation set, previews, honest report | — | all | ⚠️ | Checklist kept here. Merged build tests: viewer3d 42/42, map-sightings all pass, sightings-empty-search pass, wd-authority 23/23. Preview of species pages + 3D viewer published for approval. Not on main until Eduardo approves (visual change). |

## Validation set
- Small snake: *Indotyphlops braminus* (Brahminy blind snake) / *Coronella austriaca*
- Large constrictor: *Python bivittatus* / *Malayopython reticulatus*
- Patterned viper: *Bitis gabonica* / *Crotalus atrox*
- Aquatic snake: *Natrix maura* (+ *Hydrophis platurus* marine)
- Poorly known species: one with no account and few records
- Fossil: *Portugalophis lignites* / *Titanoboa cerrejonensis*
- Places: Portugal, Porto district and city, Spain, Morocco, Gibraltar, Mallorca

## Additional issues found during the work
(added as they are found)
- Lead: map test tapped a dot below the window after the merge (test fixed to scroll first); tests/sightings-empty-search.js now takes $PORT. Results on the merged build: map-sightings 61/61, empty-search 10/10.
- D: a dot under the Sightings status bar cannot be tapped (bar on top) - open.
- B: Malpolon monspessulanus was also missing its North African range - fixed. Natrix astreptophora and Hemorrhois hippocrepis still lack North African countries.
- B: Bitis gabonica Red List category conflicting in sources (VU vs NT) - shown as not confirmed.
- Lead: region/city pages said introduced species were "not counted" while counting them - now tagged "introduced" in the list and the note says so.
- C: fossil ages under 1 million years were shown 1,000x too young (Crotalus potterensis "about 20 years ago") - fixed.
- C: some big cities fall in the wrong region where the map has no shape for them (Addis Ababa -> Oromia) - not fixed.
- E: "Harmless" filter renamed "Low risk" (non-venomous is not a promise a snake cannot bite).
- E: About page photo total now computed from the photo index (was "about 3,100 of the 4,254").
