#!/usr/bin/env python3
"""Add prehistoric (fossil-only) snakes from data/fossil-additions.json to the SnakeList app.

For every species in the JSON whose id is not already a card in the app, this:
  * appends a card at the END of the card list (so the habitat bitsets of existing cards,
    which are indexed by card order, stay valid),
  * appends the id to the "prehistoric snakes known only from fossil bones" id array,
  * adds a FOSSIL_AGE entry  id -> [period text, million years ago],
  * adds the shared fossil-illustration entry to #photo-index,
  * updates #habitat-data: "n" becomes the new number of cards and every bitset is padded
    with zero bits, so the new cards belong to no habitat.

It is idempotent: ids that already have a card are skipped, and running it twice changes
nothing the second time.

Usage:
  python3 tools/add_fossils.py [APP_HTML] [--json data/fossil-additions.json] [--dry-run]

APP_HTML defaults to snakelist-synced.html next to this tools/ folder. After running it on the
real app, bump .sl-ver and run build-site.py as usual (see CLAUDE.md).
"""
import argparse
import base64
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOSSIL_MARK = "// prehistoric snakes known only from fossil bones"
CARDS_END = "\n      </div>\n    </artifact-sync>"
CARD_INDENT = "\n        "
PHOTO_ENTRY = '[121,5,"Illustration by SnakeList - known only from fossils, no photo can exist",0.22]'
TYPES = {"Boa", "Colubrid", "Elapid", "Viper", "Pit Viper", "Python", "Cobra", "Sea Snake", "Watersnake", "Other"}
CONTINENTS = {"Africa", "Asia", "Europe", "North America", "South America", "Oceania"}


def esc(s):
    return html.escape(s, quote=True)


def card_html(sp):
    """One card, built exactly like the existing fossil cards (e.g. paleryx-depressus)."""
    sci, name = sp["sci"], (sp.get("name") or sp["sci"])
    common = name != sci
    conts = sp.get("continents") or []
    attrs = 'data-id="%s"' % esc(sp["id"])
    if sp.get("provinces"):
        attrs += ' data-provinces="%s"' % esc("|".join(sp["provinces"]))
    attrs += ' data-type="%s" data-continents="%s" data-countries="%s" data-venomous="%d" data-name="%s" data-family="%s"' % (
        esc(sp["type"]), esc("|".join(conts)), esc("|".join(sp.get("countries") or [])),
        1 if sp.get("venomous") else 0, esc(name), esc(sp.get("family") or ""))
    if common:
        names = '<div class="card-name">%s</div><div class="card-sci">%s</div>' % (esc(name), esc(sci))
    else:
        names = '<div class="card-name is-sci">%s</div><div class="card-sci no-common">No common name</div>' % esc(sci)
    where = " &middot; ".join(esc(c) for c in conts) if conts else "Range not recorded"
    tags = '<span class="tag"><svg class="ic" width="10" height="10"><use href="#i-pin"></use></svg>%s</span>' % where
    tags += '<span class="tag">%s</span>' % esc(sp["type"])
    if sp.get("family"):
        tags += '<span class="tag">%s</span>' % esc(sp["family"])
    return (
        '<div class="card" ' + attrs + '><div class="card-top"><div>' + names + '</div>'
        '<button class="follow-btn" type="button" aria-label="Follow this snake" title="Follow - get its news, sightings and facts">'
        '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><use href="#i-bell"></use></svg></button></div>'
        '<div class="card-tags">' + tags + '</div>'
        '<div class="wish-row"><button class="wish-btn" type="button" aria-label="Want to see this snake">'
        '<span class="wish-off">&#9734; Want to see</span><span class="wish-on">&#9733; Want to see</span></button></div>'
        '<div class="card-bottom"><button class="note-btn" type="button" aria-label="Log the date and place you saw this"></button>'
        '<span class="photo-btn" role="button" tabindex="0" aria-label="Add your own photo">'
        '<button type="button" class="photo-btn-clear" aria-label="Remove photo">&times;</button></span>'
        '<button class="map-btn" type="button">See more info</button>'
        '<button class="seen-btn" type="button"><span class="lbl-mark">Mark Seen</span>'
        '<span class="lbl-seen"><svg class="ic" width="13" height="13"><use href="#i-check"></use></svg> Seen</span></button></div></div>'
    )


def validate(sp, known_countries):
    errs = []
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)+", sp.get("id", "")):
        errs.append("bad id")
    elif sp["id"] != sp["sci"].lower().replace(" ", "-"):
        errs.append("id does not match sci name")
    if sp.get("type") not in TYPES:
        errs.append("unknown type %r" % sp.get("type"))
    for c in sp.get("continents") or []:
        if c not in CONTINENTS:
            errs.append("unknown continent %r" % c)
    for c in sp.get("countries") or []:
        if c not in known_countries:
            errs.append("country %r not in the app's ISO table" % c)
    if not isinstance(sp.get("mya"), (int, float)) or not sp.get("period"):
        errs.append("needs period + mya")
    return errs


