# Ads and cookie consent: what to switch on in AdSense

SnakeList's code is ready. Two things must now be set in the **AdSense account** (only the account owner can do this):

1. Google's own **consent message** for Europe and for US states.
2. The **Auto ads** settings, so ads never cover SnakeList's buttons, maps, photos or the Advent Calendar.

It takes about 20 minutes. Nothing breaks if you do it later. Until it is done, visitors in Europe only see ads that are **not personalised**, which earn less.

---

## Why Google's own message?

In the European Economic Area (EEA), the UK and Switzerland, Google requires sites that show its ads to use a **Google-certified consent tool (CMP)**. Google's own one, **Privacy & messaging**, is free and certified. The AdSense script on SnakeList already loads it, so it only needs to be switched on.

### What the site does by itself

- **Before anyone answers**
  - Google is told "denied" for everything (Consent Mode v2): no ad cookies, no analytics cookies.
  - Outside Europe, the ads script does not load at all until the visitor answers.
- **In Europe**
  - When Google's message is switched on, SnakeList's own cookie bar is **not** shown, so nobody is asked twice.
  - The answer given in Google's message is used for Google Analytics and for "Picked for you" too.
- **Everywhere else**, SnakeList's own green cookie bar shows three buttons:
  - **Accept cookies**
  - **Reject**: ads are limited and not personalised, and no ad cookies are used.
  - **Manage**: switches for Essential (always on), Analytics and Advertising personalisation.
- **Changing your mind later.** Visitors can change their answer any time:
  - with **Cookie choices** at the bottom of every page;
  - or in **Settings → More → Cookie choices**.

  In Europe, Cookie choices reopens Google's message.

---

## Part 1: Google's consent message (Privacy & messaging)

1. Sign in at **https://adsense.google.com** with the SnakeList AdSense account.
2. In the left menu, click **Privacy & messaging**.

### 1a. European regulations message (EEA, UK, Switzerland)

1. On the **European regulations** card, click **Manage**.
2. Click **Create message**.
3. **Sites:** choose **snakelist.com**.
4. **Languages:** English, plus any others you want (Portuguese, Spanish...). The default language is English.
5. **User consent options**: tick both of these:
   - **Consent**
   - **Do not consent** ← important: visitors must be able to say no as easily as yes.

   **Manage options** is always there.
6. **Privacy policy URL:** `https://snakelist.com/privacy.html`
7. **Style:** pick colours close to SnakeList:
   - Button colour **#58B351** (SnakeList green)
   - Text colour **#1C3A22**
   - Background **#F6FBF1**

   Add the SnakeList logo if it asks for one (`https://snakelist.com/app/icon-192.png`).
8. Click **Publish** (top right). Then, back on the European regulations page, make sure the message's status is **Published / Active**.
9. Still on that page, open **Settings** (the gear, or "European regulations settings"):
   - **Ad partners / vendors:** keep **Google** and the "commonly used ad partners" ticked (otherwise fewer ads are shown).
   - If there is a switch for **Google consent mode** (sometimes called "consent mode for Google tags"), turn it **on**.

### 1b. US state regulations message

1. Back in **Privacy & messaging**, on the **US state regulations** card, click **Manage → Create message**.
2. **Site:** snakelist.com. **Privacy policy URL:** `https://snakelist.com/privacy.html`.
3. Keep Google's standard "Do not sell or share my personal information" option.
4. Click **Publish**.

### 1c. Check it works (2 minutes)

- From a computer whose time zone is set to a European city (for example Lisbon or London), open **https://snakelist.com** in a private/incognito window and wait about 10 seconds.
  - Google's message should appear, with **Consent / Do not consent / Manage options**.
  - SnakeList's own green cookie bar should **not** appear.
- In a private window with a US (or other non-European) time zone, SnakeList's green bar should appear with **Reject / Manage / Accept cookies**.
- The message can take up to an hour to start showing after you publish it.

---

## Part 2: Auto ads – keep ads away from the important parts

1. In AdSense, click **Ads** in the left menu.
2. On the **By site** tab, find **snakelist.com** and click the **pencil (Edit)** icon.
3. A preview of the site opens with a settings panel on the right.

### 2a. Ad formats (in the right-hand panel)

| Setting | Set it to | Why |
|---|---|---|
| **Auto ads** | On | |
| **In-page formats → Banners** | On | Normal ads between parts of the page |
| **In-page formats → Multiplex** | On (or off if you don't like them) | |
| **Overlay formats → Anchor ads** | **Off** | They stick to the bottom/top of the screen and cover the map buttons, the cookie bar and the tab bar on phones |
| **Overlay formats → Side rail ads** | **Off** | They cover the side of the map and the 3D viewer |
| **Overlay formats → Vignette ads** | **Off** | Full-screen ads when you click a link (for example on the Advent Calendar or a species page) |
| **Intent-driven formats** (also called "In-page links / search") | **Off** | They turn words in species descriptions into ad links |
| **Ad load** | About the middle | Fewer ads, faster on iPads |

If you would rather keep Anchor ads to earn more, keep them on but untick **"Allow anchor ads on large screens"** (or similar). SnakeList hides them anyway while a big panel (photo, 3D viewer, Advent Calendar, Settings) is open.

### 2b. Excluded areas

Still in the Edit preview:

1. Click **Excluded areas** (or "Page exclusions / exclude areas").
2. Click on each of these in the preview and choose **Exclude**:
   - the header with its buttons;
   - the map;
   - the species cards / photo grid;
   - the photo at the top of a species page.
3. Click **Apply to site** (top right) and **Save**.

### 2c. Page exclusions

1. In the same panel, open **Page exclusions** and add:
   - `snakelist.com/christmas/` (the Christmas preview);
   - any other page you never want ads on.
2. Click **Save**.

### 2d. The built-in safety net

SnakeList also has its own safety net in the code. If Google ever puts an automatic ad **inside**:

- the header,
- the map,
- the cards or photos,
- the 3D viewer,
- the Advent / Events panels, or
- any pop-up panel,

the site removes that ad straight away. The dashboard settings above are still the proper way, because they stop Google from trying.

---

## Optional

- **Children.** Many SnakeList visitors may be children. Google has a "child-directed treatment" option for sites aimed at children under 13: ads are then never personalised. It lowers earnings but is the safest choice. Search the AdSense Help Centre for "child-directed treatment". If you want it, the code can send that flag too: just ask.
- **Blocking controls → Sensitive categories:** block anything you don't want next to snakes (dating, gambling...).

---

## For whoever works on the code

- The one source file is `sl-consent.js` in the site root.
  - `build-site.py` puts it inside the app's `<head>` (before Google Analytics).
  - `tools/add_adsense.py` adds `<script src="sl-consent.js" defer>` to every other page, replacing the old plain AdSense tag.
- Stored on the device:
  - `sl-consent` = `yes` / `no` (Analytics and Picked for you);
  - `sl-ads` = `yes` / `no` (ad personalisation, outside Europe).

  An older answer from before ads were asked about counts as "answered, ads not personalised".
- "Europe" is guessed from the browser's time zone. Google's own message uses the visitor's real location: when it is present, it always wins.
- Test: `PORT=<port> node tests/consent.js` (serve the built site first).
