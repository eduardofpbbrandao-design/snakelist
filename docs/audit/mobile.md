# Phones, tablets and the installed app (area "mobile")

Audit of SnakeList v6.39 on phones, tablets and as an installed app (PWA), with what was fixed. Fixes that keep the look are
**live**; the ones that change the layout are behind the preview switch **"mobile"** (`?preview=mobile`, or Settings >
Previews > Phones and tablets; html class `sl-pv-mobile`). Test: `tests/mobile.js`.

How it was checked: Chromium (Playwright) with touch and a phone/tablet user agent at 360x740, 390x844, 844x390 (phone on
its side), 820x1180 and 1180x820 (iPad), and 390x844 with the default text size at 200% (`Page.setFontSizes`). An
iPhone's status bar, notch and home bar were emulated with `Emulation.setSafeAreaInsetsOverride` (47/34 px upright,
47/47/21 px on its side). The keyboard was emulated by giving `visualViewport` the height a phone gives it with the
keyboard up. Measured: header height, where the tabs and the search are, sideways scroll, the map's size, Settings' close
button, the 3D viewer, Back, rotation, offline, coming back from the background.

| What | Live / preview |
|---|---|
| Safe areas: header, 3D viewer, full-screen map, "new version" bar and the bars at the bottom clear the status bar / notch / home bar | **live** |
| Back closes the top panel (3D viewer, photo, Settings, sighting, full-screen map...) before leaving SnakeList | **live** |
| The map is never taller than the screen on a touch screen (a phone on its side could not scroll past it) | **live** |
| The on-screen keyboard: a search box with suggestions moves up so they are not under the keyboard; `--sl-kb` / `html.sl-kb` | **live** |
| "New version" Refresh asks first in the middle of a quiz or with something typed and not saved | **live** |
| Full-height panels use the height you can see (`dvh`) | **live** |
| Offline helper: its own plain "You are offline" page instead of the browser's error | **live** |
| No opening again after the phone threw the page away in the background, or for the installed app reopened within 5 minutes | **live** |
| Manifest: `lang`, `dir`, `categories` | **live** |
| Shorter header on phones and on a phone on its side (tabs and search on the first screen) | preview "mobile" |
| Map tab on a phone brings the whole map onto the screen | preview "mobile" |
| Taller map on an upright iPad | preview "mobile" |

## Findings

### Critical

None. Nothing loses saved data; every size works without sideways scroll.

### High

1. **Installed app on an iPhone draws under the status bar and the notch** - *fixed live.* The page asks for
   `viewport-fit=cover` and `apple-mobile-web-app-status-bar-style: black-translucent`, so the installed app is drawn from the
   very top of the screen, but nothing used `env(safe-area-inset-*)` except the photo viewer, the toasts and a few map buttons.
   Measured with the insets on: "FIELD CHECKLIST" at y=28 under a 47 px status bar; the 3D viewer's close button at y=0
   (upright); the full-screen map's search at y=12; the "new version" bar at y=12; on its side the logo, the countdown and the
   checklist ran under the notch (x=20 with a 47 px notch). Now `.sl-body` pads by the insets (`max(28px, inset + 10px)` etc. -
   the same 28/20/60 px as before wherever the insets are 0), the 3D viewer's backdrop pads by them, the full-screen map gets
   a frame of its own dark green as wide as each inset, the "new version" bar sits `12px + inset` from the top, and the cookie
   bar, the "keep your list" and corner nudges and the offline pill sit above the home bar. Settings (a bottom sheet on
   phones) and the photo viewer already did this. Screens: `before|after/390x844-safe-*.png`, `844x390-safe-*.png`.
2. **Back left SnakeList with a panel open** - *fixed live.* Only the tabs added history steps, so on Android (and in the
   installed app, where Back is the only way back) Back with the 3D viewer, a photo, Settings, a sighting or the full-screen
   map open left SnakeList altogether (measured: `about:blank`). Now each panel that opens adds one history step
   (`{slLayer: n}`, same address); Back closes the top one (its close / Cancel button, else Escape) and SnakeList stays.
   A panel closed with its X or Escape takes its step away again (`history.go(-1)`, swallowed), so Back is never "dead".
   Panels are found with the existing `SL_LAYERS()` (a11y-perf) plus the full-screen map. A sighting with unsaved text gets its
   own "You haven't saved this" first (nothing is lost); Back again closes it. Back between tabs works as before.
3. **A phone on its side could not scroll past the map** - *fixed live.* The map is half its width tall (402 px at 844 px
   wide) in a 390 px high screen, and a finger on the map moves the map (`touch-action: none`), so once the map filled the
   screen only the 20 px margins scrolled the page. On a touch screen the map is now at most the screen's height minus 56 px
   (336 px at 844x390), with the sea colour at the sides as in full screen. Upright phones, tablets and computers keep their
   sizes (the cap is above them).

### Medium

4. **The first screen on a phone is the header** - *preview "mobile".* Upright (390x844) the header is 256 px plus the
   countdown card; the search starts at y=652 (at 360x740 it is at y=678, under the "See snakes from" nudge). On its side
   (844x390) the header and the countdown fill the whole first screen: tabs at y=371, search at y=483. The preview hides the
   tagline and "About creator" on phones (still shown on tablets and computers; the links stay in the page), puts the country links on one line that scrolls
   sideways, and on a phone on its side also hides the eyebrow line and uses a smaller logo: header 256 -> 125 px upright
   (search at y=513), 194 -> 100 px on its side (tabs at y=253). The countdown card belongs to the events area and was left alone.
