# Deploying the SnakeList Firestore rules (for Eduardo's dad)

`firebase/firestore.rules` protects everything people save in SnakeList's Firebase project (`snakelist-7f5b4`):
saved lists, trail cameras, and - new - the Advent Calendar, seasonal achievements, the cursor setting and
(later) subscriptions. The events preview's anti-cheat only works once these rules are deployed: the server
stamps every Advent door with its own clock and refuses future doors, second claims and invented skips.

## 1. Check what is live now (2 minutes)

Firebase console -> Firestore Database -> **Rules**. Deploying REPLACES that whole text.
`firebase/firestore.rules` already covers `lists/`, `users/` and `cams/` (trail cameras). If the console has
rules for any other collection, copy those blocks into `firebase/firestore.rules` before deploying.

## 2. Deploy

```bash
npm install -g firebase-tools     # once
firebase login                     # once, with the Google account that owns the Firebase project
cd firebase                        # this folder (it has firebase.json and .firebaserc -> snakelist-7f5b4)
firebase deploy --only firestore:rules
```

## 3. Camera approvals: add Eduardo as admin (once)

The rules no longer contain anyone's email address. Approving trail cameras now needs a document:
Firestore -> **Start collection** `admins` -> Document ID = Eduardo's **User UID** (Authentication -> Users ->
copy the UID of his account) -> one field, e.g. `role` = `creator`. Nobody can create or change `admins`
from the app.

## 4. Optional: run the rules tests first (needs Java 11+)

```bash
mkdir -p /tmp/fbtest && cd /tmp/fbtest && npm i firebase-tools @firebase/rules-unit-testing firebase@10
cd <repo>/firebase
NODE_PATH=/tmp/fbtest/node_modules npx firebase emulators:exec --only firestore --project demo-snakelist "node ../tests/firestore-rules.test.js"
```
58 checks; all passed on 2026-11-23 (Firestore emulator, firebase-tools 13).

## Later: real subscriptions (not built - needs a decision and an account)

Nothing in SnakeList can take money yet; the Subscribe button only says "coming soon". To switch it on:

1. Upgrade the Firebase project to the **Blaze** plan (needed for Cloud Functions).
2. Create a **Stripe** account (business details, bank account, VAT / OSS registration as an accountant advises).
3. Install the Firebase extension **Run Payments with Stripe** (`invertase/firestore-stripe-payments`) with:
   customers collection `customers`, products collection `products`, "Sync new users to Stripe" on.
   Its Stripe secret key and webhook signing secret live in Google Secret Manager - never in this repo.
4. In Stripe create the product + price (see `events/PRICING.md` - EUR 0.21 per month is below Stripe's minimum)
   and give the product the metadata `firebaseRole` = `subscriber` (the rules check that role for subscriber skips).
5. Then the app needs a small addition (for a developer): create `customers/{uid}/checkout_sessions` docs to open
   Stripe Checkout, refresh the ID token after paying, show the price/tax before payment, and a "Manage
   subscription" link to the Stripe customer portal. The client already reads the status ONLY from
   `customers/{uid}/subscriptions` (which only the extension can write).
6. The Anniversary free 30 days (21-27 Aug 2027) needs a server function that starts a Stripe subscription with
   a 30-day trial and **no card**, set to cancel (not charge) when the trial ends. The rules already allow each
   account to claim it once (`promoClaims/{uid}/promos/anniv2027-free`, `paidAfter` must be `false`).
