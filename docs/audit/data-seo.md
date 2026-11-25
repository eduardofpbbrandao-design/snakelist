# Data accuracy and SEO audit (data-seo)

Test: `PORT=<port> node tests/data-seo.js` (after `python3 build-site.py` and a local server). 38 checks, all passing.

## 1. Venom status: one source of truth

**Problem.** The Asian Vine Snake (*Ahaetulla prasina*) page said "mildly venomous" in its intro, "Non-venomous" in its key-fact tag and "Not venomous – low risk" in Venom and safety.

**Where each came from.**

| Place | Source before |
|---|---|
| Intro | its sourced account, `data/species-info/ahaetulla-prasina.json` (overview) |
| Key-fact tag, Venom and safety, lead sentence, genus table | the app card's `data-venomous` flag (`build_species.py`) |
| App: Venomous / Non-venomous filters, card tag, quick look, quiz ("Is it venomous?"), map lists, sightings | the same card flag (`snakelist-synced.html`) |
| Country, region, city and family pages | the same card flag (`build_species.py`, `build_regions.py`) |
| 3D anatomy (venom glands) | the 3D body plan (viper, elapid, sea snake). Not changed: see Remaining work |

The flag was set per genus. Every *Ahaetulla* card was 0, and so were most other rear-fanged genera.

**Fix.**
- `data/venom-status.json` is now the single source. It lists the rear-fanged families (Homalopsidae and Psammophiidae) and 30 rear-fanged genera, each with a reason and a source. It also lists 5 genera that were reviewed but left as non-venomous (*Heterodon*, *Thamnophis*, *Erythrolamprus*, *Apostolepis*, *Coronella*).
- `tools/venom_status.py` writes the file into the cards: it sets `data-venomous="1"` and adds the existing red Venomous tag. `--check` reports any card that disagrees.
- Every page and app view reads the cards. `build_species.py` prints a warning when a card disagrees with the file.
- One wording everywhere: `venom_label()` in `build_species.py` gives Venomous, Mildly venomous or Non-venomous. "Venomous" means listed in `#harm-data` as dangerous to people. "Mildly venomous" means venomous but not listed there. The app's quick look and the quiz explanation now use the same words.
- Two fossil cards had the wrong family: *Naja suevica* is now Elapidae and *Psammophis odysseus* is now Psammophiidae.

**Counts.**
- 398 cards in 65 genera changed from non-venomous to (mildly) venomous. The app's Venomous filter goes from 1,021 to 1,419.
- *Dispholidus*, *Thelotornis*, *Rhabdophis*, *Boiga* and *Philodryas* were already venomous. The first three stay "dangerous" through `#harm-data`.
- 11 sourced accounts contradicted their flag before the fix, and 1 does now. The remaining one, *Thamnophis marcianus* ("very mild venom"), is a reviewed exception: garter snakes stay non-venomous.
- The test checks that every account saying mildly venomous, rear-fanged or mild venom has a venomous card, and that no account saying non-venomous does.

## 2. Published range vs countries with records

The country list, the map and "N countries" come from observation records, not from a published range. For example, *A. prasina* is recorded in 7 countries, while its published range also includes India, Bangladesh, China, Indonesia and the Philippines.

Changes on the species pages:
- Key fact: "Recorded in 7 countries". When the sourced published distribution names other countries, a line adds: "Its published range also includes India, Bangladesh, China, Indonesia and the Philippines, where SnakeList has no records of it yet."
- Country list heading: "Countries with records of it in SnakeList".
- Map legend: "Native (countries with records)". The map note says a country with no records is not necessarily outside the range, and names any published-range countries that are not shaded.
- App quick look: "Countries with records (N)".

Countries are matched conservatively (`published_countries()`):
- Only native-range sentences are used. Broad-sense, pre-split and introduced paragraphs are skipped, and so are sentences about "separate species", "except" and similar.
- Ambiguous names are skipped: New Mexico, New Guinea, South Sudan, Georgia in an American range, and Congo on its own.

49 species pages carry the "published range also includes" note, covering 122 country mentions.

## 3. Length

