/* SnakeList events - the one place to change dates, rewards, achievements, benefits and prices.
   Everything in events/ only runs with the "events" preview switched on (tools/events_loader.js).

   Times are single official instants in UTC (ISO strings ending in Z). Every viewer sees them in their own
   local time, but a door, an event or a promotion opens at the same moment for everybody.
   The Firestore rules (firebase/firestore.rules) repeat the Advent dates - change both together. */
(function (root) {
  "use strict";
  var C = {
    version: 1,
    // where the trusted clock comes from: a HEAD request to this page; the server's Date header is the time
    timeProbe: "",              // "" = this page's own address
    timeResync: 10 * 60 * 1000, // ms between re-checks while the page stays open

    /* ------------------------------------------------------------------ subscription ------------------ */
    subscription: {
      name: "SnakeList Supporter",
      // prices are NOT live: there is no payment backend yet, so nothing can be bought. See events/PRICING.md.
      currency: "EUR",
      price: 0.21,                 // per interval (Eduardo's wish; below Stripe's EUR minimum of 0.50 per charge)
      interval: "month",           // "month" | "year"
      intervalCount: 1,
      priceStatus: "placeholder",  // shown as "price not final"
      // false until a real Stripe price exists (stripe.priceId filled in): the subscription page then says priceTba
      // instead of a made-up price, billing period, renewal or cancellation terms. true shows price + billing again.
      priceAnnounced: false,
      priceTba: "Price to be announced",
      // December promotion as Eduardo asked: discount % = the day of the month (Dec 1 = 1 % ... Dec 31 = 31 %)
      decemberDayDiscount: true,
      // New Year 2026-27 promotion (configurable; see PRICING.md for why 0.01 can't be charged)
      newYearPromo: { event: "newyear2027", price: 0.01, alternative: "first month free" },
      stripe: { publishableKey: "", priceId: "" },   // filled in only when the backend exists - never a secret key here
      // Firestore path the Stripe "Run Payments with Stripe" extension writes (clients can only read it)
      customersCollection: "customers",
      activeStatuses: ["active", "trialing"],
      benefits: [
        ["early", "Early access to events", "Seasonal events open for you before everyone else (the Advent doors still follow the calendar)."],
        ["deco", "Exclusive seasonal decorations", "Premium Cabin decorations, like the Diamond Snake Ornament and the Aurora Borealis background."],
        ["extra", "Extra Advent rewards", "A bonus Frost Edition reward behind every fourth door."],
        ["skips", "Up to 10 Advent skips", "Recover days you missed - kept separate from the skips everyone earns with streaks."],
        ["cursor", "Cursor customization", "Colours and effects for your mouse pointer (computers with a mouse or trackpad)."]
        // only benefits that exist in the app - add profile frames/badges here once SnakeList has a profile to show them
      ],
      alwaysFree: "Every snake, photo, map, sighting, quiz and achievement in SnakeList stays free. A subscription only adds extras.",
      // what happens to subscriber items when a subscription ends (disclosed on the subscription page)
      afterExpiry: "If your subscription ends, every Advent door you opened and every reward behind it stays yours for good. Subscriber extras - Frost Edition bonuses, premium decorations and cursor effects - are shown only while a subscription is active, and come back if you subscribe again. Your choices are remembered; nothing is deleted.",
      refund: {
        heading: "Refunds and your right of withdrawal",
        lines: [
          "Payments are non-refundable where legally permitted.",
          "As a consumer in the EU (including Portugal) you normally have the right to withdraw from an online contract within 14 days without giving a reason (Directive 2011/83/EU, Decreto-Lei n.º 24/2014).",
          "Because a subscription gives you digital content and services straight away, you will be asked to agree that it starts immediately and to confirm you understand that you lose the 14-day right of withdrawal once it has started. Without that agreement you cannot subscribe.",
          "This does not affect your other legal rights, such as the right to a fix or a refund if something you paid for doesn't work as described."
        ],
        consentStart: "I want my subscription to start immediately, before the 14-day withdrawal period ends.",
        consentLose: "I understand that, because it starts immediately, I lose my right of withdrawal once the digital content has been supplied."
      },
      renewal: "Renews automatically at the end of each billing period, at the price shown when you subscribed, until you cancel. We will remind you before any price change.",
      cancellation: "Cancel any time from Manage subscription. You keep your benefits until the end of the period you already paid for; nothing more is charged."
    },

    /* ------------------------------------------------------------------ events ------------------------ */
    // phase order: upcoming -> early (subscribers only, from earlyAccess) -> live (start..end) -> ended
    events: [
      {
        id: "xmas2026", name: "SnakeList Christmas 2026", short: "Christmas 2026", theme: "xmas", firstEver: true,
        description: "The first ever SnakeList event: a 24-door Advent Calendar in the Christmas Cabin, festive decorations, streak skips and the Legendary Christmas Serpent for everyone who opens all 24 doors.",
        start: "2026-12-01T00:00:00Z", end: "2027-01-01T00:00:00Z", earlyAccess: "2026-11-29T00:00:00Z",
        countdownFrom: "2026-11-01T00:00:00Z",
        // the countdown's wording and what it counts to once the event is open (each counts to its "at", in turn)
        countdown: {
          comes: "Comes December 1",                   // shown above the numbers before the event opens
          openButton: "Explore the Christmas event",   // takes the timer's place once the event is open for this viewer
          after: [
            { at: "2026-12-25T00:00:00Z", label: "Time until Christmas" },
            { at: "2027-01-01T00:00:00Z", label: "Time until New Year" }
          ]
        },
        advent: {
          days: 24, firstDoor: "2026-12-01T00:00:00Z",   // door N opens at firstDoor + (N-1) days and is "on time" for 24 hours
          recoverUntil: "2027-01-01T00:00:00Z",          // skips can recover missed doors until the event ends
          streakForSkip: 3,                              // every 3 doors in a row opened ON THEIR OWN DAY earn 1 free skip
          // A skip covers ONE eligible door the person chooses: a missed day (recovered) or, while this is true, an
          // upcoming day claimed early (once the calendar has started, never before). Eduardo, 2026-11-24 - replaces the
          // earlier rule "skips never open future days"; false brings that rule back. firebase/firestore.rules repeats
          // it (skipFuture()) - change both together.
          skipCanClaimFuture: true,
          subscriberSkips: 10,                           // per event, tracked apart from earned skips
          grandPrize: "legendary-serpent"
        },
        free: ["24 Advent doors, one a day", "A free skip for every 3-day streak", "The Legendary Christmas Serpent for opening all 24", "All seasonal achievements"],
        subscriber: ["Early access from 29 November", "Frost Edition bonus behind every 4th door", "Up to 10 extra skips for missed days", "Premium Cabin decorations"]
      },
      {
        id: "newyear2027", name: "New Year 2026–2027", short: "New Year", theme: "newyear",
        description: "Ring in 2027 with SnakeList: a midnight countdown, fireworks over the Cabin and three New Year achievements.",
        start: "2026-12-31T00:00:00Z", end: "2027-01-08T00:00:00Z", earlyAccess: null, midnight: "2027-01-01T00:00:00Z",
        countdownFrom: "2026-12-26T00:00:00Z",
        promo: { kind: "price", label: "New Year promotion", note: "Proposed: first month free (see pricing note)" },
        free: ["New Year achievements", "Fireworks decoration"], subscriber: []
      },
      {
        id: "firstever", name: "First Ever SnakeList Event", short: "First Ever Event", theme: "xmas", meta: true, inside: "xmas2026",
        description: "A badge for everyone who took part in SnakeList's very first event, Christmas 2026. It can never be earned again.",
        start: "2026-12-01T00:00:00Z", end: "2027-01-01T00:00:00Z"
      },
      {
        id: "snakeday2027", name: "World Snake Day 2027", short: "World Snake Day", theme: "snakeday",
        description: "16 July is World Snake Day - a day to celebrate snakes and learn why they matter.",
        start: "2027-07-16T00:00:00Z", end: "2027-07-17T00:00:00Z", earlyAccess: "2027-07-15T00:00:00Z", countdownFrom: "2027-07-01T00:00:00Z",
        free: ["World Snake Day achievement"], subscriber: ["Early access from 15 July"]
      },
      {
        id: "anniversary2027", name: "SnakeList Anniversary 2027", short: "Anniversary", theme: "anniversary",
        description: "SnakeList's birthday, 21 August. Every account can claim one free subscription period - no card needed and no automatic charge afterwards.",
        start: "2027-08-21T00:00:00Z", end: "2027-08-28T00:00:00Z", earlyAccess: null, countdownFrom: "2027-08-01T00:00:00Z",
        promo: {
          id: "anniv2027-free", kind: "free-period", days: 30, oncePerAccount: true,
          label: "Free 30-day subscription",
          disclosure: "Claim once per account between 21 and 27 August 2027. Gives 30 days of subscriber benefits for free. It ends by itself - it never turns into a paid subscription unless you choose to subscribe yourself."
        },
        free: ["A free 30-day subscription (once per account)", "Anniversary achievement"], subscriber: []
      },
      {
        id: "halloween2027", name: "SnakeList Halloween 2027", short: "Halloween", theme: "halloween",
        description: "Spooky snakes, glowing eyes in the dark and a Halloween achievement.",
        start: "2027-10-24T00:00:00Z", end: "2027-11-01T00:00:00Z", earlyAccess: "2027-10-22T00:00:00Z", countdownFrom: "2027-10-01T00:00:00Z",
        free: ["Halloween achievement"], subscriber: ["Early access from 22 October"]
      }
    ],

    /* ------------------------------------------------------------------ advent rewards ---------------- */
    // art: shape + colours (events/advent.js draws them). Each is a permanent reward, claimable once.
    advent: [
      { day: 1,  id: "santa-sticker",   name: "Santa-Hat Snake Sticker",      kind: "Sticker",     art: ["sticker", "#C8323F", "#FFF3E0"], desc: "The SnakeList S in its very own Santa hat." },
      { day: 2,  id: "candycane-orn",   name: "Candy-Cane Corn Snake Ornament", kind: "Ornament",  art: ["ornament", "#E2553F", "#FFE9DF"], desc: "Striped like a corn snake, sweet like a candy cane." },
      { day: 3,  id: "frost-badge",     name: "Frosted Scale Badge",          kind: "Badge",       art: ["badge", "#5DA9D6", "#EAF6FF"], desc: "A scale-pattern badge with a coat of frost." },
      { day: 4,  id: "python-garland",  name: "Green Tree Python Garland",    kind: "Decoration",  art: ["garland", "#2E9E4F", "#F2C94C"], desc: "A garland that drapes like a green tree python on a branch." },
      { day: 5,  id: "golden-egg",      name: "Golden Snake Egg",             kind: "Collectible", art: ["egg", "#E0B13B", "#FFF5CF"], desc: "Most snakes hatch from eggs. This one is solid gold." },
      { day: 6,  id: "rattle-bell",     name: "Snowy Rattle Bell",            kind: "Decoration",  art: ["bell", "#C99A2E", "#FFFFFF"], desc: "Rings like a rattlesnake's tail - but much friendlier." },
      { day: 7,  id: "winter-notebook", name: "Winter Field-Notebook Cover",  kind: "Cosmetic",    art: ["notebook", "#24533A", "#E8D9B0"], desc: "A snowy cover for your field notes." },
      { day: 8,  id: "ginger-hognose",  name: "Gingerbread Hognose",          kind: "Collectible", art: ["cookie", "#B9733A", "#FFF1DD"], desc: "Upturned snout, iced with care." },
      { day: 9,  id: "milk-wreath",     name: "Mistletoe Milk Snake Wreath",  kind: "Decoration",  art: ["wreath", "#2F7D45", "#D23B3B"], desc: "Red, black and cream bands woven into a wreath." },
      { day: 10, id: "viper-ice-orn",   name: "Ice Crystal Viper Ornament",   kind: "Ornament",    art: ["ornament", "#4C8FC9", "#E6F4FF"], desc: "Clear as ice, with a viper's diamond pattern." },
      { day: 11, id: "scarf-python",    name: "Cozy Scarf Ball Python",       kind: "Collectible", art: ["plush", "#8C6A3F", "#C8323F"], desc: "A ball python curled up in a knitted scarf." },
      { day: 12, id: "adder-lantern",   name: "Night Adder Lantern",          kind: "Decoration",  art: ["lantern", "#3D5A47", "#FFC861"], desc: "A warm lantern for long winter nights." },
      { day: 13, id: "glow-scale",      name: "Glowing Emerald Scale",        kind: "Collectible", art: ["gem", "#1FBF6A", "#B8FFD8"], glow: true, desc: "A scale that glows in the dark - a rare discovery." },
      { day: 14, id: "shed-stocking",   name: "Shed-Skin Stocking",           kind: "Decoration",  art: ["stocking", "#B8323F", "#F4EBDD"], desc: "A stocking stuffed with a perfect, unbroken shed." },
      { day: 15, id: "herp-globe",      name: "Herpetologist's Snow Globe",   kind: "Collectible", art: ["globe", "#7FB6D9", "#2E9E4F"], desc: "Shake it and a tiny snake glides through the snow." },
      { day: 16, id: "holly-king-orn",  name: "Holly Kingsnake Ornament",     kind: "Ornament",    art: ["ornament", "#1E5E3A", "#D8B24A"], desc: "Holly-green with the golden bands of a kingsnake." },
      { day: 17, id: "winter-frame",    name: "Winter Profile Frame",         kind: "Cosmetic",    art: ["frame", "#2E6F8E", "#FFFFFF"], desc: "A frosty frame for your SnakeList profile picture." },
      { day: 18, id: "garter-bow",      name: "Garter Snake Ribbon Bow",      kind: "Decoration",  art: ["bow", "#E2B63B", "#244E33"], desc: "Striped yellow and green, like a garter snake." },
      { day: 19, id: "coral-orn",       name: "Peppermint Coral Ornament",    kind: "Ornament",    art: ["ornament", "#D8413A", "#FFE36E"], desc: "Red, yellow and black rings - admire, don't touch." },
      { day: 20, id: "flake-badge",     name: "Snowflake Scale Badge",        kind: "Badge",       art: ["badge", "#7A8FD6", "#FFFFFF"], desc: "Every snowflake is different - so is every snake." },
      { day: 21, id: "fireside-boa",    name: "Fireside Boa Plush",           kind: "Collectible", art: ["plush", "#7C5A3A", "#E8C38A"], desc: "A boa constrictor plush warming up by the fire." },
      { day: 22, id: "aurora-star",     name: "Aurora Tree-Topper Star",      kind: "Decoration",  art: ["star", "#5FD3B3", "#B794F6"], desc: "A star that shimmers with northern lights." },
      { day: 23, id: "eve-moon",        name: "Christmas Eve Ouroboros Moon", kind: "Collectible", art: ["moon", "#F1E3A8", "#2A3B6B"], desc: "A snake circling the moon on the night before Christmas." },
      { day: 24, id: "fang-bell",       name: "Golden Fang Bell",             kind: "Decoration",  art: ["bell", "#E9C04A", "#C8323F"], desc: "The last door's bell - ring it for the grand prize." }
    ],
    // subscribers: an extra Frost Edition reward behind every fourth door (shown, but locked, for everyone else)
    adventBonus: [
      { day: 4,  id: "b-silver-charm",  name: "Frost Edition: Silver Bell Charm",   art: ["bell", "#B9C6D6", "#FFFFFF"] },
      { day: 8,  id: "b-ice-badge",     name: "Frost Edition: Ice-Blue Scale Badge", art: ["badge", "#8FD3F5", "#FFFFFF"] },
      { day: 12, id: "b-starlit-frame", name: "Frost Edition: Starlit Card Frame",   art: ["frame", "#3A4C7A", "#F1E3A8"] },
      { day: 16, id: "b-crystal-egg",   name: "Frost Edition: Crystal Egg",          art: ["egg", "#A9E4F5", "#FFFFFF"] },
      { day: 20, id: "b-velvet-ribbon", name: "Frost Edition: Midnight Velvet Bow",  art: ["bow", "#3A2E6B", "#C9B6FF"] },
      { day: 24, id: "b-diamond-shed",  name: "Frost Edition: Diamond-Dust Shed",    art: ["gem", "#DDEBFF", "#FFFFFF"] }
    ],
    grandPrize: {
      id: "legendary-serpent", name: "The Legendary Christmas Serpent",
      desc: "An animated golden serpent for your Cabin, plus the Legendary Serpent badge - for opening all 24 doors (recovered doors count)."
    },
    // §9 subscriber-only decorations (premium inventory; shown labelled and locked to everyone else)
    premium: [
      { id: "p-diamond-orn",  name: "Diamond Snake Ornament",            art: ["gem", "#E8F4FF", "#9FD3FF"] },
      { id: "p-gold-tree",    name: "Animated Golden Christmas Tree",    art: ["tree", "#E0B13B", "#FFF1B8"], anim: true },
      { id: "p-aurora-bg",    name: "Aurora Borealis Cabin Background",  art: ["aurora", "#5FD3B3", "#7A5CF0"], anim: true },
      { id: "p-emerald-deco", name: "Glowing Emerald Snake Decoration",  art: ["gem", "#1FBF6A", "#B8FFD8"], glow: true },
      { id: "p-fireplace",    name: "Premium Christmas Fireplace",       art: ["fire", "#FF8A3C", "#7A3B22"], anim: true },
      { id: "p-snowfall",     name: "Animated Snowfall Effect",          art: ["snow", "#FFFFFF", "#8FB8D9"], anim: true }
    ],

    /* ------------------------------------------------------------------ seasonal achievements ---------- */
    // rule: worked out by events/achievements.js from verified data only (Advent claims, trusted time,
    // the app's own achievement dates). Doors recovered with SUBSCRIBER skips never count towards an
    // achievement, so every achievement is exactly as reachable for free accounts.
    achievements: [
      { id: "x-first",     event: "xmas2026", icon: "door",   name: "First Christmas",    desc: "Open your first Advent Calendar door.",                 goal: 1,  stat: "doors",   reward: "Holly badge" },
      { id: "x-explorer",  event: "xmas2026", icon: "compass",name: "Christmas Explorer", desc: "Open 6 Advent doors.",                                  goal: 6,  stat: "doors",   reward: "Explorer's lantern pin" },
      { id: "x-streak3",   event: "xmas2026", icon: "flame",  name: "Three-Day Streak",   desc: "Open doors on 3 days in a row.",                        goal: 3,  stat: "bestRun", reward: "1 free skip (from the streak itself)" },
      { id: "x-collector", event: "xmas2026", icon: "gift",   name: "Festive Collector",  desc: "Collect 12 Advent rewards.",                            goal: 12, stat: "doors",   reward: "Collector's shelf in the Cabin" },
      { id: "x-glow",      event: "xmas2026", icon: "gem",    name: "Glowing Discovery",  desc: "Find the Glowing Emerald Scale behind door 13.",        goal: 1,  stat: "door13",  reward: "Glowing scale badge" },
      { id: "x-perfect",   event: "xmas2026", icon: "star",   name: "Perfect Christmas",  desc: "Open all 24 doors, each on its own day - no skips.",   goal: 24, stat: "onTime",  reward: "Perfect Christmas star" },
      { id: "x-legend",    event: "xmas2026", icon: "serpent",name: "Legendary Serpent",  desc: "Open all 24 doors and earn the Legendary Christmas Serpent (free skips count).", goal: 24, stat: "fairDoors", reward: "The Legendary Serpent badge" },
      { id: "n-explorer",  event: "newyear2027", icon: "compass", name: "New Year Explorer",   desc: "Visit SnakeList during the New Year 2026–27 event.",  goal: 1, stat: "nyVisit",  reward: "Firework badge" },
      { id: "n-midnight",  event: "newyear2027", icon: "clock",   name: "Midnight Celebration", desc: "Be on SnakeList within 30 minutes of midnight on New Year's Eve, in your own time zone.", goal: 1, stat: "nyMidnight", reward: "Midnight badge" },
      { id: "n-begin",     event: "newyear2027", icon: "sprout",  name: "New Beginnings",      desc: "Earn any SnakeList achievement during New Year week.", goal: 1, stat: "nyAch", reward: "New leaf badge" },
      { id: "f-pioneer",   event: "firstever",   icon: "flag",    name: "Event Pioneer",       desc: "Take part in SnakeList's first ever event by opening an Advent door during Christmas 2026.", goal: 1, stat: "doors", reward: "Pioneer badge (can never be earned again)" },
      { id: "s-day",       event: "snakeday2027",   icon: "globe",  name: "Snake Day Champion", desc: "Visit SnakeList on World Snake Day (16 July 2027).", goal: 1, stat: "visit", reward: "World Snake Day badge" },
      { id: "a-birthday",  event: "anniversary2027", icon: "cake",  name: "Happy Birthday, SnakeList", desc: "Visit SnakeList during its anniversary week.", goal: 1, stat: "visit", reward: "Birthday badge" },
      { id: "h-spooky",    event: "halloween2027",   icon: "moon",  name: "Spooky Spotter",     desc: "Visit SnakeList during Halloween 2027.", goal: 1, stat: "visit", reward: "Glowing-eyes badge" }
    ],

    /* ------------------------------------------------------------------ cursor ----------------------- */
    cursor: {
      colours: [["green", "Green", "#4CAF50"], ["emerald", "Emerald", "#10B981"], ["blue", "Blue", "#3B82F6"], ["red", "Red", "#EF4444"],
                ["purple", "Purple", "#8B5CF6"], ["gold", "Gold", "#E0B13B"], ["white", "White", "#FFFFFF"], ["rainbow", "Rainbow", "rainbow"]],
      effects: [["none", "No effect"], ["glow", "Subtle Glow"], ["trail", "Snake Trail"], ["sparkle", "Sparkling Particles"], ["snow", "Snowflake Trail"],
                ["emerald", "Emerald Glow"], ["rainbow", "Rainbow Trail"], ["golden", "Golden Sparkles"]]
    }
  };
  root.SL_EVENTS_CONFIG = C;
  if (typeof module === "object" && module.exports) module.exports = C;
})(typeof window !== "undefined" ? window : globalThis);
