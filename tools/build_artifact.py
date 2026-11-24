#!/usr/bin/env python3
"""Build the claude.ai artifact copy of SnakeList (a folder ready to publish).

    python3 tools/build_artifact.py --out <dir> [--christmas on|off] [--cache <dir>] [--offline]
    python3 tools/build_artifact.py --fetch-only [--wiki]      (just fill the download cache)

The claude.ai artifact sandbox only lets a page load scripts from a few CDNs and fonts from Google;
every other outside address (iNaturalist, Wikipedia, map tiles) is blocked, but files published next
to the page work with relative URLs - up to ~500 files / 256 MB in all. snakelist-synced.html as it
is expects thousands of separate files (one thumbnail per species, one range file per species) and
live iNaturalist data, so in the artifact it showed no photos and no sightings.

This tool writes <out>/index.html (snakelist-synced.html, patched ONLY in this copy - the live app
and the website are untouched) plus the supporting files, and <out>/publish/batch-N.json: the
Artifact tool's `files` maps ({published path: source path}), at most 250 files / 60 MB each.

  * photos: compact sprite sheets - ap/s<N>.webp (cards, 270x180 cells) and ap/p<N>.webp (the
    bigger photo viewer, the full 540x360 cell). Anything that asks for species-photos/t/<s>-<i>.webp
    gets that cell cropped from the sheet on the fly.
  * range maps (data/ranges/*.json) and data/species-info/*.json: packed into a few shard files,
    served back to the app's own fetch() calls as if they were the separate files.
  * sightings: iNaturalist (and Wikipedia) are asked live first (v6.28). Only where the sandbox blocks them are
    recent research-grade observations saved at build time used (the newest few per species + the newest few
    thousand anywhere), answered by a small stand-in for the iNaturalist API calls the app makes; then a short note
    on the map and the Following tab says so (no date, no "snapshot"), with a link to snakelist.com for live data.
  * the app runs in its "website" mode (list kept in this browser, light cards, sightings), but
    keeps its claude.ai behaviour for what can't work here (sign-in, translation, live map tiles,
    species pages - those open snakelist.com in a new tab).
  * previews: this is Eduardo's testing copy, so features still being tried out come with it, each behind
    an On / Off switch ("Previews" button in the header, remembered in this browser). First one: the
    Christmas preview (christmas/ - the theme and the Christmas Cabin), on unless --christmas off; it is
    switched on through window.SL_XMAS_FORCE before tools/xmas_loader.js runs. A future preview is one
    more entry in `previews` (plus whatever its own files and head script need). Second: the events preview
    (events/ - countdown, Advent Calendar, seasonal achievements, subscription page, cursor), on unless --events off;
    tools/events_loader.js reads its switch through window.SL_PREVIEW_ON("events").
"""
import io, json, os, re, shutil, sys, time, urllib.request
from concurrent.futures import ProcessPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CACHE = os.path.join(os.path.expanduser("~"), ".cache", "snakelist-artifact")

# ---------------------------------------------------------------------------------------------
# Sightings snapshot: recent research-grade iNaturalist observations, fetched at build time
# (the artifact sandbox can't reach api.inaturalist.org). Cached on disk, so a rebuild is quick.
# ---------------------------------------------------------------------------------------------
INAT = "https://api.inaturalist.org/v2/"
UA = "Mozilla/5.0 (compatible; static-site-build-script/1.0)"
OBS_FIELDS = ("id,uuid,observed_on,time_observed_at,observed_time_zone,created_at,quality_grade,place_guess,positional_accuracy,"
              "public_positional_accuracy,obscured,geoprivacy,taxon_geoprivacy,license_code,geojson,taxon.id,taxon.name,taxon.rank,"
              "taxon.preferred_common_name,user.id,user.login,user.name,photos.id,photos.url,photos.attribution,photos.license_code,"
              "identifications_count,num_identification_agreements,num_identification_disagreements,comments_count,faves_count,description")
PER_SPECIES = 12      # newest research-grade sightings kept per species
WORLD_PAGES = 20      # + the newest 20 x 200 research-grade snake sightings anywhere


OFFLINE = False  # --offline: only what's already in the download cache