- No account contradicts itself between its key fact and its Size section. 10 differ by more than 12%, but in each case the key fact gives typical adults and the Size section also gives a maximum or record. The v6.20 labels (Typical / Maximum / Average and maximum length) already say which is which.
- **Fixed:** `length_m()` read numbers inside brackets that describe something else. For example, "Up to about 1.8 m (tail about 0.6 m)" drew a 0.6–1.8 m snake in the 3D size comparison and set the auto model's length. Brackets about the tail, head, one female, a record or "some sources" are now ignored; unit conversions are kept. This affects *Ahaetulla prasina*, *Helicops angulatus* and *Malpolon monspessulanus*.
- No 3D model length falls outside its sourced range (checked with 25% / 60% margins).

## 4. Species totals

The static pages were already counted (`N_SPECIES` in `build-site.py`, `_fix_totals`, and `[data-sl-total]` updated at runtime). Two places were still hard-coded:
- The home page meta description and the app manifest said "4,000+ snakes". They now use the counted total, for example "4,243 snake species".
- The app tour said "the 4,000+ known species". It now reads the counted `[data-sl-total]`.

The test checks every "N species" in the visible text of index, about, about-snakelist, install, llms.txt and the species index against the card count.

## 5. SEO

- **Titles.** All 4,243 species pages use the form "Common (Scientific) – Photos, Range & Facts | SnakeList", or "Scientific – …" when there is no common name. A title only names what the page has: no "Photos" without a photo, no "Range" without a recorded country, and "Fossil Snake Facts" for fossils. Titles are kept within about 70 characters by dropping "Range", then "Photos". All are unique.
- **Meta descriptions.** All are unique. They are built from the sourced overview, or from the card-derived lead sentence, which now says "mildly venomous" where that applies.
- **Canonicals.** Each species page's canonical is its own extension-less address, and og:url matches it. The 3,810 old scientific-name-only addresses (`species/ahaetulla-prasina`) are `noindex` stubs with a canonical link, meta refresh and a JS redirect to the page.
- **Sitemap.** 7,258 URLs, no duplicates. No stubs and no noindex pages are listed. Every sitemap URL's page has a canonical equal to that URL. robots.txt allows all crawlers and names the sitemap.
- **App links.** Six places linked to the old scientific-name-only address, which then redirected: the card's See more info button, the photo viewer's Explore in 3D, the 3D viewer's page link and See more info, the fossil panel's button, and one `pageUrl(id)`. They now use `SL_SP_PAGE_URL` (common-name-scientific-name), with the old address as a fallback. The static pages had no links to stubs.
- **Structured data.** Taxon, BreadcrumbList and 3DModel only. There are no ratings, reviews or offers on species pages, and the 3DModel description says it is generated, not a scan.
- **Alt text.** Every snake photo has alt text ("Photo of …"). The only empty alt is the decorative header icon.
- **Static facts.** Key facts, published distribution, the country list and sources are in the static HTML.
- **Internal links.** Species pages link to their genus and family pages, related species and region pages. No new pages were created.

## 6. "No common name" on cards

495 cards already showed the scientific name as their title, with a second line saying "No common name". That line is now hidden (`display:none`), so the scientific name stands alone. Nothing else about the card's look changes.

The element is kept because the quick look, search, quiz and map read it. The light-cards build still recognises the card.

## Remaining work

- **3D anatomy.** The venom-gland label comes from the 3D body plan, so rear-fanged colubrids show no venom gland. The model profiles already carry `rearFang`. A "Duvernoy's gland" label for those would be a 3D content change, which needs approval.
- **Reviewed exceptions** (*Heterodon*, *Thamnophis*, *Erythrolamprus*, *Apostolepis*, *Coronella*) need an expert source in their accounts before they change.
- **Card data quality.** Some cards' countries are clearly partial. For example, *Rhabdophis tigrinus* is recorded only in Russia, with continent Europe. The new wording makes this visible where a published distribution exists, but the records themselves were not changed.
- **Two habitat estimates.** The key-fact "Habitats" (the app's filter sections) and the Habitat section (range estimate) can list different kinds of habitat, for example 4 vs 5 for *A. prasina*.
