# Christmas 2026 + New Year 2026–27 preview — audit, round 4

Preview only: `?preview=events` (Advent, countdown, achievements, cursor, subscription page), `?christmas`
(decorations + Christmas Cabin) and the new `?preview=newyear`. `events/config.js` keeps `xmasPublic: false`; no
event date was changed. Every check below was made in the rendered page with fake clocks (Playwright `page.clock`,
the "server" Date header following it) — never with real dates or real user data.

## What was found and what changed

| Area | Found | Changed |
|---|---|---|
| Cabin layout | Scene 1230×740 on desktop, then a long row of buttons and two unlabelled sliders under it, on the pale green page | One dark evergreen card: the scene with a compact control column beside it on wide screens (labelled groups: *In your Cabin*, *Fireplace*, *The room*, *Sound*), under it on iPad / phone. On a 1280×900 screen the whole Cabin is 595 px tall — tree, fireplace, presents and every control at once |
| Sound | Two bare sliders | The same two controls with their names (*Christmas music*, *Fireplace*) and on/off buttons; volumes already remembered (`sl-xmas-audio`), now said so |
| Logs | A small number on a button; a disabled button at 0 | "*N logs in the basket*", how logs are earned (quiz answers, exploring snakes, Christmas tasks; the basket holds 8); at 0 a friendly line that lights up instead of a dead button |
| Touchable room | Only the presents reacted | The tree (opens *My decorations*), the fire and the log basket (add a log) are focusable buttons with a lit outline + label on hover, focus and press; presents glow on hover/focus |
| Art | Bells floating in the air; flat stones | A pine tip drawn over every ornament's and bauble's hook (they hang from branches); stones shaded (lit top, shadow under, recessed mortar), a light line along each wall log; firelight glow on the hearth, stone breast, mantel underside and rug, flickering and swelling with a new log |
| Advent doors | Gold doors everywhere; locked doors dimmed to 72 % with faded numbers; states partly colour-only | Evergreen / cranberry / ivory doors; locked doors only slightly dimmed, numbers at full strength, lock in its own badge. Every state has a word or icon: *Today + Claim*, *Opened* (tick or skip glyph), *Missed* (skip icon, struck number), *Reserved* (ribbon), *Coming* (lock). A five-state key |
| Today | Glow only | Gold ring + "TODAY" ribbon, and a *Jump to today · door N* button that scrolls to it, focuses it and pulses it |
| Skips | Explained three times (rule line, key, long paragraph) | One *How skips work* box: unfolded the first time, folded afterwards (remembered); free streak skips and the up-to-10 subscriber skips explained apart |
| Reveal | Door animation always plays; reward and bonus mixed with gold card edge | *Skip animation* button (focused while it plays; Enter skips); repeats show the reward at once. "Your reward · everyone gets this one" chip, the subscriber bonus in its own box. Cranberry button |
| Doors vs presents | Easy to mix up | Calendar: "*Final reward · for all 24 doors*" above the grand prize and a line saying the Cabin's presents come from Christmas tasks. Cabin: "*Advent Calendar — 24 doors, one a day*", "*Christmas tasks — 8 presents to earn*", "*Tree presents: 0 of 8 opened*" |
| Legendary Serpent | Head was the end of the tube facing the viewer ("worm with eyes"); random gold blotches. Early-access note, reveal card and bonus box also used the gold edge | Head turned three-quarters with a slim neck, broad temples and a spade-shaped snout, darker crown with one pair of gold plates, dark stripe from eye to jaw, pale lips; a gold diamond chain along the back. Only the Legendary box (and its pop-up) keep the gold-and-emerald styling |
| Countdown | Digits already tabular in fixed cells; `aria-label` with seconds rewritten every 250 ms; no date in the banner | Digits `aria-hidden`; the banner's name changes once a minute at most; the panel has one visually hidden polite line updated per minute. Banner shows the moment and the time zone ("Tue, Dec 1, 12:00 AM · Lisbon time"). On the Map tab (and during the New Year card) the banner is one slim 42 px line |
| Welcome | — | Checked: it waits until other pop-ups may show (`SL_promptsReady`), keeps the app's prompts (incl. *What's new*) away while open, closes an automatic *What's new* and is remembered (`sl-xmas-welcome-seen:xmas2026`) |
| Cursor in Settings | Mounted into the whole Settings body (`.sl-pbody`), so outside the tab panels | Mounted into the Display tab (`[data-sl-settings-body]`), never inside a button/link; a copy left by an older build is moved. No nested buttons in Settings, the Cabin, the banner or the New Year card (test) |
| Palette | Several greens/reds/golds | One set: `#123D2A`, `#216B45`, `#A92E3E`, `#FFF8ED`, `#D8B76A` (gold only for today, the Legendary box, the progress line, small labels) |
| Snow | Cover snow kept moving with SnakeList's own *calm* setting; premium Cabin snow over everything | Cover snow stands still with reduce motion **or** the calm setting; the Cabin's premium snow only over the window/upper room (never over presents, controls or labels); none on the map |