def _get(url, tries=6):
    if OFFLINE:
        raise RuntimeError("offline")
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - network hiccups: back off and retry
            wait = 5 * (t + 1) * (3 if "429" in str(e) else 1)
            print("  retry %d (%s) %s" % (t, e, url[:100]), file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("request failed: " + url)


def _cached(folder, key, url, pause=1.05, tries=6):
    os.makedirs(folder, exist_ok=True)
    p = os.path.join(folder, key + ".json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    d = _get(url, tries)
    time.sleep(pause)  # iNaturalist asks apps to stay around one request a second
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        json.dump(d, f)
    os.replace(p + ".tmp", p)
    return d


def fetch_inat(cache, app_ids, log=print):
    """-> (taxa matched to SnakeList ids {id: taxon}, [observations])"""
    tdir, odir = os.path.join(cache, "inat", "taxa"), os.path.join(cache, "inat", "obs")
    taxa = []
    for page in range(1, 60):
        d = _cached(tdir, "p%d" % page, INAT + "taxa?taxon_id=85553&rank=species&is_active=true&per_page=200&order_by=id&page=%d"
                    "&fields=id,name,preferred_common_name,observations_count" % page)
        taxa += d.get("results", [])
        if len(d.get("results", [])) < 200:
            break
    want = set(app_ids)
    by_id = {}
    for t in taxa:
        sl = t["name"].lower().replace(" ", "-")
        if sl in want:
            by_id[sl] = t
    log("  iNaturalist: %d snake species, %d match SnakeList" % (len(taxa), len(by_id)))
    todo = sorted((t for t in by_id.values() if t.get("observations_count")), key=lambda t: t["id"])
    obs = {}
    for i, t in enumerate(todo):
        try:
            d = _cached(odir, "t%d" % t["id"], INAT + "observations?taxon_id=%d&quality_grade=research&per_page=%d&order_by=observed_on&order=desc&fields=%s"
                        % (t["id"], PER_SPECIES, OBS_FIELDS))
        except RuntimeError as e:
            if str(e) != "offline":
                raise
            continue  # --offline: only the species already in the cache
        for o in d.get("results", []):
            obs[o["id"]] = o
        if i % 250 == 0:
            log("  sightings: species %d / %d" % (i, len(todo)))
    for page in range(1, WORLD_PAGES + 1):
        try:
            d = _cached(odir, "world%d" % page, INAT + "observations?taxon_id=85553&quality_grade=research&per_page=200&order_by=id&order=desc&page=%d&fields=%s"
                        % (page, OBS_FIELDS))
        except RuntimeError as e:
            if str(e) != "offline":
                raise
            continue
        for o in d.get("results", []):
            obs[o["id"]] = o
    return by_id, list(obs.values())


WIKI = "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts&exintro=1&explaintext=1&exlimit=20&titles="


def fetch_wiki(cache, scis, log=print):
    """-> {scientific name: {"title", "extract"}} - the intro of each species' English Wikipedia article"""
    import urllib.parse
    wdir, out = os.path.join(cache, "wiki"), {}
    scis, down = sorted(set(scis)), False
    for i in range(0, len(scis), 20):
        chunk, key = scis[i:i + 20], "w%04d" % (i // 20)
        if down and not os.path.exists(os.path.join(wdir, key + ".json")):
            continue
        try:
            d = _cached(wdir, key, WIKI + urllib.parse.quote("|".join(chunk)), pause=3.0, tries=2)
        except RuntimeError as e:  # Wikipedia busy / offline: those snakes just have no intro in this copy
            if str(e) != "offline" and not down:  # (Wikipedia rate-limits busy networks hard: the next build tries again)
                log("  wikipedia: busy / not reachable - using only the intros saved earlier")
            down = True
            continue
        q = d.get("query", {})
        back = {}
        for n in q.get("normalized", []):
            back[n["to"]] = n["from"]
        for r in q.get("redirects", []):
            back[r["to"]] = back.get(r["from"], r["from"])
        for pg in q.get("pages", {}).values():
            t = pg.get("title", "")
            src = back.get(t, t)
            if pg.get("extract") and "may refer to" not in pg["extract"][:300]:
                out[src] = {"title": t, "extract": pg["extract"]}
        if i % 1000 == 0:
            log("  wikipedia: %d / %d" % (i, len(scis)))
    return out


def app_species(src):
    """[(id, scientific name)] of every card in the app"""
    out = []
    for m in re.finditer(r'<div class="card" data-id="([^"]+)"[^>]*>(.*?)<div class="card-sci[^"]*">([^<]*)</div>', src[:], re.S):
        out.append((m.group(1), m.group(3).strip()))
    return out


# ---------------------------------------------------------------------------------------------
# The page's stand-ins, injected at the top of the artifact copy only
# ---------------------------------------------------------------------------------------------
SHIM_JS = r"""
(function () {
  "use strict";
  var CFG = __CFG__;
  window.SL_ARTIFACT = CFG;
  var realFetch = window.fetch.bind(window);
  function abs(u) { try { return new URL(u, document.baseURI); } catch (e) { return null; } }
  function json(o, st) { return new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } }); }
  function text(t, st, ty) { return new Response(t, { status: st || 200, headers: { "Content-Type": ty || "text/plain" } }); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var once = {};
  function load(p) {
    return once[p] || (once[p] = realFetch(p).then(function (r) { if (!r.ok) throw new Error(p + " " + r.status); return r.json(); })
      .catch(function (e) { delete once[p]; throw e; }));
  }
  function own(u) { return u.origin === location.origin || u.protocol === "blob:"; }
  function fontHost(h) { return /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(h); }

  // ---- the app's many small files, read from a few packed ones ----
  function vfs(path) {
    var m = /(?:^|\/)data\/ranges\/([^\/]+)\.json$/.exec(path);
    if (m) {
      var id = decodeURIComponent(m[1]), n = CFG.ranges.idx[id];
      if (n == null) return Promise.resolve(text("", 404));
      return load(CFG.ranges.shard.replace("%d", n)).then(function (d) { return json(d[id]); });
    }
    m = /(?:^|\/)data\/species-info\/([^\/]+)\.json$/.exec(path);
    if (m) { var id2 = decodeURIComponent(m[1]); return load(CFG.info).then(function (d) { return d[id2] ? json(d[id2]) : text("", 404); }); }
    m = /(?:^|\/)species\/([a-z0-9-]+)\.html$/.exec(path);
    if (m) { // a species page, read only for its adult length (Size vs person in 3D)
      var stem = m[1];
      return load(CFG.lens).then(function (d) {
        var a = d[stem] || null;
        return text('<!doctype html><main class="sp-main"' + (a ? ' data-sci="' + esc(a[4]) + '" data-lenlo="' + esc(a[0]) + '" data-lenhi="' + esc(a[1]) +
          '" data-lentxt="' + esc(a[2]) + '" data-lensrc="' + esc(a[3]) + '"' : "") + "></main>", 200, "text/html");
      });
    }
    return null;
  }

  // ---- iNaturalist: answered from the snapshot taken when this copy was built ----
  var SN = null;
  function snap() {
    if (SN) return SN;
    SN = Promise.all([load(CFG.sight.taxa)].concat(CFG.sight.shards.map(load))).then(function (r) {
      var T = r[0], byId = {}, byName = {}, groups = {}, gid = 0;
      function group(name, rank, sid) {
        var k = name.toLowerCase(), g = groups[k];
        if (!g) { g = groups[k] = { id: -(++gid), name: name, rank: rank, preferred_common_name: null, observations_count: 0, members: {} }; byId[g.id] = g; }
        g.members[sid] = 1;
      }
      T.taxa.forEach(function (t) {
        var o = { id: t[0], name: t[1], preferred_common_name: t[2] || null, observations_count: t[3] || 0, rank: "species" };
        byId[o.id] = o; byName[o.name.toLowerCase()] = o;
        group(o.name.split(" ")[0], "genus", o.id);
        if (t[4]) group(t[4], "family", o.id);
      });
      Object.keys(groups).forEach(function (k) { var g = groups[k]; Object.keys(g.members).forEach(function (s) { g.observations_count += byId[s].observations_count; }); if (!byName[k]) byName[k] = g; });
      var obs = [], byObs = {};
      r.slice(1).forEach(function (s) { s.forEach(function (a) { obs.push(a); byObs[a[0]] = a; }); });
      return { users: T.users, byId: byId, byName: byName, obs: obs, byObs: byObs };
    });
    SN.catch(function () { SN = null; });
    return SN;
  }
  function taxonOut(t) {
    return t ? { id: t.id, name: t.name, rank: t.rank, preferred_common_name: t.preferred_common_name, observations_count: t.observations_count,
      is_active: true, iconic_taxon_name: "Reptilia", default_photo: null } : null;
  }
  // [id, taxon, lng, lat, observed_on, time_observed_at, tz, created_at, place, acc, pubacc, obscured, geoprivacy,
  //  taxon_geoprivacy, user, licence, photos, idents, agree, disagree, comments, faves, description]
  function hyd(S, a) {
    var t = S.byId[a[1]], u = S.users[a[14]] || [0, "", ""];
    return { id: a[0], uri: "https://www.inaturalist.org/observations/" + a[0], quality_grade: "research",
      observed_on: a[4] || null, observed_on_details: a[4] ? { date: a[4], month: +a[4].slice(5, 7), year: +a[4].slice(0, 4) } : null,
      time_observed_at: a[5] || null, observed_time_zone: a[6] || null, created_at: a[7] || null,
      user: { id: u[0], login: u[1], name: u[2] || null }, place_guess: a[8] || null, positional_accuracy: a[9], public_positional_accuracy: a[10],
      obscured: !!a[11], geoprivacy: a[12] || null, taxon_geoprivacy: a[13] || null,
      geojson: { type: "Point", coordinates: [a[2], a[3]] }, location: a[3] + "," + a[2], species_guess: t ? t.preferred_common_name || t.name : null,
      taxon: taxonOut(t), license_code: a[15] || null, description: a[22] || "", annotations: [],
      photos: a[23] ? [{ id: a[23][0], url: "ap/o/" + a[23][1] + "-" + a[23][2] + "-" + a[23][3] + "-" + a[23][4] + "/square.jpg", attribution: a[23][5], license_code: a[23][6] }] : [],
      // (just one small CC-licensed photo per snake at most: the sighting's own page on iNaturalist has them all)
      identifications_count: a[17], num_identification_agreements: a[18], num_identification_disagreements: a[19],
      comments_count: a[20], faves_count: a[21], cached_votes_total: a[21], sl_snapshot: true };
  }
  // small answers (the Following feed, one sighting): their photos as ready-made pictures, since the app
  // may also use them as CSS backgrounds, which can't be cropped on the fly; big map pages keep the
  // ap/o/... addresses, which only ever go into <img> (cropped when they're shown)
  function blobPhotos(list) {
    if (list.length > 40) return Promise.resolve(list);
    return Promise.all(list.map(function (o) {
      var ph = o.photos && o.photos[0], m = ph && /ap\/o\/(\d+)-(\d+)-(\d+)-(\d+)\//.exec(ph.url);
      if (!m) return o;
      return obsCell(+m[1], +m[2], +m[3], +m[4]).then(function (b) { ph.url = b; return o; }, function () { o.photos = []; return o; });
    }));
  }
  function hav(la1, lo1, la2, lo2) {
    var R = 6371, d1 = (la2 - la1) * Math.PI / 180, d2 = (lo2 - lo1) * Math.PI / 180;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2) + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function filterObs(S, q) {
    var want = null, none = false;
    function addTaxon(t) {
      if (!t) { return; }
      if (t.id === 85553 || /^(serpentes|squamata|reptilia)$/i.test(t.name || "")) { want = "all"; return; }
      if (want === "all") return;
      want = want || {};
      if (t.members) Object.keys(t.members).forEach(function (k) { want[k] = 1; }); else want[t.id] = 1;
    }
    var ids = (q.get("taxon_id") || "").split(",").filter(Boolean), names = (q.get("taxon_name") || "").split(",").filter(Boolean);
    if (ids.length || names.length) {
      ids.forEach(function (i) { addTaxon(+i === 85553 ? { id: 85553 } : S.byId[+i]); });
      names.forEach(function (n) { addTaxon(S.byName[n.trim().toLowerCase()]); });
      if (!want) none = true;
    }
    var qg = q.get("quality_grade"); if (qg && qg.split(",").indexOf("research") < 0) none = true;
    if (q.get("captive") === "true" || q.get("term_id") || q.get("place_id") || q.get("csi") || q.get("user_id") || q.get("user_login") || q.get("project_id")) none = true;
    if (none) return [];
    var sw = q.get("swlat"), bb = sw != null ? [+q.get("swlat"), +q.get("swlng"), +q.get("nelat"), +q.get("nelng")] : null;
    var lat = q.get("lat"), rad = lat != null ? [+lat, +q.get("lng"), +(q.get("radius") || 10)] : null;
    var d1 = q.get("d1"), d2 = q.get("d2"), c1 = q.get("created_d1"), c2 = q.get("created_d2");
    c1 = c1 ? Date.parse(c1) : null; c2 = c2 ? Date.parse(c2) : null;
    var months = q.get("month") ? q.get("month").split(",").map(Number) : null, ph = q.get("photos");
    var ida = q.get("id_above"), idb = q.get("id_below"), only = q.get("id") ? q.get("id").split(",").map(Number) : null;
    return S.obs.filter(function (a) {
      if (want && want !== "all" && !want[a[1]]) return false;
      if (only && only.indexOf(a[0]) < 0) return false;
      if (bb) { if (a[3] < bb[0] || a[3] > bb[2]) return false; if (bb[1] <= bb[3] ? (a[2] < bb[1] || a[2] > bb[3]) : (a[2] < bb[1] && a[2] > bb[3])) return false; }
      if (rad && hav(rad[0], rad[1], a[3], a[2]) > rad[2]) return false;
      if (d1 && (!a[4] || a[4] < d1)) return false;
      if (d2 && (!a[4] || a[4] > d2)) return false;
      if (c1 && !(Date.parse(a[7]) >= c1)) return false;
      if (c2 && !(Date.parse(a[7]) <= c2)) return false;
      if (months && (!a[4] || months.indexOf(+a[4].slice(5, 7)) < 0)) return false;
      if (ph === "true" && !a[16]) return false;
      if (ph === "false" && a[16]) return false;
      if (ida && a[0] <= +ida) return false;
      if (idb && a[0] >= +idb) return false;
      return true;
    });
  }
  function sortObs(list, q) {
    var by = q.get("order_by") || "created_at", asc = q.get("order") === "asc";
    var key = by === "observed_on" ? function (a) { return (a[4] || "") + (a[5] || ""); } : by === "id" ? function (a) { return a[0]; }
      : by === "votes" ? function (a) { return a[21] || 0; } : function (a) { return a[7] || ""; };
    return list.slice().sort(function (x, y) { var a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : 0) * (asc ? 1 : -1) || (y[0] - x[0]); });
  }
  function page(q, def, max) {
    var per = q.get("per_page"); per = per == null ? def : Math.max(0, Math.min(max, +per || 0));
    return { per: per, page: Math.max(1, +q.get("page") || 1) };
  }
  function inat(u) {
    var p = u.pathname.replace(/^\/v[12]\//, "/"), q = u.searchParams;
    return snap().then(function (S) {
      var m;
      if (p === "/taxa" || p === "/taxa/autocomplete") {
        var nm = (q.get("q") || "").trim().toLowerCase(), t = S.byName[nm];
        if (!t && q.get("taxon_id")) t = S.byId[+q.get("taxon_id")];
        return json({ total_results: t ? 1 : 0, page: 1, per_page: 10, results: t ? [taxonOut(t)] : [] });
      }
      if ((m = /^\/taxa\/([\d,-]+)$/.exec(p))) {
        var ts = m[1].split(",").map(function (i) { return S.byId[+i]; }).filter(Boolean).map(taxonOut);
        return json({ total_results: ts.length, page: 1, per_page: ts.length, results: ts });
      }
      if (p === "/observations") {
        var L = sortObs(filterObs(S, q), q), pg = page(q, 30, 200);
        var res0 = L.slice((pg.page - 1) * pg.per, pg.page * pg.per).map(function (a) { return hyd(S, a); });
        return blobPhotos(res0).then(function (res) { return json({ total_results: L.length, page: pg.page, per_page: pg.per, results: res }); });
      }
      if ((m = /^\/observations\/([\d,]+)$/.exec(p))) {
        var os = m[1].split(",").map(function (i) { return S.byObs[+i]; }).filter(Boolean).map(function (a) { return hyd(S, a); });
        return blobPhotos(os).then(function (os) { return json({ total_results: os.length, page: 1, per_page: os.length, results: os }); });
      }
      if (p === "/observations/species_counts") {
        var cnt = {};
        filterObs(S, q).forEach(function (a) { cnt[a[1]] = (cnt[a[1]] || 0) + 1; });
        var res = Object.keys(cnt).map(function (k) { return { count: cnt[k], taxon: taxonOut(S.byId[+k]) }; }).filter(function (x) { return x.taxon; })
          .sort(function (a, b) { return b.count - a.count; }), pg2 = page(q, 500, 500);
        return json({ total_results: res.length, page: pg2.page, per_page: pg2.per, results: res.slice((pg2.page - 1) * pg2.per, pg2.page * pg2.per) });
      }
      if (p === "/observations/histogram") {
        var iv = q.get("interval") || "month_of_year", out = {}, L2 = filterObs(S, q), n = iv === "week_of_year" ? 53 : 12;
        if (iv === "month_of_year" || iv === "week_of_year") {
          for (var i = 1; i <= n; i++) out[i] = 0;
          L2.forEach(function (a) {
            if (!a[4]) return;
            var mo = +a[4].slice(5, 7);
            if (iv === "month_of_year") out[mo]++;
            else { var d = new Date(a[4] + "T00:00:00Z"), j = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); out[Math.min(53, 1 + Math.floor((d - j) / 6048e5))]++; }
          });
        }
        var r2 = {}; r2[iv] = out;
        return json({ total_results: Object.keys(out).length, page: 1, per_page: Object.keys(out).length, results: r2 });
      }
      return json({ total_results: 0, page: 1, per_page: 0, results: [] });
    });
  }

  // ---- Wikipedia: the intro of each species' article, saved when this copy was built ----
  function wiki(u) {
    return load(CFG.wiki).then(function (W) {
      function find(t) { t = String(t || "").replace(/_/g, " ").trim(); return W[t] || W[t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()] || null; }
      var m = /\/api\/rest_v1\/page\/summary\/(.+)$/.exec(u.pathname);
      if (m) {
        var a = find(decodeURIComponent(m[1]));
        if (!a) return json({ type: "https://mediawiki.org/wiki/HyperSwitch/errors/not_found", title: "Not found." }, 404);
        return json({ type: "standard", title: a[0], displaytitle: a[0], extract: a[1], extract_html: "<p>" + esc(a[1]) + "</p>",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/" + encodeURIComponent(a[0].replace(/ /g, "_")) } } });
      }
      if (/\/w\/api\.php$/.test(u.pathname)) {
        var b = find(u.searchParams.get("titles"));
        return json({ batchcomplete: "", query: { pages: b ? { "1": { pageid: 1, ns: 0, title: b[0], extract: b[1] } } : { "-1": { ns: 0, title: u.searchParams.get("titles"), missing: "" } } } });
      }
      return json({}, 404);
    });
  }

  var LIVE = null; // null: not known yet; true: the live sites answer here; false: blocked, the saved records are used
  function live(u, input, init, saved) {
    if (LIVE === false) { savedNote(); return saved(u); }
    var t = new Promise(function (res, rej) { setTimeout(function () { rej(new Error("timeout")); }, LIVE ? 20000 : 6000); });
    return Promise.race([realFetch(input, init), t]).then(function (r) { LIVE = true; return r; }, function (e) {
      if (LIVE === true) throw e; // (it worked before: a real network error, said as such)
      LIVE = false; savedNote(); return saved(u);
    });
  }
  window.fetch = function (input, init) {
    var raw = typeof input === "string" ? input : input && input.url ? input.url : String(input);
    var u = abs(raw);
    if (!u) return realFetch(input, init);
    try {
      // v6.28 (Eduardo: "delete the sightings snapshot from 2026"): iNaturalist and Wikipedia are asked LIVE first; only
      // where this sandbox blocks them are the records saved with this copy used instead (and that is said, with no date)
      if (u.hostname === "api.inaturalist.org") return live(u, input, init, inat);
      if (u.hostname === "en.wikipedia.org") return live(u, input, init, wiki);
      if (own(u)) { var v = vfs(u.pathname); if (v) return v; }
      else if (/^https?:$/.test(u.protocol) && !fontHost(u.hostname)) // this sandbox blocks other websites: fail at once, quietly
        return Promise.reject(new TypeError("Failed to fetch (outside websites are blocked here)"));
    } catch (e) { return Promise.reject(e); }
    return realFetch(input, init);
  };

  // ---- photos: one species' photo, cropped from the compact sprite sheet ----
  var desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  var TRX = /(?:^|\/)species-photos\/t\/(\d+)-(\d+)\.webp$/;
  // sightings' own photos (CC-licensed, small): ap/o/<sheet>-<cell>-<w>-<h>/<any size>.jpg
  var ORX = /(?:^|\/)ap\/o\/(\d+)-(\d+)-(\d+)-(\d+)\/[a-z]+\.(?:jpe?g|png)$/i;
  var sheets = {}, order = [], cells = {};
  function sheet(url) {
    if (!sheets[url]) {
      sheets[url] = realFetch(url).then(function (r) { if (!r.ok) throw new Error("sheet " + url); return r.blob(); })
        .then(function (b) { return createImageBitmap(b); });
      sheets[url].catch(function () { delete sheets[url]; });
      order.push(url);
      while (order.length > 4) { var o = order.shift(); if (sheets[o]) sheets[o].then(function (bm) { try { bm.close(); } catch (e) {} }, function () {}); delete sheets[o]; }
    }
    return sheets[url];
  }
  function crop(url, x, y, w, h) {
    var k = url + "|" + x + "," + y;
    return cells[k] || (cells[k] = sheet(url).then(function (bm) {
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(bm, x, y, w, h, 0, 0, w, h);
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(URL.createObjectURL(b)) : rej(new Error("toBlob")); }, "image/jpeg", 0.92); });
    }).catch(function (e) { delete cells[k]; throw e; }));
  }
  function cell(s, i) { var P = CFG.photos; return crop(P.full.replace("%d", s), (i % P.cols) * P.w, Math.floor(i / P.cols) * P.h, P.w, P.h); }
  function obsCell(s, i, w, h) { var O = CFG.obsPhotos; return crop(O.sheet.replace("%d", s), (i % O.cols) * O.cell, Math.floor(i / O.cols) * O.cell, w, h); }
  function want(img, v) {
    var s = String(v == null ? "" : v), u = s && !/^(data|blob):/.test(s) ? abs(s) : null;
    if (!u) { img.__slw = null; return false; }
    var m = own(u) && TRX.exec(u.pathname), mo = !m && own(u) && CFG.obsPhotos && ORX.exec(u.pathname);
    if (m || mo) {
      img.__slw = s;
      (m ? cell(+m[1], +m[2]) : obsCell(+mo[1], +mo[2], +mo[3], +mo[4])).then(function (b) { if (img.__slw === s) desc.set.call(img, b); }, function () { if (img.__slw === s) desc.set.call(img, "data:,"); });
      return true;
    }
    if (!own(u) && /^https?:$/.test(u.protocol) && !fontHost(u.hostname)) { img.__slw = s; desc.set.call(img, "data:,"); return true; } // blocked here: fail at once
    img.__slw = null; return false;
  }
  Object.defineProperty(HTMLImageElement.prototype, "src", { configurable: true, enumerable: desc.enumerable, get: desc.get,
    set: function (v) { if (!want(this, v)) desc.set.call(this, v); } });
  var setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (this instanceof HTMLImageElement && String(n).toLowerCase() === "src" && want(this, v)) return;
    return setAttr.call(this, n, v);
  };
  function scan(n) {
    if (n.nodeType !== 1) return;
    var list = n.tagName === "IMG" ? [n] : n.getElementsByTagName ? n.getElementsByTagName("img") : [];
    for (var i = 0; i < list.length; i++) { var a = list[i].getAttribute("src"); if (a && list[i].__slw !== a && !/^(data|blob):/.test(a)) want(list[i], a); }
  }
  new MutationObserver(function (ms) { ms.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) scan(m.addedNodes[i]); }); })
    .observe(document.documentElement, { childList: true, subtree: true });

  // ---- only when iNaturalist can't be reached from here: a short note that these are records saved with this copy ----
  var NOTE = 'iNaturalist can\'t be reached from here, so these are sightings saved with this copy &mdash; every sighting, live, on <a href="https://snakelist.com" target="_blank" rel="noopener">snakelist.com</a>';
  var noteWanted = false;
  function savedNote() { if (!noteWanted) { noteWanted = true; notes(); } }
  function notes() {
    if (!noteWanted) return;
    var stage = document.querySelector(".globe-stage"), sg = document.getElementById("sg-toggle");
    if (stage && sg && !document.getElementById("sl-art-sgnote")) {
      var d = document.createElement("div"); d.id = "sl-art-sgnote"; d.className = "sl-art-note"; d.innerHTML = NOTE; d.hidden = true; stage.appendChild(d);
      var sync = function () { d.hidden = sg.getAttribute("aria-pressed") !== "true"; };
      new MutationObserver(sync).observe(sg, { attributes: true, attributeFilter: ["aria-pressed", "class"] }); sync();
    }
    var ff = document.getElementById("follow-feed");
    if (ff && !document.getElementById("sl-art-ffnote")) {
      var p = document.createElement("p"); p.id = "sl-art-ffnote"; p.className = "sl-art-note sl-art-note-inline"; p.innerHTML = NOTE;
      ff.parentNode.insertBefore(p, ff.nextSibling); // (just under the feed)
      var sync2 = function () { p.hidden = ff.hidden; };
      new MutationObserver(sync2).observe(ff, { attributes: true, attributeFilter: ["hidden"] }); sync2();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", notes); else notes();
  window.addEventListener("load", notes);
})();
"""

SHIM_CSS = """
/* claude.ai artifact copy: installing needs snakelist.com itself */
html.sl-web .install-btn { display: none !important; }
.sl-art-note { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%); z-index: 6; max-width: calc(100% - 24px); box-sizing: border-box;
  padding: 5px 11px; border-radius: 999px; background: rgba(20, 40, 30, .78); color: #fff; font: 500 12px/1.35 Inter, system-ui, sans-serif; text-align: center; pointer-events: auto; }
.sl-art-note a { color: #bfe8c9; font-weight: 600; }
.sl-art-note[hidden] { display: none; }
.sl-art-note-inline { position: static; transform: none; display: block; max-width: 900px; margin: 0 auto 16px; text-align: left; background: rgba(31, 90, 58, .1); color: inherit; border-radius: 8px; }
.sl-art-note-inline a { color: inherit; text-decoration: underline; }
"""

# ---------------------------------------------------------------------------------------------
# Previews (testing copy only): features still being tried out, each with an On / Off switch
# ---------------------------------------------------------------------------------------------
PREVIEWS_HEAD_JS = r"""
(function () {
  // [{key, label, about, on (its starting state)}]; the viewer's own choice is kept in this browser
  var P = window.SL_PREVIEWS = __PREVIEWS__;
  window.SL_PREVIEW_ON = function (k) {
    var p = P.filter(function (x) { return x.key === k; })[0]; if (!p) return false;
    try { var v = localStorage.getItem("sl-art-preview-" + k); if (v === "1" || v === "0") return v === "1"; } catch (e) {}
    return !!p.on;
  };
  if (window.SL_PREVIEW_ON("xmas")) window.SL_XMAS_FORCE = true;
  else try { sessionStorage.removeItem("sl-xmas-preview"); } catch (e) {}
})();
"""

PREVIEWS_UI_JS = r"""
(function () {
  function go() {
    var bar = document.querySelector(".hdr-actions"); if (!bar || document.getElementById("sl-art-prev")) return;
    var P = window.SL_PREVIEWS || [], on = P.filter(function (p) { return window.SL_PREVIEW_ON(p.key); });
    var b = document.createElement("button");
    b.type = "button"; b.id = "sl-art-prev"; b.className = "sl-art-prev-btn"; b.setAttribute("aria-haspopup", "dialog"); b.setAttribute("aria-expanded", "false");
    b.innerHTML = '<span class="sl-art-prev-dot' + (on.length ? " on" : "") + '"></span>Previews' + (on.length ? " <b>" + on.length + " on</b>" : "");
    var auth = bar.querySelector(".auth-btn"); if (auth && auth.nextSibling) bar.insertBefore(b, auth.nextSibling); else bar.appendChild(b);
    var pop = document.createElement("div"); pop.className = "sl-art-prev-pop"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Previews");
    pop.innerHTML = '<div class="sl-art-prev-h">Previews <small>testing copy only</small></div>' + P.map(function (p) {
      var v = window.SL_PREVIEW_ON(p.key);
      return '<div class="sl-art-prev-row"><div><b>' + p.label + '</b><small>' + (p.about || "") + '</small></div>' +
        '<button type="button" class="sl-art-prev-sw' + (v ? " on" : "") + '" data-k="' + p.key + '" aria-pressed="' + v + '">' + (v ? "On" : "Off") + "</button></div>";
    }).join("") + '<div class="sl-art-prev-h" style="margin-top:12px">See again <small>pop-ups that only come once</small></div>' + [
      ["level", "First visit: How well do you know snakes?", "The screen new visitors see first"],
      ["news", "What&rsquo;s new", "The updates panel"],
      ["xwel", "Christmas welcome", "Merry Christmas from SnakeList! (turns the Christmas preview on)"]
    ].map(function (a) {
      return '<div class="sl-art-prev-row"><div><b>' + a[1] + '</b><small>' + a[2] + '</small></div><button type="button" class="sl-art-prev-sw sl-art-prev-show" data-show="' + a[0] + '">Show</button></div>';
    }).join("") + '<p class="sl-art-prev-n">Switching reloads SnakeList. Your list stays as it is.</p>';
    document.body.appendChild(pop);
    function place() {
      var r = b.getBoundingClientRect();
      pop.style.top = (r.bottom + 8 + window.scrollY) + "px";
      pop.style.left = Math.max(12, Math.min(r.right - 300, document.documentElement.clientWidth - 312)) + "px";
    }
    function shut() { pop.hidden = true; b.setAttribute("aria-expanded", "false"); }
    b.addEventListener("click", function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; b.setAttribute("aria-expanded", String(!pop.hidden)); if (!pop.hidden) place(); });
    document.addEventListener("click", function (e) { if (!pop.hidden && !pop.contains(e.target)) shut(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { shut(); b.focus(); } });
    pop.addEventListener("click", function (e) {
      var sh = e.target.closest(".sl-art-prev-show");
      if (sh) {
        var w = sh.getAttribute("data-show"); shut();
        if (w === "level" && window.SL_LEVEL_OPEN) window.SL_LEVEL_OPEN({});
        else if (w === "news") { var v = document.querySelector(".sl-ver"); if (v) v.click(); }
        else if (w === "xwel") { try { localStorage.removeItem("sl-xmas-welcome-seen"); localStorage.setItem("sl-art-preview-xmas", "1"); } catch (er) {} setTimeout(function () { location.reload(); }, 150); }
        return;
      }
      var s = e.target.closest(".sl-art-prev-sw"); if (!s) return;
      var k = s.getAttribute("data-k"), v = !window.SL_PREVIEW_ON(k);
      try { localStorage.setItem("sl-art-preview-" + k, v ? "1" : "0"); } catch (er) {}
      if (k === "xmas" && !v) try { sessionStorage.removeItem("sl-xmas-preview"); } catch (er) {}
      s.textContent = v ? "On" : "Off"; s.classList.toggle("on", v); s.setAttribute("aria-pressed", String(v));
      setTimeout(function () { location.reload(); }, 150);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
"""

PREVIEWS_CSS = """
.sl-art-prev-btn { display: inline-flex; align-items: center; gap: 7px; font: 500 13px 'Inter', sans-serif; padding: 8px 13px; border-radius: 8px;
  border: 1px dashed var(--border, #c9d6c6); background: var(--surface, #fff); color: var(--text, #1d2b22); cursor: pointer; white-space: nowrap; }
.sl-art-prev-btn b { font-weight: 600; }
.sl-art-prev-dot { width: 8px; height: 8px; border-radius: 50%; background: #9aa59d; flex: none; }
.sl-art-prev-dot.on { background: #d9a520; box-shadow: 0 0 0 3px rgba(217, 165, 32, .22); }
.sl-art-prev-pop { position: absolute; z-index: 9400; width: 300px; max-width: calc(100vw - 24px); box-sizing: border-box; padding: 14px; border-radius: 14px;
  background: var(--surface, #fff); color: var(--text, #1d2b22); border: 1px solid var(--border, #c9d6c6); box-shadow: 0 14px 40px rgba(0, 0, 0, .22); font: 14px/1.4 'Inter', sans-serif; }
.sl-art-prev-pop[hidden] { display: none; }
.sl-art-prev-h { font-weight: 700; margin-bottom: 10px; }
.sl-art-prev-h small { font-weight: 500; opacity: .6; margin-left: 6px; font-size: 12px; }
.sl-art-prev-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--border, #e3e9e1); }
.sl-art-prev-row small { display: block; opacity: .65; font-size: 12px; }
.sl-art-prev-sw { min-width: 58px; font: 600 13px 'Inter', sans-serif; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--border, #c9d6c6); background: transparent; color: inherit; cursor: pointer; }
.sl-art-prev-sw.on { background: #2f7d4a; border-color: #2f7d4a; color: #fff; }
.sl-art-prev-n { margin: 10px 0 0; font-size: 12px; opacity: .65; }
@media (max-width: 600px) { .sl-art-prev-btn { padding: 7px 10px; font-size: 12px; } }
"""


# Every place the app asks "am I inside claude.ai?" (window.claude && window.claude.use). Inside the artifact
# window.claude exists, so the app would act as its old claude.ai copy (no photos files, no sightings, list
# not kept). Each place gets an explicit answer: False = do what the website does, True = keep the claude.ai
# behaviour (things that can't work in this sandbox), None = leave the check alone. ("b" = text just before
# the check, "a" = text just after it.) A check that isn't listed stops the build, so a new one gets a decision.
CLAUDE_CHECKS = [
    ("a", ')) R.classList.add("sl-web")', False),                       # website look (Sign in button etc.)
    ("a", ") return; // inside claude.ai: the viewer syncs it", False),  # the list is kept in this browser
    ("b", "says how many cards are light.", False),                     # light cards
    ("a", ' ? window.claude.use("downloads")', None),                   # downloads: the artifact's own capability
    ("b", "a.hidden = true;", True),                                    # links to place pages: not in this copy
    ("a", ') return "https://snakelist.com/species/" + id;', True),     # species pages open on snakelist.com
    ("a", " ? ' target=\"_blank\" rel=\"noopener\"' : \"\") + \">View full species page", True),
    ("a", ') window.open(url, "_blank", "noopener");', True),
    ("a", ') { IUCN_STATE = "off";', True),                             # IUCN list per country: live only
    ("b", "placeCounts.loading ||", False),                             # species/place-counts.js is included
    ("b", "!CLEANED[it[0] + \"-\" + it[1]] && !(", True),                # full-size photo from iNaturalist: no
    ("a", ') { window.open("https://snakelist.com/species/" + id', True),
    ("a", ') return "Sightings only load on snakelist.com', False),
    ("a", ' ? "" : \'<button type="button" class="fp-retry">', False),
    ("b", "(function background() {", True),                            # look up photos online: no
    ("a", ")) return; // claude.ai's copy blocks outside sites", True),  # satellite tiles
    ("a", ')) { window.SL_STREET_TILE_Z = 0; return; }', True),          # street tiles
    ("a", ') setStatus("Real maps only load on snakelist.com', True),
    ("a", ') setStatus("The heatmap only loads on snakelist.com', True),
    ("a", ' ? " - open snakelist.com for them." : ".")', True),          # heatmap's "sightings" measure: live only
    ("b", "if (liveOK && !(", True),                                     # sightings map tiles
    ("b", "function vtOff() { return !VT_TD || !window.Path2D || !!(", True),  # OpenFreeMap street detail: blocked in claude.ai
    ("b", "var web = !(", True),                                         # no cookie banner / consent (no analytics here)
    ("b", "load: function () { return FIREBASE_CONFIG && !(", True),    # accounts, sign-in: snakelist.com
    ("a", ') { formSay("Email accounts work on snakelist.com', True),
    ("b", 'user.kind === "email" && FIREBASE_CONFIG && !(', True),
    ("b", "function switchTo(targetId) {\n    if (", True),
    ("b", "acctBox.innerHTML = ", True),
    ("a", ') { say("Sign in with Google works on snakelist.com', True),
    ("a", " ? ' target=\"_blank\" rel=\"noopener\"' : \"\") + \">Open full species page", True),
    ("a", ') { note("Translation works on snakelist.com', True),
    ("b", 'if (cur !== "en" && !(', True),
    ("a", ') { note("The 3D map works on snakelist.com', True),          # the 3D map: outside picture and height servers
]
CHECK = "window.claude && window.claude.use"


def patch_claude_checks(html):
    # the map's sightings layer reads iNaturalist (answered from the snapshot); its heatmap keeps using
    # the checklist's own range data, as in the claude.ai copy
    decl = "var liveOK = !(window.claude && window.claude.use); // assume the website can reach iNaturalist"
    assert html.count(decl) == 1, "liveOK declaration changed"
    sg = html.index("sgBtn.title = liveOK")
    start = html.rindex("<script", 0, html.index(decl))
    head, mid, tail = html[:start], html[start:sg], html[sg:]
    mid = mid.replace(decl, "var liveOK = true, liveHeat = false; // (artifact copy) sightings: the snapshot; heatmap: range data")
    mid = re.sub(r"\bliveOK\b(?! = true, liveHeat)", "liveHeat", mid)
    mid = mid.replace("var liveHeat = true, liveHeat = false;", "var liveOK = true, liveHeat = false;")
    html = head + mid + tail
    out, pos, n = [], 0, 0
    for m in re.finditer(re.escape(CHECK), html):
        b, a = html[max(0, m.start() - 160):m.start()], html[m.end():m.end() + 120]
        hit = [v for w, s, v in CLAUDE_CHECKS if (s in b if w == "b" else a.startswith(s))]
        if len(set(hit)) != 1:
            raise SystemExit("build_artifact: an unclassified claude.ai check - add it to CLAUDE_CHECKS:\n  ..." + b[-100:] + " <CHECK> " + a[:80])
        out.append(html[pos:m.start()])
        out.append(CHECK if hit[0] is None else ("true" if hit[0] else "false"))
        pos = m.end(); n += 1
    out.append(html[pos:])
    return "".join(out), n


def sub_once(html, old, new, what, regex=False):
    if regex:
        html2, k = re.subn(old, lambda m: new, html, count=1)
    else:
        k = html.count(old)
        html2 = html.replace(old, new, 1)
    if k < 1:
        raise SystemExit("build_artifact: couldn't find " + what + " - the app changed; update tools/build_artifact.py")
    return html2


# ---------------------------------------------------------------------------------------------
# photo sprite sheets
# ---------------------------------------------------------------------------------------------
FULL_Q, SMALL_Q, SMALL_CELL = 48, 65, (270, 180)


def _encode_sheet(args):
    src, dst_full, dst_small, cols, rows = args
    from PIL import Image
    im = Image.open(src).convert("RGB")
    im.save(dst_full + ".tmp", "WEBP", quality=FULL_Q, method=6)
    os.replace(dst_full + ".tmp", dst_full)
    im.resize((SMALL_CELL[0] * cols, SMALL_CELL[1] * rows), Image.LANCZOS).save(dst_small + ".tmp", "WEBP", quality=SMALL_Q, method=6)
    os.replace(dst_small + ".tmp", dst_small)
    return src


def build_sheets(cache, sheets, cols, rows, log):
    pdir = os.path.join(cache, "photos")
    os.makedirs(pdir, exist_ok=True)
    jobs, out = [], {}
    for n in sheets:
        src = os.path.join(ROOT, "species-photos", "p%d.jpg" % n)
        st = os.stat(src)
        tag = "%d-%d-q%d-%d-%dx%d" % (st.st_size, int(st.st_mtime), FULL_Q, SMALL_Q, SMALL_CELL[0], SMALL_CELL[1])
        full, small = os.path.join(pdir, "p%d-%s.webp" % (n, tag)), os.path.join(pdir, "s%d-%s.webp" % (n, tag))
        out[n] = (full, small)
        if not (os.path.exists(full) and os.path.exists(small)):
            jobs.append((src, full, small, cols, rows))
    if jobs:
        log("  encoding %d photo sheets..." % len(jobs))
        with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2))) as ex:
            for i, _ in enumerate(ex.map(_encode_sheet, jobs)):
                if i % 25 == 0:
                    log("    %d / %d" % (i, len(jobs)))
    return out