def num(m):
    return str(int(m)) if float(m).is_integer() else repr(float(m))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("app", nargs="?", default=os.path.join(ROOT, "snakelist-synced.html"))
    ap.add_argument("--json", default=os.path.join(ROOT, "data", "fossil-additions.json"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    s = open(a.app, encoding="utf-8").read()
    species = json.load(open(a.json, encoding="utf-8"))
    existing = set(re.findall(r'<div class="card" data-id="([^"]+)"', s))
    known_countries = set(json.loads(re.search(r"var ISO = (\{.*?\});", s).group(1)))

    new, seen = [], set()
    for sp in species:
        if sp["id"] in existing or sp["id"] in seen:
            print("skip (already in app): " + sp["id"])
            continue
        errs = validate(sp, known_countries)
        if errs:
            sys.exit("%s: %s" % (sp.get("id"), "; ".join(errs)))
        seen.add(sp["id"])
        new.append(sp)
    if not new:
        print("Nothing to add.")
        return

    # 1. cards, appended at the end of the card list
    if s.count(CARDS_END) != 1:
        sys.exit("could not find the end of the card list")
    old_n = s.count('<div class="card" ')
    s = s.replace(CARDS_END, "".join(CARD_INDENT + card_html(sp) for sp in new) + CARDS_END)
    total = s.count('<div class="card" ')

    # 2. fossil id array
    i = s.index(FOSSIL_MARK)
    j = s.index("].forEach(", i)
    arr = s[i:j]
    add_ids = [sp["id"] for sp in new if '"%s"' % sp["id"] not in arr]
    if add_ids:
        s = s[:j] + "".join(', "%s"' % x for x in add_ids) + s[j:]

    # 3. FOSSIL_AGE
    i = s.index("const FOSSIL_AGE = {")
    j = s.index("};", i)
    ages = json.loads(s[i + len("const FOSSIL_AGE = "):j + 1])
    add_ages = "".join(',%s:%s' % (json.dumps(sp["id"]), json.dumps([sp["period"], None])
                       .replace("null", num(sp["mya"]))) for sp in new if sp["id"] not in ages)
    s = s[:j] + add_ages + s[j:]

    # 4. photo index: the shared "fossil illustration" photo
    i = s.index('<script type="application/json" id="photo-index">')
    j = s.index("</script>", i)
    block = s[i:j]
    items_at = block.index('"items":{') + len('"items":{')
    add_ph = "".join('"%s":%s,' % (sp["id"], PHOTO_ENTRY) for sp in new if '"%s":[' % sp["id"] not in block)
    block = block[:items_at] + add_ph + block[items_at:]
    s = s[:i] + block + s[j:]

    # 5. habitat bitsets: bit k = card k; new cards get 0 bits, n = number of cards
    tag = '<script type="application/json" id="habitat-data">'
    i = s.index(tag) + len(tag)
    j = s.index("</script>", i)
    t = s[i:j]
    hab = json.loads(t)
    hn = hab["n"]
    if hn > old_n:
        sys.exit("habitat n (%d) is bigger than the card count (%d) - refusing to guess" % (hn, old_n))
    nbytes = (total + 7) // 8
    repl = {}
    for sec in hab["sections"]:
        for h in sec[1]:
            b = bytearray(base64.b64decode(h[1]))
            for k in range(hn, len(b) * 8):  # anything at or past the old n must be 0
                b[k >> 3] &= ~(1 << (k & 7)) & 0xFF
            if len(b) < nbytes:
                b.extend(b"\0" * (nbytes - len(b)))
            repl[h[1]] = base64.b64encode(bytes(b)).decode()
    t2 = t.replace('{"n":%d,' % hn, '{"n":%d,' % total, 1)
    if t2 == t:
        sys.exit('could not find "n" in #habitat-data')
    for old, newb in repl.items():
        t2 = t2.replace('"%s"' % old, '"%s"' % newb)
    s = s[:i] + t2 + s[j:]

    # sanity checks before writing
    hab2 = json.loads(t2)
    assert hab2["n"] == total == s.count('<div class="card" ')
    for sec in hab2["sections"]:
        for h in sec[1]:
            b = base64.b64decode(h[1])
            assert len(b) * 8 >= total and not any(b[k >> 3] >> (k & 7) & 1 for k in range(hn, total))
    for sid in ("photo-index", "habitat-data"):
        m = re.search(r'<script type="application/json" id="%s">(.*?)</script>' % sid, s, re.S)
        json.loads(m.group(1))
    i = s.index("const FOSSIL_AGE = {")
    json.loads(s[i + len("const FOSSIL_AGE = "):s.index("};", i) + 1])

    print("Adding %d fossil snakes (cards %d -> %d): %s" % (len(new), old_n, total, ", ".join(sp["id"] for sp in new)))
    if a.dry_run:
        print("dry run - nothing written")
        return
    open(a.app, "w", encoding="utf-8").write(s)
    print("Wrote " + a.app)


if __name__ == "__main__":
    main()
