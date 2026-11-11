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
| 2 | Anatomically and visually convincing, species-specific models (proportions, taper, head, eyes, scales, keels, pattern, pose, lighting) | R | A | ⚠️ | 40 species profiles in `data/snake-models.json` (including the 7 living validation species), each citing its account, reference photo and any extra sources. Procedural: swept body with real taper, species head and eyes, generated scale normal map (keeled/smooth/juxtaposed), layered patterns. Still visibly procedural up close (see stream A report). |
| 3 | Believable scenery from well-supported species habitat only; labelled as reconstruction | R | A | ✅ | Ground, props, fog and sky dome per profile scene; habitat taken from the species account (quoted under "About this model"), never from country estimates; labelled "Representative reconstruction - not a photograph of a real encounter." |
| 4 | Bounded, smooth camera (orbit, limited zoom, reset/fullscreen/views; mouse/touch/keys; limits scale with model) | R | A | ✅ | Bounded orbit (8-80 degrees, camera kept above the body), zoom limits from model size, zooming in moves the focus to the head, no pan; Reset/Fullscreen/Front/Side/Top; mouse, touch, keys. Tested with Playwright. |
| 5 | Reliable 3D: on demand, loading/fail/retry, device-scaled quality, pause when hidden, dispose, context loss, reduced motion, honest "no model" | R | A | ✅ | three.js vendored in species/3d and loaded on open; loading/error/Retry; WebGL fallback; context loss and restore; render on demand, paused when hidden; full dispose on close; no idle animation. Tested with Playwright. |
| 6 | Polished viewer UI: large view, compact toolbar, settings panel, labelled length comparison, appearance details, credits | R | A | ✅ | Toolbar (views, Reset, Fullscreen, Scale, Details, Settings); Scale = typical-adult ruler + 1.5 m figure (maximum only as text); detail markers; credits; phone and desktop, light and dark. |
| 7 | Species fact grid redesign (labels Venom, Adult length, Diet, Reproduction, Conservation status, Distribution; etymology out of the grid) | R | B | ⏳ | |
| 8 | Species page reading order, separate actions, section nav, no repeated panels | R | B | ⏳ | |
| 9 | More sourced information; unknowns stay unknown | P | B | ⏳ | |
| 10 | Viperine Snake distribution (North Africa missing from map/summary), countries vs territories, introduced vs invasive | D/I | B | ⏳ | |
| 11 | Fossils separated from living species everywhere (counts, map lists, related lists) | D | B+C+D | ⏳ | |
| 12 | Author/year attribution fixed at source (Malpolon "Faber 1912" → Hermann 1804); no implementation messages in content | D | B | ⏳ | |
| 13 | Correct administrative terms (Porto = district), place identity, explicit wording | D/I | C | ⏳ | |
| 14 | Map vs page counts reconciled (Porto 10 vs 8), every count defined | D | C+D | ⏳ | |
| 15 | "Fewest species" excludes zero, shows ties, full dataset; cities/regions/islands | R | D | ⏳ | |
| 16 | City evidence levels separated (in city / in district / possible by range); "nearby" wording | I | C+D | ⏳ | |
| 17 | Sightings button: restrained teal, label "Sightings", one toggle, options panel | R | D | ⏳ | |
| 18 | Sightings markers: consistent, clusters with counts, hit areas, overlap lists | R | D | ⏳ | |
| 19 | Honest sightings totals; viewport loading; date range; load more; dedupe by id; no "live" misuse | R | D | ⏳ | |
| 20 | Marker opens the exact observation (photos, names, date/time/zone, observer, licence, locality, accuracy, grade, notes, links) | R | D | ⏳ | |
| 21 | Observation photos and metadata kept together; stale responses ignored; retry | D/R | D | ⏳ | |
| 22 | Trail cameras separated into their own "Cameras" layer, honest wording | R | D | ⏳ | |
| 23 | Predictable map state (close vs clear, return from pages, back/forward, reset view vs reset filters); keep zero-match fix | R | D | ⏳ | |
| 24 | Full map correctness audit (races, filters, alignment, islands, hit tests, popups, touch, failures, legends) | U | D | ⏳ | |
| 25 | Weak habitat estimates replaced or clearly labelled; not used for 3D scenery | I | C+A | ⚠️ | A: 3D scenery uses only the species account habitat (or the cited profile); the old habitat-scene size picture (`scene_of`, `SCENE_WORDS`) is removed. C part not done by stream A. |
| 26 | Country/region/city/family/genus/fossil templates each with a real purpose; honest "most recorded" | R | C | ⏳ | |
| 27 | Full wording and terminology review in templates and generated text | I | B+C+E | ⏳ | |
| 28 | Conservation with provider/category/year/scope; citations that support statements; meaningful review dates | I | B | ⏳ | |
| 29 | Reference-site patterns used selectively (AirNav, Florida Museum, Reptile Database, iNaturalist) | P | A+B | ⚠️ | A: photo gallery tab with credits (iNaturalist pattern) and listed model references. |
| 30 | Consistent visual system across app and pages; contrast; both themes; zoom; narrow screens | R | E | ⏳ | |
| 31 | Supporting flows audit (checklist, sightings, want/following, achievements, quiz, camera ID, install, About, creator, credits, privacy, terms); stale totals | I/U | E | ⏳ | |
| 32 | Complete, reviewable result: this checklist, validation set, previews, honest report | — | all | ⏳ | |

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