# ---------------------------------------------------------------------------------------------
# the build
# ---------------------------------------------------------------------------------------------
def compact(o):
    return json.dumps(o, separators=(",", ":"), ensure_ascii=False)


def shard_dict(items, limit):
    """[(key, json text)] -> [[(key, text)...]] each under `limit` bytes"""
    shards, cur, size = [], [], 0
    for k, t in items:
        if cur and size + len(t) > limit:
            shards.append(cur); cur, size = [], 0
        cur.append((k, t)); size += len(t.encode("utf-8")) + len(k) + 4
    if cur:
        shards.append(cur)
    return shards


def write_shard(path, pairs):
    with open(path, "w", encoding="utf-8") as f:
        f.write("{" + ",".join(json.dumps(k) + ":" + t for k, t in pairs) + "}")


OBS_PHOTO_CELL, OBS_PHOTO_COLS, OBS_PHOTO_Q = 240, 10, 70


def _photo_dl(args):
    url, dst = args
    if os.path.exists(dst):
        return dst
    for t in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(dst + ".tmp", "wb") as f:
                f.write(data)
            os.replace(dst + ".tmp", dst)
            return dst
        except Exception:  # noqa: BLE001
            time.sleep(3 * (t + 1))
    return None


def pack_obs_photos(cache, out, obs, rows_, put, log):
    """One small CC-licensed photo per species (its newest sighting that has one), packed into sprite sheets.
    Fills row[23] = [photo id, sheet, cell, w, h, attribution, licence] for those sightings."""
    from PIL import Image
    pdir = os.path.join(cache, "inat", "photos")
    os.makedirs(pdir, exist_ok=True)
    by_id = {o["id"]: o for o in obs}
    picked, seen = [], set()
    for r in rows_:  # rows_ are newest first
        if r[1] in seen:
            continue
        ph = next((p for p in (by_id[r[0]].get("photos") or []) if (p.get("license_code") or "").startswith("cc") and p.get("url")), None)
        if ph:
            seen.add(r[1])
            picked.append((r, ph))
    jobs = [(ph["url"].replace("/square.", "/small."), os.path.join(pdir, "%d.jpg" % ph["id"])) for _, ph in picked]
    todo = [j for j in jobs if not os.path.exists(j[1])]
    if todo and not OFFLINE:
        log("  downloading %d sighting photos..." % len(todo))
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=6) as ex:
            list(ex.map(_photo_dl, todo))
    per = OBS_PHOTO_COLS * OBS_PHOTO_COLS
    cells, sheet_imgs = [], []
    for (r, ph), (_, path) in zip(picked, jobs):
        if not os.path.exists(path):
            continue
        try:
            im = Image.open(path).convert("RGB")
        except Exception:  # noqa: BLE001
            continue
        im.thumbnail((OBS_PHOTO_CELL, OBS_PHOTO_CELL), Image.LANCZOS)
        cells.append((r, ph, im))
    for n in range(0, len(cells), per):
        chunk = cells[n:n + per]
        rows_n = (len(chunk) + OBS_PHOTO_COLS - 1) // OBS_PHOTO_COLS
        sh = Image.new("RGB", (OBS_PHOTO_COLS * OBS_PHOTO_CELL, rows_n * OBS_PHOTO_CELL), (20, 30, 24))
        for i, (r, ph, im) in enumerate(chunk):
            sh.paste(im, ((i % OBS_PHOTO_COLS) * OBS_PHOTO_CELL, (i // OBS_PHOTO_COLS) * OBS_PHOTO_CELL))
            r[23] = [ph["id"], n // per, i, im.width, im.height, ph.get("attribution") or "", ph.get("license_code") or ""]
        b = io.BytesIO()
        sh.save(b, "WEBP", quality=OBS_PHOTO_Q, method=6)
        put("ad/obs-photos-%d.webp" % (n // per), b.getvalue())
    log("  sighting photos: %d (CC-licensed, one per species), %d sheet(s)" % (len(cells), (len(cells) + per - 1) // per))
    return {"sheet": "ad/obs-photos-%d.webp", "cols": OBS_PHOTO_COLS, "cell": OBS_PHOTO_CELL} if cells else None



def build(out, christmas_default=True, events_default=True, cache=DEFAULT_CACHE, offline=False, log=print):
    t0 = time.time()
    src_path = os.path.join(ROOT, "snakelist-synced.html")
    html = open(src_path, encoding="utf-8").read()
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    files = {}  # published path -> file in <out>

    def put(pub, data=None, src=None):
        dst = os.path.join(out, pub)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if src is not None:
            shutil.copyfile(src, dst)
        else:
            with open(dst, "wb") as f:
                f.write(data if isinstance(data, bytes) else data.encode("utf-8"))
        files[pub] = dst

    ver = (re.search(r'class="sl-ver"[^>]*>\s*v?([\d.]+)', html) or re.search(r"v(\d+\.\d+)", html)).group(1)
    log("SnakeList v%s -> %s (Christmas preview %s at first)" % (ver, out, "on" if christmas_default else "off"))

    # ---- 1. photos ----
    pi = re.search(r'<script type="application/json" id="photo-index">(.*?)</script>', html, re.S)
    P = json.loads(pi.group(1))
    cols, rows, W, H = P["cols"], P["rows"], P["w"], P["h"]
    sheets = sorted({it[0] for it in P["items"].values()})
    enc = build_sheets(cache, sheets, cols, rows, log)
    for n, (full, small) in enc.items():
        put("ap/p%d.webp" % n, src=full)
        put("ap/s%d.webp" % n, src=small)
    for f in sorted(os.listdir(os.path.join(ROOT, "species-photos", "hero"))):
        if f.endswith(".webp"):
            put("species-photos/hero/" + f, src=os.path.join(ROOT, "species-photos", "hero", f))
    put("species-photos/habitats.jpg", src=os.path.join(ROOT, "species-photos", "habitats.jpg"))
    html = sub_once(html, '"path":"species-photos/p%d.jpg"', '"path":"ap/p%d.webp"', "the photo index's sprite path")
    # the cards: the cell of a small sheet instead of one file per species
    # v6.19: the app builds one rule per card from `img`/`y` (and, on the website, CSS variables instead - never inside the copy)
    html = sub_once(html,
                    """css.push('.card[data-id="' + id + '"]::before{content:"";cursor:zoom-in;background-image:' + img + ";background-size:100% auto;background-position:50% " + y + "}");""",
                    """css.push('.card[data-id="' + id + '"]::before{content:"";cursor:zoom-in;background-image:url(ap/s' + it[0] + ".webp);background-size:" + C * 100 + "% auto;background-position:" + (C > 1 ? col / (C - 1) * 100 : 0) + "% " + py.toFixed(3) + "%}");""",
                    "the card photo style")
    html = sub_once(html, "var web = !(window.claude && window.claude.use), grid0", "var web = false, grid0", "the card photo mode")

    # ---- 2. map data, range shards, species info ----
    for f in ("data/geo.js", "data/cities-more.js", "data/islands.js", "data/places.js", "species/place-counts.js", "species/world.svg",
              "vendor/earth/blue-marble.jpg", "vendor/tfjs/tf.min.js", "app/icon-192-b.png"):
        put(f, src=os.path.join(ROOT, f))
    for d in ("vendor/leaflet", "data/camid2", "species/3d"):
        for base, _, fs in os.walk(os.path.join(ROOT, d)):
            for f in sorted(fs):
                p = os.path.join(base, f)
                put(os.path.relpath(p, ROOT).replace(os.sep, "/"), src=p)
    # the 3D files ask for themselves with ?r=<n> cache tags: plain names here
    for f in ("viewer.js", "extras.js", "nature.js"):
        p = files["species/3d/" + f]
        t = open(p, encoding="utf-8").read()
        t = re.sub(r"\?r=\d+(?=['\"])", "", t)
        if f == "extras.js":
            t = t.replace("'No map for this snake yet.'", "'The map of where it lives is on its species page on snakelist.com.'")
        open(p, "w", encoding="utf-8").write(t)
    rdir = os.path.join(ROOT, "data", "ranges")
    items = []
    for f in sorted(os.listdir(rdir)):
        if f.endswith(".json"):
            items.append((f[:-5], compact(json.load(open(os.path.join(rdir, f), encoding="utf-8")))))
    ridx = {}
    os.makedirs(os.path.join(out, "ad"), exist_ok=True)
    for i, sh in enumerate(shard_dict(items, 4_500_000)):
        write_shard(os.path.join(out, "ad", "ranges-%d.json" % i), sh)
        files["ad/ranges-%d.json" % i] = os.path.join(out, "ad", "ranges-%d.json" % i)
        for k, _ in sh:
            ridx[k] = i
    idir = os.path.join(ROOT, "data", "species-info")
    info = [(f[:-5], compact(json.load(open(os.path.join(idir, f), encoding="utf-8")))) for f in sorted(os.listdir(idir)) if f.endswith(".json")]
    write_shard(os.path.join(out, "ad", "species-info.json"), info)
    files["ad/species-info.json"] = os.path.join(out, "ad", "species-info.json")
    # adult lengths from the species pages (3D's Size vs person reads them)
    lens = {}
    sdir = os.path.join(ROOT, "species")
    for f in os.listdir(sdir):
        if not f.endswith(".html"):
            continue
        t = open(os.path.join(sdir, f), encoding="utf-8", errors="replace").read(400000)
        m = re.search(r'<main class="sp-main"([^>]*)>', t)
        if m and "data-lenhi" in m.group(1):
            a = dict(re.findall(r'data-([a-z]+)="([^"]*)"', m.group(1)))
            import html as _h
            lens[f[:-5]] = [_h.unescape(a.get(k, "")) for k in ("lenlo", "lenhi", "lentxt", "lensrc", "sci")]
    put("ad/lens.json", compact(lens))
    # mapOf (3D's "Where it lives") would frame a snakelist.com page, which this sandbox blocks; pageLenOf reads the local table
    html = sub_once(html, 'return u + (u.indexOf("?") < 0 ? "?" : "&") + "embed=map";', 'return ""; // (artifact copy: no framed pages)', "3D map url")
    i = html.index("function pageLenOf(id, p) {")
    html = html[:i] + sub_once(html[i:], 'var u = window.SL_SP_PAGE_URL ? window.SL_SP_PAGE_URL(id) : "";', 'var u = ""; // (artifact copy: the local length table)', "3D length url")

    # pages that aren't in this copy (species pages, photo credits, privacy): snakelist.com, in a new tab
    site = r'\(location\.protocol === "https:" && location\.hostname\.indexOf\("snakelist\.com"\) >= 0 \? "" : "\.html"\)'
    html, k1 = re.subn(r'location\.href = "species/" \+ (\w+) \+ ' + site, r'window.open("https://snakelist.com/species/" + \1, "_blank", "noopener")', html)
    html, k2 = re.subn(r'"species/" \+ (\w+) \+ ' + site, r'"https://snakelist.com/species/" + \1', html)
    html = sub_once(html, 'pc.href = "species/photo-credits.html#" + id;', 'pc.href = "https://snakelist.com/species/photo-credits.html#" + id;', "photo credits link")
    html, k3 = re.subn(r'href="(privacy|terms|about|install)\.html"', r'href="https://snakelist.com/\1.html"', html)
    log("  links to pages on snakelist.com: %d" % (k1 + k2 + k3))

    # ---- 3. sightings + Wikipedia snapshot ----
    species = app_species(html)
    fam = dict(re.findall(r'<div class="card" data-id="([^"]+)"[^>]*?data-family="([^"]*)"', html))
    global OFFLINE
    OFFLINE = offline
    try:
        taxa, obs = fetch_inat(cache, [i for i, _ in species], log=log)
    except RuntimeError as e:
        raise SystemExit("build_artifact: no sightings snapshot (%s) - run without --offline, or --fetch-only first" % e)
    users, uidx, rows_ = [], {}, []
    tid = {t["id"] for t in taxa.values()}
    for o in sorted(obs, key=lambda o: -o["id"]):
        t = o.get("taxon") or {}
        c = (o.get("geojson") or {}).get("coordinates")
        if not c or t.get("id") not in tid:  # no public location, or a snake that isn't on the checklist
            continue
        u = o.get("user") or {}
        if u.get("id") not in uidx:
            uidx[u.get("id")] = len(users); users.append([u.get("id"), u.get("login") or "", u.get("name") or ""])
        desc = re.sub(r"<[^>]+>", " ", o.get("description") or "").strip()
        desc = re.sub(r"\s+", " ", desc)[:600]
        rows_.append([o["id"], t["id"], round(c[0], 5), round(c[1], 5), o.get("observed_on") or "", o.get("time_observed_at") or "",
                      o.get("observed_time_zone") or "", o.get("created_at") or "", o.get("place_guess") or "", o.get("positional_accuracy"),
                      o.get("public_positional_accuracy"), 1 if o.get("obscured") else 0, o.get("geoprivacy") or "", o.get("taxon_geoprivacy") or "",
                      uidx[u.get("id")], o.get("license_code") or "", len(o.get("photos") or []), o.get("identifications_count") or 0,
                      o.get("num_identification_agreements") or 0, o.get("num_identification_disagreements") or 0, o.get("comments_count") or 0,
                      o.get("faves_count") or 0, desc, 0])
    obs_photos = pack_obs_photos(cache, out, obs, rows_, put, log)
    w1 = os.path.join(cache, "inat", "obs", "world1.json")  # the day the snapshot was taken
    snap_date = time.strftime("%Y-%m-%d", time.gmtime(os.path.getmtime(w1) if os.path.exists(w1) else time.time()))
    tx_rows = [[t["id"], t["name"], t.get("preferred_common_name") or "", t.get("observations_count") or 0, fam.get(i, "")] for i, t in sorted(taxa.items())]
    put("ad/inat-taxa.json", compact({"taxa": tx_rows, "users": users}))
    sh_paths = []
    chunk = []
    size = 0
    for r in rows_:
        s = compact(r)
        if chunk and size + len(s) > 3_500_000:
            sh_paths.append(chunk); chunk, size = [], 0
        chunk.append(s); size += len(s) + 1
    if chunk:
        sh_paths.append(chunk)
    for i, ch in enumerate(sh_paths):
        put("ad/inat-obs-%d.json" % i, "[" + ",".join(ch) + "]")
    log("  sightings snapshot: %d observations of %d species, %d shard(s)" % (len(rows_), len({r[1] for r in rows_}), len(sh_paths)))
    wk = fetch_wiki(cache, [s for _, s in species], log=log)
    put("ad/wiki.json", compact({k: [v["title"], v["extract"][:2500]] for k, v in sorted(wk.items())}))
    log("  wikipedia intros: %d" % len(wk))

    # ---- 4. the app's own checks + the stand-ins ----
    html, n = patch_claude_checks(html)
    log("  claude.ai checks answered: %d" % n)
    cfg = {"version": ver, "photos": {"full": "ap/p%d.webp", "cols": cols, "rows": rows, "w": W, "h": H},
           "ranges": {"shard": "ad/ranges-%d.json", "idx": ridx}, "info": "ad/species-info.json", "lens": "ad/lens.json",
           "wiki": "ad/wiki.json", "obsPhotos": obs_photos, "sight": {"date": snap_date, "taxa": "ad/inat-taxa.json",
                                              "shards": ["ad/inat-obs-%d.json" % i for i in range(len(sh_paths))]}}
    inject = "<script>" + SHIM_JS.replace("__CFG__", compact(cfg).replace("</", "<\\/")) + "</script>\n<style>" + SHIM_CSS + "</style>\n"
    # previews: features being tried out on the testing copy, each with its own On / Off switch
    previews = []
    if os.path.isfile(os.path.join(ROOT, "christmas", "xmas.js")):
        for base, _, fs in os.walk(os.path.join(ROOT, "christmas")):
            for f in sorted(fs):
                p = os.path.join(base, f)
                rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
                if rel != "christmas/index.html":  # (the website's redirect page)
                    put(rel, src=p)
        previews.append({"key": "xmas", "label": "Christmas preview", "about": "Christmas look + Christmas Cabin", "on": christmas_default})
    # the events preview (events/ - countdown, Advent Calendar, seasonal achievements, subscription page, cursor)
    if os.path.isfile(os.path.join(ROOT, "events", "core.js")):
        for f in sorted(os.listdir(os.path.join(ROOT, "events"))):
            if f.endswith((".js", ".css")):
                put("events/" + f, src=os.path.join(ROOT, "events", f))
        fd = os.path.join(ROOT, "events", "fonts")  # v6.19: the countdown's own typeface
        if os.path.isdir(fd):
            for f in sorted(os.listdir(fd)):
                put("events/fonts/" + f, src=os.path.join(fd, f))
        previews.append({"key": "events", "label": "Events preview", "about": "Event countdown, Advent Calendar, seasonal achievements, subscription page, cursor", "on": events_default})
    inject += "<script>" + PREVIEWS_HEAD_JS.replace("__PREVIEWS__", compact(previews)) + "</script>\n"
    if any(p["key"] == "xmas" for p in previews):
        loader = open(os.path.join(ROOT, "tools", "xmas_loader.js"), encoding="utf-8").read().split("*/", 1)[1].strip()
        loader = loader.replace("__ROOT__", 'new URL("./",location.href).href').replace("__KIND__", '"xm-app"')
        inject += "<script>" + loader + "</script>\n"
    if any(p["key"] == "events" for p in previews):
        import hashlib
        evv = hashlib.sha1(b"".join(open(os.path.join(ROOT, "events", f), "rb").read() for f in sorted(os.listdir(os.path.join(ROOT, "events"))) if f.endswith((".js", ".css")))).hexdigest()[:10]
        loader = open(os.path.join(ROOT, "tools", "events_loader.js"), encoding="utf-8").read().split("*/", 1)[1].strip()
        inject += "<script>" + loader.replace("__ROOT__", 'new URL("./",location.href).href').replace("__EVV__", '"%s"' % evv) + "</script>\n"
    if previews:
        inject += "<script>" + PREVIEWS_UI_JS + "</script>\n<style>" + PREVIEWS_CSS + "</style>\n"
    m = re.match(r"\s*<title>[^<]*</title>\n?", html)
    at = m.end() if m else 0
    html = html[:at] + inject + html[at:]
    put("index.html", html)

    # ---- 5. manifest + publish batches ----
    assets = sorted((p, files[p]) for p in files if p != "index.html")
    total = sum(os.path.getsize(f) for _, f in assets)
    page_size = os.path.getsize(files["index.html"])
    batches, cur, cs = [], {}, 0
    for p, f in sorted(assets, key=lambda x: (not x[0].startswith(("ad/", "data/", "species/", "vendor/", "app/", "christmas/")), x[0])):
        s = os.path.getsize(f)
        if cur and (len(cur) >= 250 or cs + s > 60_000_000):
            batches.append(cur); cur, cs = {}, 0
        cur[p] = f; cs += s
    if cur:
        batches.append(cur)
    os.makedirs(os.path.join(out, "publish"), exist_ok=True)
    bpaths = []
    for i, b in enumerate(batches):
        bp = os.path.join(out, "publish", "batch-%d.json" % (i + 1))
        json.dump(b, open(bp, "w"), indent=1)
        bpaths.append(bp)
    big = [p for p, f in assets if os.path.getsize(f) > 15_000_000]
    man = {"version": ver, "previews": [p["key"] + (":on" if p["on"] else ":off") for p in previews], "page": files["index.html"], "page_bytes": page_size, "files": len(assets),
           "bytes": total, "batches": bpaths, "sightings_snapshot": cfg["sight"]["date"], "built": time.strftime("%Y-%m-%d %H:%M")}
    json.dump(man, open(os.path.join(out, "publish", "manifest.json"), "w"), indent=1)
    log("  %d supporting files, %.1f MB (+ index.html %.1f MB), %d publish batch(es) - %.0fs" % (len(assets), total / 1e6, page_size / 1e6, len(batches), time.time() - t0))
    assert len(assets) <= 500 and total + page_size <= 250_000_000 and page_size <= 16_000_000 and not big, (len(assets), total, big)
    for bp in bpaths:
        log("  " + bp)
    return man


if __name__ == "__main__" and "--fetch-only" not in sys.argv:
    import argparse
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", required=True)
    ap.add_argument("--christmas", choices=("on", "off"), default="on", help="the Christmas preview's starting state (the viewer can switch it)")
    ap.add_argument("--events", choices=("on", "off"), default="on", help="the events preview's starting state (the viewer can switch it)")
    ap.add_argument("--cache", default=DEFAULT_CACHE)
    ap.add_argument("--offline", action="store_true", help="use only what's in the download cache")
    a = ap.parse_args()
    build(os.path.abspath(a.out), christmas_default=a.christmas == "on", events_default=a.events == "on", cache=a.cache, offline=a.offline)


if __name__ == "__main__" and "--fetch-only" in sys.argv:
    src = open(os.path.join(ROOT, "snakelist-synced.html"), encoding="utf-8").read()
    ids = re.findall(r'<div class="card" data-id="([^"]+)"', src)
    cache = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else DEFAULT_CACHE
    lg = lambda m: print(m, file=sys.stderr, flush=True)
    if "--wiki" in sys.argv:
        w = fetch_wiki(cache, [s for _, s in app_species(src)], log=lg)
        print("DONE wiki", len(w), file=sys.stderr)
    else:
        tx, ob = fetch_inat(cache, ids, log=lg)
        print("DONE", len(tx), len(ob), file=sys.stderr)
