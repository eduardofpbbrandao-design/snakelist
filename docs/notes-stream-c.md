# Overhaul notes: stream C (place, family and genus pages)

Notes for docs/OVERHAUL.md items 11, 13, 14, 16, 25, 26 and 27 (place, family and genus templates).

## Item 14: why the map said Porto 10 and the pages said 8 (root cause)
The two numbers counted different things. Neither was stale.
- The pages counted species whose cards list `PT:Porto` in `data-provinces`. There are 8.
- The map's city list ("See cities", `livesNear()` in snakelist-synced.html) counts a species for a
  city if the species is recorded in the country and either (a) its records for that country name
  the city's district, or (b) it has **no** district records in that country at all. Its pool is
  `BYCODE[country]`, which also includes **fossil** taxa. For Porto that adds:
  - *Macroprotodon brevis*, recorded for Portugal with no district (case b, possible but not recorded);
  - *Portugalophis lignites*, a Late Jurassic fossil with a country record only (case b and a fossil).
  So 8 + 1 + 1 = 10. The same scope difference shows up in every country's city list.

What was done:
- The pages now define every count as **unique living species recorded in the place**. Fossil and
  extinct taxa are never counted. Species with country-level records only are shown separately as
  "possible".
- `species/place-counts.js` (`window.SL_PLACE_COUNTS`) is generated with the page numbers, so the
  app can show the same thing (see below). The app's map code was not changed (stream D).
- The species index's "Snakes by country" counts were also changed to count living species only.

## species/place-counts.js format
```
window.SL_PLACE_COUNTS = {
  "v": 1, "about": "...", "fields": {...descriptions...},
  "country": {"Portugal": [living, fossil, extinct, introduced]},          // key = data-countries name
  "region":  {"PT:Porto": [living, countryOnly, fossilOrExtinct, "district", "pt-porto"]},  // key = the app's place key (US:TX, PT:Porto, each raw map name)
  "city":    {"Porto|Portugal": ["PT:Porto", livingInRegion, countryOnly, "pt-porto" | null]}  // key = SL_CITIES name|country
}
```
Porto: region `[8,1,0,"district","pt-porto"]`, city `["PT:Porto",8,1,"pt-porto"]`, Portugal `[10,1,0,0]`.
What stream D should show: "8 species recorded in Porto District" (+ "1 possible"), with fossils excluded.

## Other findings
- Fossil ages under 1 million years were shown 1,000 times too young ("Crotalus potterensis: about
  20 years ago"). Fixed in `build_species.build()`, which also affects the species pages (stream B).
  The app's own display of FOSSIL_AGE was not checked.
- The map data has a district named "of Bougainville" (PG). Pages now call it "Bougainville",
  an autonomous region. The page moved from `pg-of-bougainville` to `pg-bougainville`; pages.js maps
  the app key to the new page.
- Some big cities fall into the wrong admin-1 shape because the map has no shape for chartered
  cities (Addis Ababa is placed in Oromia). This was not fixed.
- No city-level observation data exists offline. City pages say so and link to an iNaturalist
  10 km search, which SnakeList does not count.
- Species-page "(N species in all)" figures for a state still use all ids. This makes a difference
  only for Guadeloupe, where it counts 1 fossil (stream B's template).
