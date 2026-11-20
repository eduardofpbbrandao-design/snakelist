#!/usr/bin/env python3
"""Remove species cards from the SnakeList app that are not real snake species (an old name of
another species, or not a snake at all), keeping every other card's data valid.

  python3 tools/remove_cards.py ID[=TARGET] [ID[=TARGET] ...] [--app APP_HTML] [--dry-run]

For each ID:
  * its card is removed,
  * its bit is taken out of every #habitat-data bitset (they are indexed by card order) and "n"
    goes down by one,
  * it is removed from #photo-index, #rarity-data, the fossil id list, FOSSIL_AGE and EXTINCT,
  * with =TARGET, ALIAS gets ID -> TARGET, so anything a person marked on the old card (Seen,
    Want to see, Following, notes, photos) moves to the species it is really a name of.
The "All N snake species" total in the page text goes down to match.
Run build-site.py afterwards: the old species page is then a redirect to TARGET (or is removed).
"""
import argparse
import base64
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def jblock(s, el_id):
    m = re.search(r'(<script type="application/json" id="%s">)(.*?)(</script>)' % el_id, s, re.S)
    return m, json.loads(m.group(2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--app", default=os.path.join(ROOT, "snakelist-synced.html"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    s = open(a.app, encoding="utf-8").read()
    pairs = [(x.split("=")[0], (x.split("=") + [None])[1]) for x in a.ids]
    for cid, target in pairs:
        order = re.findall(r'<div class="card" data-id="([^"]*)"', s)
        if cid not in order: print("%s: no card (skipped)" % cid); continue
        if target and target not in order: raise SystemExit("%s: target %s has no card" % (cid, target))
        k = order.index(cid)
        # the card (one line)
        m = re.search(r'\n[ \t]*<div class="card" data-id="%s".*?(?=\n)' % re.escape(cid), s)
        assert m.group(0).count('<div class="card"') == 1
        s = s[:m.start()] + s[m.end():]
        # habitat bitsets
        hm, hab = jblock(s, "habitat-data")
        n = hab["n"]
        if k < n:
            for sec in hab["sections"]:
                for h in sec[1]:
                    b = base64.b64decode(h[1])
                    bits = [(b[i >> 3] >> (i & 7)) & 1 for i in range(len(b) * 8)][:n]
                    del bits[k]
                    out = bytearray((len(bits) + 7) // 8)
                    for i, v in enumerate(bits):
                        if v: out[i >> 3] |= 1 << (i & 7)
                    h[1] = base64.b64encode(bytes(out)).decode()
            hab["n"] = n - 1
        s = s[:hm.start(2)] + json.dumps(hab, separators=(",", ":"), ensure_ascii=False) + s[hm.end(2):]
        # photo index, rarity
        for el in ("photo-index", "rarity-data"):
            m2 = re.search(r'(<script type="application/json" id="%s">)(.*?)(</script>)' % el, s, re.S)
            txt = m2.group(2)
            pat = r',?"%s":(\[[^\]]*\]|[0-9.]+)' % re.escape(cid)
            new = re.sub(pat, "", txt, count=1).replace("{,", "{")
            json.loads(new)  # still valid
            s = s[:m2.start(2)] + new + s[m2.end(2):]
        # fossil list, FOSSIL_AGE, EXTINCT
        fi = s.index("// prehistoric snakes known only from fossil bones")
        fj = s.index("]", fi)
        lst = s[fi:fj]
        if '"%s"' % cid in lst:
            lst2 = re.sub(r'"%s",\s*' % re.escape(cid), "", lst, count=1) if re.search(r'"%s",' % re.escape(cid), lst) else re.sub(r',\s*"%s"' % re.escape(cid), "", lst, count=1)
            s = s[:fi] + lst2 + s[fj:]
        i = s.index("const FOSSIL_AGE = {") + len("const FOSSIL_AGE = ")
        j = s.index("};", i) + 1
        ages = json.loads(s[i:j]); ages.pop(cid, None)
        s = s[:i] + json.dumps(ages, ensure_ascii=False, separators=(",", ":")) + s[j:]
        # ALIAS
        if target:
            i = s.index("var ALIAS = window.SL_ALIAS = ") + len("var ALIAS = window.SL_ALIAS = ")
            j = s.index("};", i) + 1
            al = json.loads(s[i:j]); al[cid] = target
            s = s[:i] + json.dumps(al, separators=(",", ":"), ensure_ascii=False) + s[j:]
        print("removed %s (card %d)%s" % (cid, k, (" -> " + target) if target else ""))
    total = len(re.findall(r'<div class="card" data-id="', s))
    s = re.sub(r"(<span data-sl-total>)[\d,]+(</span>)", lambda m: m.group(1) + "{:,}".format(total) + m.group(2), s)
    print("cards now: %d" % total)
    if not a.dry_run:
        open(a.app, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    main()
