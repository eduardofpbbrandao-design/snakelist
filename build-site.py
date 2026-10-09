"""Build the public website (index.html) from the app (snakelist-synced.html).

The app file is written for the claude.ai viewer, which supplies the page skeleton itself; a
real website needs its own doctype, charset, mobile viewport and the tags search engines and
link previews read. Run after every change:  python3 build-site.py
"""
import re
SITE = "https://eduardofpbbrandao-design.github.io/snakelist/"   # change when the domain is live
app = open("snakelist-synced.html", encoding="utf-8").read()
title = "SnakeList - the snake life list, map and quiz"
desc = ("Track every snake species you've seen. A checklist of 4,000+ snakes with photos, "
        "range maps down to states and provinces, a wishlist and a where-does-it-live quiz.")
head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="{desc}">
<meta name="theme-color" content="#1F5A3A">
<link rel="canonical" href="{SITE}">
<link rel="icon" type="image/png" href="brand/snakelist-icon.png">
<link rel="apple-touch-icon" href="brand/snakelist-icon.png">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{SITE}">
<meta property="og:image" content="{SITE}snakelist-logo.png">
<meta name="twitter:card" content="summary_large_image">
<style>html,body{{margin:0;padding:0}}</style>
"""
app = re.sub(r"^<title>[^<]*</title>", f"<title>{title}</title>", app, count=1)
open("index.html", "w", encoding="utf-8").write(head + app + "\n</body>\n</html>\n")
open("robots.txt", "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n")
open("sitemap.xml", "w").write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>{SITE}</loc></url>\n</urlset>\n')
print("built index.html")
