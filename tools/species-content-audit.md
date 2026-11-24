# Species content audit (2026-11-24)

Scope: the generated species, country, genus and family pages (`build_species.py`, `build_regions.py`) and the
"Explore in 3D" panel's Information tab, which lives in the species pages' script (`build_regions.py`, `REAL_JS`).
The app itself (`snakelist-synced.html`) has no Information tab in its own 3D panel, so it was not changed.
The build now writes its counts to `data/content-audit.json` on every run.

## Pages checked

| What | Count | How |
|---|---|---|
| Species pages | 4,243 (4,074 living or recently extinct, 169 fossil) | build counts, `tools/check_pages.py` |
| Species with a reviewed, sourced account (`data/species-info/`) | 216 of the living (218 files incl. 2 fossils) | build counts |
| All generated pages link-checked | 12,093 pages, 810,282 internal links, 0 broken | `tools/check_links.py` |
| Sitemap URLs checked (file exists, canonical, title, description, h1, noindex) | 7,258 | audit script |
| Inspected in a browser (desktop 1366 px and phone 390 px) | Inland Taipan (famous), Bourret's Odd-scaled Snake (obscure), Titanoboa (fossil), Abor Hills Kukri Snake (no photo), Australia, *Oxyuranus*, Elapidae, and the 3D panel's Information tab on 3 species | Playwright |

## Data problems found

| Problem | Species affected | What changed |
|---|---|---|
| Three different length statements on one page: the sourced "Adult length", a "Size: Large-sized (adults about 2.1 m)" row whose number was a midpoint SnakeList calculated itself, and the Size paragraph | every species with a length (150 sourced) | The "Size" row is gone where a sourced length exists. The one length fact is labelled with what it gives: Typical adult length (47), Typical and maximum length (59), Average and maximum length (10), Average adult length (3), Maximum length (30), Reported length (1, the anaconda's popular claim), Estimated length (fossils). The 3D panel uses the same label (it said "Usual adult length" even for "Up to about 2 m"). |
| A size figure for species with no sourced length came from an unsourced genus guess (`tools/auto_models.py` GENUS_LEN) or the 3D model profile, shown as "adults of its genus are about 50 cm" | 3,840 (genus guess) + 75 (3D profile) | Shown only as "Rough size class: Probably medium-sized (SnakeList's estimate for its genus - not a measurement of this species)", with no made-up number, on the page and in the 3D panel. |
| "Not known" for facts SnakeList simply has no source for (read as "science doesn't know") | length 3,924, diet 3,934, reproduction 3,871 | Now "SnakeList doesn't have a verified source for this yet"; when two or more are missing they share one line ("Adult length, diet and reproduction: ... for these yet"). Same wording for constriction, the fossil section fallback, the habitat fallback, the limited-account note and "How this page is made". |
| Habitat estimate lists almost every environment: the app's habitat data was made from every habitat of the countries/states where a snake is recorded, not from species sources | 1,222 species without an account whose range covers more than 4 of the 11 broad habitat kinds | No habitat list is presented as theirs: the section says SnakeList has no species-specific source yet, and the kinds found across the range are only in a closed "Kinds of habitat found across the places where it is recorded" box, explained. The 2,513 with 4 or fewer kinds keep the list, now marked "Inferred, not sourced". |
| The key-facts "Habitats" row (the app's estimate) contradicted the sourced Habitat text (Inland Taipan: rainforests, coasts and sea vs "remote semi-arid country") | 150 accounts with a Habitat text | The row now points to the sourced Habitat section; for others it says "inferred from the places where it is recorded - not checked for this species", or "No species-specific source yet" when too broad. |
| Venom wording inconsistent: tags "Harmful"/"Harmless", key fact "dangerous to people", related tags "Not dangerous to people", "Venomous" tag on species whose fact said "Mildly venomous"; "Venomous - dangerous to people" for every elapid incl. tiny ones; "no serious bites documented" asserted for species SnakeList simply has no bite records for | 851 venomous (dangerous group), 150 mildly venomous, 3,073 not venomous | One vocabulary everywhere (`venom_text`): "Venomous - can be dangerous to people", "Mildly venomous - SnakeList has no record of serious bites to people", "Not venomous - but large enough to injure people", "Not venomous - low risk to people, though it can still bite". Tags: Venomous / Mildly venomous / Non-venomous + Dangerous to people / Low risk to people. Key fact renamed "Venom and safety". |
| "How to recognise it" bullets repeating the Appearance paragraph just below | 183 bullets on 111 species pages | Left out on the page (the 3D panel keeps them, as it has no Appearance text). |
| "Did you know?" items repeating a section | 9 items on 9 species | Left out. |
| Reference list collapsed when more than 8 sources, so a [n] link could land on a hidden list | 216 accounts | Always open, with a note that each number links to its reference. |
| 3D panel quick facts had no sources (only the length picture did) | 216 accounts | Each quick fact from an account shows its source(s) under it. |

### Audited and found sourced (nothing invented)

- Fang sizes: the only fang measurements in page text are 3 sourced sentences (Gaboon viper 5 cm, Eastern brown snake 2.8-4 mm, nose-horned viper 13 mm). The 3D models' `fangMm` values (`tools/auto_models.py` GENUS_FANG/SPECIES_FANG) are used only for geometry and are never shown as a fact; many are genus-wide values applied to every species of the genus - flagged for the 3D helper, not changed here.
- Lifespan: 2 sentences (boa constrictor, Elaphe taeniura), both sourced; the panel's "Lifespan" lines come only from these.
- Reproduction: every `facts.reproduction` (203) has sources, and none contradicts its section (eggs vs live young).
- Every fact, section paragraph, recognise line and fun fact in the 218 accounts has a source key that exists, except one SnakeList note ("About the map", sea snake), which is not a claim about the snake.

## SEO hygiene

| Problem | Count | Fix |
|---|---|---|
| Titles over 70 characters (species "– Explore in 3D" fallback, families, regions) | 1,743 | Shorter fallbacks; 59 left, all regions whose own name is long (e.g. "Sangre Grande Regional Corporation, Trinidad and Tobago"). Species titles still contain the h1 (checked by `tools/check_pages.py`). |
| Old genus pages (Alecto, Hurria, Trigonocephalus) indexable, outside the sitemap, listing redirect pages | 3 | Now no-index pages that send you to All species (generic: any genus/family page the build no longer makes). |
| Old-name pages with canonical `species/./` | 29 | Canonical is `species/`. |
| `species/photo-credits.html` indexable but not in the sitemap | 1 | Added. |
| Sitemap URL without a file, canonical mismatch, missing description, noindex page in sitemap, broken internal link | 0 | - |
| Pages with not exactly one h1 | 2 (home page, about.html) | Not species pages; left for the page owners. |

No ranking effect is promised; these only remove technical inconsistencies.

## Not done / remaining

- 3,858 living species still have no reviewed account; their pages honestly say so, but need sourced accounts (length, diet, reproduction, habitat) to be useful beyond names, range and venom group.
- The app's habitat data (`#habitat-data` in the app, used by its Habitats filter and the 3D scenes) is still range-based; only how the pages present it changed.
- `harm-data` decides "dangerous" by family/genus; species-level exceptions (very small elapids, medically significant colubrids) need sources.
