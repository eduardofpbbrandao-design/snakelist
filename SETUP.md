# SnakeList — Google sign-in and cross-device sync

The app already works without any of this: open `index.html` and your sightings save to that
browser. Follow the steps below to turn on Google sign-in so the same list follows you
between phone, laptop, and anything else.

Everything here is free (Firebase Spark plan). Roughly 15 minutes.

---

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Add project** → name it `snakelist` (any name works) → you can turn Google Analytics off.

## 2. Register the web app and copy the config

1. In the project, click the **`</>`** (Web) icon on the overview page.
2. Nickname it `SnakeList`, **don't** tick Firebase Hosting for now → **Register app**.
3. Firebase shows a `firebaseConfig` object. Copy the values.
4. Open `index.html`, scroll to the bottom, and find this block:

   ```js
   const firebaseConfig = {
     apiKey: "PASTE_API_KEY",
     authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
     projectId: "PASTE_PROJECT_ID",
     appId: "PASTE_APP_ID",
   };
   ```

   Replace the four `PASTE_…` values with yours.

   These values are not secrets — they identify your project publicly, and the security rules
   in step 4 are what actually protect the data. It is fine that they sit in the page.

## 3. Turn on the sign-in methods

**Authentication** → **Get started** → **Sign-in method**, then enable both:

- **Email/Password** → toggle **Enable** → **Save**
- **Google** → toggle **Enable** → pick a support email → **Save**

Enable only Google if you don't want the email option — the form will still be there, but it
will report `auth/operation-not-allowed` when used.

## 4. Create the database and lock it down

1. **Firestore Database** → **Create database** → **Production mode** → choose a region near you.
2. Open the **Rules** tab, replace what's there with the contents of `firestore.rules`
   (in this folder) → **Publish**.

   Those rules mean each account can read and write only its own document. Without them,
   production mode denies everything and sync will fail with `permission-denied`.

## 5. Put the page online

Google sign-in only works over `http(s)` — opening the file directly (`file://…`) will not do,
and other devices need a URL they can reach anyway. Pick one:

**Netlify Drop — easiest, no tools to install**
1. Go to <https://app.netlify.com/drop>.
2. Drag the `SnakeList` folder onto the page.
3. You get a URL like `https://something-random.netlify.app`.

**GitHub Pages** — push this folder to a repo, then Settings → Pages → deploy from `main`.

**Firebase Hosting** — needs Node.js installed, then:

```bash
npm install -g firebase-tools
```

followed by `firebase login`, `firebase init hosting` (public directory: `.`), and `firebase deploy`.

## 6. Authorize your domain

**Authentication** → **Settings** → **Authorized domains** → **Add domain** → enter the host
from step 5 (for example `something-random.netlify.app`). `localhost` is already allowed.

Skipping this gives `auth/unauthorized-domain` when you press the sign-in button.

## 7. Use it

Open the URL on each device and press **Sign in** (top right). That opens the sign-in page,
where you can either enter an email and password — use **New here? Create an account** the
first time — or press **Sign in with Google** below the divider. Use the same account on every
device.

Email accounts and Google accounts are separate identities, even with the same address, so
pick one method and stick with it.

- Anything you had logged on a device before signing in gets folded into your account on first
  sign-in — nothing is lost, and if a species exists on both sides the earlier date wins.
- Changes appear on your other devices live, without a refresh.
- Signed out, the app still works and saves locally.

---

## How it stores things

One document per user at `users/{your-uid}`:

```
users/abc123 {
  sightings: { "ball-python": "2026-08-19T14:02:11.000Z", "king-cobra": "…" },
  updatedAt: <server timestamp>
}
```

Species id → the moment you marked it seen. Writes are debounced ~400ms, so rapid checking
sends one write, not ten.

## If something goes wrong

Messages appear on the sign-in page, just above the button you pressed:

| What you see | What it means |
| --- | --- |
| `Sync isn't set up yet — see SETUP.md` | Config still has the `PASTE_…` placeholders (step 2); the form is disabled |
| `Provider not enabled in Firebase` | Email/Password or Google not switched on in step 3 |
| `Domain not authorized in Firebase` | Host from step 5 not added in step 6 |
| `Firestore rules not published` | Rules from step 4 not published |
| `Email or password is incorrect` | Wrong details, or no account yet — try **Create an account** |
| `That email already has an account` | Use **Sign in** rather than create |
| `Popup blocked` | Browser blocked the Google window — allow popups for the site |

Opened as a `file://` page rather than a hosted URL, the app stays in local mode and the
sign-in form is disabled — that's expected, see step 5.