## The Advent skip rule (Eduardo, 2026-11-24) — already implemented, now tested

`events/advent-logic.js` (and `firebase/firestore.rules`, `skipFuture()`): a skip covers ONE door the person
chooses — a **missed** day (recovered, reward at once) or, while `advent.skipCanClaimFuture` is true, a **future** day
once the calendar has started (reserved: it counts at once, its reward stays wrapped until its own day). Protection,
all covered by `tests/christmas-r4.js`:

* a door can be covered once (`already-claimed`, also on its own day after being reserved);
* today's door is never a skip target (it is simply claimed); nothing before 1 December or after the event;
* free skips can't go below zero (`no-earned-skips`); subscriber skips need a subscription and stop at 10
  (`subscriber-skip-cap`), counted apart from free skips;
* a reserved door's reward (and anything it unlocks) shows only from its own day, once;
* free skips = one per 3 covered doors in a row, worked out once per door (never more than 8); the 3-day-streak
  achievement counts only doors opened on their day; doors covered with subscriber skips never count towards
  achievements.

## New Year 2026–27 (`?preview=newyear`, `events/newyear.js`)

* Preview key `newyear` in `tools/previews.js` DEFS (follows the account like the others); in the claude.ai copy
  a *New Year preview* switch (off at first). `tools/events_loader.js` loads the events modules when `events` **or**
  `newyear` is on.
* Theme tokens `.sl-ev-t-newyear` (midnight blue, deep green, gold, silver); `html.sl-ny` while it shows. The
  Christmas cover corners, Santa hats and cover snow step aside; the Cabin, Advent, collection and achievements stay.
* "HAPPY NEW YEAR 2026–2027!" above the logo between two snakes in party hats ("HAPPY NEW YEAR!").
* Countdown card to **1 January 2027 00:00 in the viewer's own time zone** (SnakeList has no time-zone setting yet,
  so the browser's), reusing the countdown's clock (`EV.clock`), with fireworks inside the card only. The Christmas
  banner's "Time until New Year" now also counts to local midnight (`{ local: true }` in config, `EV.atMs`).
* At midnight with the page open: a celebration with fireworks — *Skip* button and Escape, ends by itself, once per
  browser (`sl-ny-midnight-seen:2027`); still with reduce motion. *Play the midnight moment* shows it any time.
* After midnight: "Welcome to 2027!" and "Your Christmas rewards stay yours: N Advent doors…".
* A future event = its tokens (`.sl-ev-t-<theme>`) + a small module like `newyear.js` using `EV.clock`, `EV.panel`,
  `EV.time`.

## Tests

* `tests/christmas-r4.js` (new): skip rule (logic), Advent states / Jump to today / skips explained once / skippable
  reveal / Legendary-only gold, countdown screen-reader text + date + map state, Cursor section placement + no nested
  buttons, Cabin layout on desktop / iPad / phone + logs + keyboard, New Year preview end to end.
* `tests/events.js`: one assertion moved from the old streak line to the new *How skips work* box.

## Screenshots

`batch109/christmas/before/` and `batch109/christmas/after/` (desktop 1280×900, iPad 820×1180, phone 390×844):
cabin, advent calendar, reward reveal, countdown banner / panel / map, Legendary box + serpent, New Year.

## Still to do

* SnakeList has no time-zone setting of its own; the New Year countdown uses the browser's zone.
* The welcome pop-up could not be made to appear by itself in the test browser (it waits for `SL_promptsReady`);
  its once-only flag and its blocking of other prompts were checked by opening it directly.
* Outside the Christmas parts the app's own card photo button (`span.photo-btn[role=button]`) contains a
  *Remove photo* button — a nested-interactive issue in `snakelist-synced.html`, not changed here.
