# SnakeList subscription pricing - what Stripe allows (needs Eduardo's decision)

Eduardo asked for: **EUR 0.21 per month**, in December a discount equal to the day of the month
(1 Dec = 1 % off ... 31 Dec = 31 % off), and **EUR 0.01** during New Year 2026-27.

## The problem

- Stripe's smallest charge in euros is **EUR 0.50** per payment. A EUR 0.21 monthly charge (or EUR 0.01) is refused.
- Even if it were allowed, card fees (about EUR 0.25 + 1.5 % for EU cards) are more than EUR 0.21, so every
  payment would lose money.
- The December prices (EUR 0.21 minus 1-31 %, i.e. EUR 0.14-0.21) are also below the minimum.

Nothing has been changed silently: `events/config.js` still holds 0.21 / month as a **placeholder** (shown as
"price not final"), and no checkout exists.

## Three options that work

| | Option | What people pay | December | New Year |
|---|---|---|---|---|
| **A (recommended)** | EUR 0.21 a month, **billed yearly** | EUR 2.52 once a year | day-of-month % off the yearly price (24 Dec: EUR 1.92) | first month free (a 1-month free trial), no EUR 0.01 charge |
| B | EUR 0.50 a month (the minimum) | EUR 0.50 monthly | discount as a free extra month instead of a lower price | first month free |
| C | Prepaid "12 months of SnakeList Supporter" | EUR 2.52 once, no renewal | day-of-month % off | first month free |

Option A keeps Eduardo's EUR 0.21-per-month price and his December idea, every charge is above EUR 0.50
(the lowest, 31 Dec, is EUR 1.74), and after fees about EUR 2.20 of each EUR 2.52 reaches SnakeList.
Prices shown to EU consumers must include VAT.

To switch, change `subscription.interval` to `"year"` and `price` to `2.52` in `events/config.js` (the page
then shows "EUR 2.52 / year"); the December rule already works on any price.
