# Advent rewards: a proposal for Eduardo to review

Status: proposal only. Nothing in the app has changed. The current list in `events/config.js` (`advent`,
`adventBonus`, `grandPrize`) stays live until you approve, so going back costs nothing.

## The problem with the current list

The 24 rewards are well named (a candy-cane corn snake ornament, a gingerbread hognose and so on), but in
use they are 24 small pictures in a grid. Most are a "Sticker", "Badge", "Ornament" or "Decoration" with
nothing to do except "Show in Cabin" (the mantel holds 8). Three badges and five ornaments look alike, and
there is no reason to come back except the streak. The grand prize is one more picture plus a badge.

## The idea: a Winter Field Kit

Each door adds a piece to a **Winter Field Kit**: real snake natural history with a Christmas look.
Every reward is one of four kinds, and each kind looks different and does something different:

| Kind | Doors | What you get | Where it shows | Why it's useful |
|---|---|---|---|---|
| **Field Card** | 10 | A collectible card for one real species: an illustrated portrait, 3 facts, its range and one "how to find it" tip. Foil border when opened on its day, plain when opened with a skip. | My collection, as a binder of cards. Tapping one opens that species in SnakeList. | Teaches. Links into the guide, the map and 3D. Cards can be shared as images. |
| **Cabin piece** | 6 | A real object for the Cabin (tree topper, garland, fireplace, rug, window view, lantern) in a fixed slot. | The Cabin itself changes, not a shelf. | You can see your progress in the room. |
| **Field tool** | 4 | Small, lasting features: a winter colour theme for the map, a "snake of the day" home-screen widget card, a printable checklist of your Seen snakes, and a "brumation" fact layer in 3D (which species are dormant in December where you live). | In the app, switched on from Settings. | Lasting and useful after Christmas, and not paywalled (all free). |
| **Profile flair** | 4 | A frame, a title ("Winter Herper"), a name colour and a badge row for your profile and sightings. | Profile and shared sighting cards. | Visible to others. Gives a reason to finish. |

The kinds are spread through the month. Days 6, 12, 18 and 24 hold the Cabin pieces that change the room
most (the tree, the fireplace, the window and the topper), so the room fills in week by week.

### Example doors (first week)

1. **Field Card: Smooth Green Snake**, in a Santa hat (the cover snake). A "how to spot it" tip.
2. **Cabin piece: Corn-snake candy-cane garland** over the fireplace.
3. **Field Card: Arctic-edge adder (*Vipera berus*)**, the snake that lives furthest north. Why it can survive the cold.
4. **Field tool: Winter map**: frost-blue land and snowy relief on the SnakeList map until 6 January (can be kept on afterwards).
5. **Field Card: Ball python**: the "Cozy Scarf" portrait, with facts about how it curls up.
6. **Cabin piece: The tree**: a bare tree appears in the Cabin, and later doors add ornaments to it.
7. **Profile flair: "Winter Herper" title.**

Subscriber Frost Edition bonuses (doors 4, 8, 12, 16, 20 and 24) become **alternate art** for that door's
reward: a frosted Field Card or an aurora-lit Cabin piece. Nothing behind them is missing for free accounts.

## The completion reward: the Legendary Christmas Serpent, rebuilt

Opening all 24 doors (skips count) unlocks three things at once:

1. **A living Cabin companion.** A golden serpent (a gold Morelia in 3D, using the existing model system)
   coils round the tree in your Cabin and follows the cursor with its head. It's the only animated 3D
   reward, so it stands out.
2. **Your SnakeList 2026 Year Card.** A one-page, shareable card: snakes you've seen this year, your
   rarest sighting, your most-visited family, quiz score and doors opened. You can download it as an image.
   It's personal, so no two are the same, and it's useful to keep.
3. **The Gold Field Binder.** Your 10 Field Cards get gold edges, and a permanent "Legendary 2026" frame
   is added to your profile. It can never be earned again.

Progress towards it is shown at all times: "17 / 24 doors. 7 to the Legendary Serpent", plus a preview
silhouette of the serpent that fills in with gold door by door. That's more motivating than a plain bar.

## Rules kept as they are

- Each door is claimed once, saved to the account, and checked by the Firestore rules.
- A skip covers one door you choose (missed, or upcoming while `skipCanClaimFuture` is on). It counts for
  the 24 and the grand prize, not for the streak. Doors opened with subscriber skips don't count towards
  achievements.
- Everything earned stays yours after the event and after a subscription ends.

## What I need from you

1. Approve the four kinds (or say which to drop).
2. Pick the 10 Field Card species. The default is the 16 cover-photo snakes plus *Vipera berus*. The Field
   Cards would use the existing species facts and photos (with credits).
3. Year Card: OK to show sighting counts on a shareable image? It is only made when you press "Download".

If you approve, the change goes in `events/config.js` as a new `advent` list. The old list stays
in the file as `adventClassic` so it can be restored by renaming one key.