5. **The on-screen keyboard hid the suggestions** - *fixed live.* Phones shrink only the visual viewport when the keyboard
   comes up, so a search box low on the screen (the map search at y~430 on 390x844 with a ~330 px keyboard) was scrolled just
   above the keyboard with no room for its list. Now, when the keyboard is up and the focused box has suggestions (the
   checklist and map searches, country / state / city, the sighting's place, the trait, habitat and country-card boxes, any
   combobox), the page (or the panel it is in) scrolls so ~260 px are free under it. `<html>` gets `sl-kb` and `--sl-kb`
   (the keyboard's height) while it is up, for later use.
6. **"New version" Refresh could throw away a quiz** - *fixed live.* The bar (queued with `SL_whenPrompt`, urgent) only
   asked first when a sighting sheet was open. `SL_BUSY()` now also covers a quiz in progress and text typed in a panel and
   not saved; Refresh asks with that sentence, Cancel keeps everything. Saved data was never at risk (the list is saved as
   you go; the offline helper keeps its cache name, so photos and maps stay).
7. **Map tab on a phone opens with the map below the screen** (upright: map from y=573 of 844; on its side: not visible) -
   *preview "mobile"*: tapping the Map tab on a touch screen scrolls so the whole map (or its search and the top of the map)
   is on the screen.
8. **Upright iPad: a short map with empty page under it** (820x1180: 390 px map, ~300 px empty) - *preview "mobile"*: an
   upright tablet gets 56% of the screen's height (661 px), as upright phones already do.

### Low

9. **Full-height panels used `100vh`** (country sheet "big", sighting card, compare, camera): on a phone with the address
   bar showing their bottom was under it. `dvh` added after the `vh` (older browsers keep `vh`) - *live*.
10. **Offline and never saved: the browser's error page.** If neither the page nor SnakeList itself was saved, the offline
    helper returned nothing. It now answers with a small page in SnakeList's green: "You are offline - this page has not been
    saved on this device yet ... SnakeList works offline once it has opened with a connection: your list, the checklist and the
    photos you have already looked at; photos and maps you have not opened need a connection", with Try again - *live*
    (`sw.js` via `build-site.py`). Inside the app the existing pill already says "Offline · showing what's saved on this device".
11. **The opening could play again after the phone put SnakeList away.** Freezing / bfcache keep the page (checked: same
    place, no opening). But when the browser throws the page away in the background (`document.wasDiscarded`, Chrome) or the
    installed app is loaded again soon after being left (iPhone), the opening played again. `SL_CAME_BACK` now covers both:
    discarded, or the installed app (`display-mode: standalone` / `navigator.standalone`) opened within 5 minutes of being put
    away (`localStorage sl-hidden-at`, written on `visibilitychange: hidden` / `pagehide`). An hour later it plays as usual -
    *live*. Links to iNaturalist open in a new tab (`target=_blank`), so SnakeList stays where it was. Stripe is not connected
    yet (`events/config.js` has no key) - nothing to check, nothing touched.
12. **Manifest** - fine: name/short_name, `display: standalone`, `start_url`/`scope` "/", `id` "/", `orientation: any` (not
    forced), 192/512 icons + 512 maskable, theme/background `#1F5A3A`; apple-touch-icon and the iPhone app tags are in the
    head; the Install button hides itself in the installed app. Added `lang`, `dir`, `categories` (live).
13. **Text at 200%** (browser default font size doubled): no sideways scroll, nothing cut off; the app sets its text in px, so
    this setting changes little (header 256 -> 275 px). Page zoom works as usual.

### Checked and fine

No sideways scroll at any size (the tab row scrolls inside itself by design); Settings is a bottom sheet on phones with its
close button on the screen at every size; the photo viewer's close button already clears the status bar; the 3D viewer uses
the whole screen on phones (378x740 upright, 800x316 on its side) and its buttons stay reachable; turning the phone keeps
the search text, the open sighting sheet and what was typed in it; pinch / two-finger gestures on the map and 3D viewer are
unchanged.

## Not done (needs Eduardo or assets)

- **iPhone launch screen** (`apple-touch-startup-image`): the installed app shows a blank screen while it starts. It needs
  a set of images per iPhone/iPad size - a new visual, so it waits for approval.
- **Phone screenshots for the install sheet**: the manifest only has `form_factor: wide` (computer) screenshots; Android's
  richer install sheet on phones wants `narrow` ones (real 1080x1920-ish screenshots).
- A 192 px maskable icon (only the 512 one is maskable; fine, but some launchers prefer a smaller one).
- Text in px: a reader who raises the browser's default text size sees little change (would mean moving the app to rem).
- `launch_handler` (`focus-existing`) would bring an already open installed window forward instead of loading it again; it
  needs `launchQueue` handling for links, so not done blind.

## Tests

`tests/mobile.js` (manifest and head; every size and 200% text; safe areas; Back; keyboard; rotation; Refresh in a quiz;
offline page; coming back; the preview on and off). `tests/previews.js` counts the new switch (13 listed, "mobile" in
`?preview=all`). data-safety, previews, update-check and a11y-perf pass before and after.
