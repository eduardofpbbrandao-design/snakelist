# Admin notes (for the account owner's parent / the Firebase admin)

## Giving Eduardo's own account a complimentary (free) SnakeList subscription

The app never grants a subscription by itself: nobody can give themselves one from the browser, and the
Firestore rules refuse any write to `customers/...` from the app. A free ("complimentary") subscription is
therefore set up **by hand, by an admin, in the Firebase console** - two small steps. Nothing is paid and
Stripe is not involved.

You need: access to the SnakeList Firebase project (console.firebase.google.com) and Eduardo's account
**UID** (Authentication -> Users -> find his sign-in email -> copy the "User UID" column).

### Step 1 - the subscription record (what the app reads)

Firestore Database -> Data -> collection `customers` -> document `<Eduardo's UID>` (create it if missing; it
can be empty) -> sub-collection `subscriptions` -> **Add document** with Document ID `complimentary`:

| Field                | Type      | Value                                     |
|----------------------|-----------|-------------------------------------------|
| `status`             | string    | `active`                                  |
| `complimentary`      | boolean   | `true`                                    |
| `current_period_end` | timestamp | the date it should end, e.g. 31 Dec 2027  |
| `note`               | string    | `Complimentary - owner's account`         |

`events/core.js` treats a subscription as active when `status` is `active` (or `trialing`) and
`current_period_end` is in the future (or missing). Leave `current_period_end` out for "no end date".
Within a few seconds of signing in, the app shows the subscriber benefits (early access, bonus rewards,
subscriber skips, premium decorations, cursor customization) - no "TEST MODE" label, because it is real.

### Step 2 - the subscriber role on the sign-in token (what the Firestore rules check)

Subscriber **skips** and the **bonus rewards** of each Advent door are also checked by the server rules
(`firebase/firestore.rules`, `isSubscriber()`), which read a custom claim `stripeRole: "subscriber"` on the
sign-in token. The Stripe extension normally sets it; for a complimentary account set it once yourself with
the Firebase Admin SDK (from a computer with the project's service-account key - never put that key in the app):

```js
// node set-role.js   (npm i firebase-admin)
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./service-account.json')) });
admin.auth().setCustomUserClaims('<EDUARDO_UID>', { stripeRole: 'subscriber' })
  .then(() => console.log('done - sign out and in again in SnakeList'));
```

Then sign out of SnakeList and sign in again (the token is refreshed). Without step 2 the app still shows
the benefits, but the server refuses subscriber skips and records doors without their bonus rewards.

### Ending it

Delete the `complimentary` document (or set `status` to `canceled`), and run the script again with
`{ stripeRole: null }`. Everything he already collected stays his (Advent doors are kept for good).

### Why not in the app?

A button or a hidden code in the app that grants a subscription could be found and used by anyone, and it
would mean the app pretends a purchase happened. Keeping it as an admin-only step in the console is safe
and honest.
