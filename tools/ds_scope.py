"""Scope CSS under one class on <html> (used for the "design" preview on the generated pages).

scope(css, root="html.sl-pv-design") puts every selector under that root:
  :root / html  -> html.sl-pv-design            (html[data-x] -> html.sl-pv-design[data-x])
  [data-sl-theme=..] (an attribute of <html>) -> html.sl-pv-design[data-sl-theme=..]
  anything else -> html.sl-pv-design <selector>
@media / @supports blocks are scoped inside; @keyframes, @font-face and @import are kept as they are.
rules(css) lists the rules as (context, selector, body) - diff(old, new) gives the rules of `new` that `old`
does not have (the same selector with a different body, or a new selector), so only what changed is scoped.
Only for SnakeList's own CSS: no comments inside selectors, no nested braces other than @media/@supports.
"""
import re


def _strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _blocks(css):
    """yield (prelude, body) for each top-level block; body is the text inside the braces"""
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            # a trailing @import / @charset without braces
            rest = css[i:].strip()
            if rest:
                for stmt in rest.split(";"):
                    if stmt.strip():
                        yield stmt.strip() + ";", None
            return
        pre = css[i:j]
        # statements ending in ";" before this block (e.g. @import)
        while ";" in pre and pre.strip().startswith("@") and not pre.strip().startswith(("@media", "@supports", "@keyframes", "@font-face", "@-webkit-keyframes", "@page", "@layer", "@container")):
            k = pre.index(";")
            yield pre[:k + 1].strip(), None
            pre = pre[k + 1:]
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{": depth += 1
            elif css[k] == "}": depth -= 1
            k += 1
        yield pre.strip(), css[j + 1:k - 1]
        i = k


def rules(css, ctx=""):
    out = []
    for pre, body in _blocks(_strip_comments(css)):
        if body is None:
            out.append((ctx, pre, None)); continue
        if pre.startswith(("@media", "@supports", "@container", "@layer")):
            out.extend(rules(body, (ctx + " " if ctx else "") + re.sub(r"\s+", " ", pre)))
        else:
            out.append((ctx, re.sub(r"\s+", " ", pre), body.strip()))
    return out


def _split_sel(sel):
    parts, depth, cur = [], 0, ""
    for ch in sel:
        if ch in "([": depth += 1
        elif ch in ")]": depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur); cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def _scope_one(s, root):
    if s.startswith(":root"):
        return root + s[5:]
    m = re.match(r"html(?![\w-])", s)
    if m:
        return root + s[4:]
    if s.startswith("[data-sl-theme"):
        return root + s
    return root + " " + s


def scope_rules(rs, root="html.sl-pv-design"):
    out, last_ctx = [], None
    by_ctx = []
    for ctx, sel, body in rs:
        if body is None:
            continue  # @import etc. are not scoped (they can't be)
        if sel.startswith(("@keyframes", "@-webkit-keyframes", "@font-face", "@page")):
            line = sel + "{" + body + "}"
        else:
            line = ",".join(_scope_one(s, root) for s in _split_sel(sel)) + "{" + body + "}"
        if by_ctx and by_ctx[-1][0] == ctx:
            by_ctx[-1][1].append(line)
        else:
            by_ctx.append((ctx, [line]))
    for ctx, lines in by_ctx:
        if not ctx:
            out.extend(lines)
        else:
            # nested contexts were joined with " " - re-open each level
            levels = re.findall(r"@(?:media|supports|container|layer)[^@]*", ctx)
            out.append("".join(l.strip() + "{" for l in levels) + "".join(lines) + "}" * len(levels))
    return "\n".join(out) + ("\n" if out else "")


def scope(css, root="html.sl-pv-design"):
    return scope_rules(rules(css), root)


def diff(old, new):
    have = set((c, s, b) for c, s, b in rules(old))
    return [r for r in rules(new) if r not in have]


# the line every generated page has in its <head>, right after its stylesheet: with the design preview on in this browser
# (localStorage sl-art-preview-design = "1", set by Settings > Previews in the app) it puts the class sl-pv-design on <html>
# before anything is drawn, and loads Inter and Fraunces. Without it nothing happens. (No braces and no percent signs:
# the page templates are filled with .format() and with %.)
DS_HEAD = ('<script>if(window.localStorage&&localStorage.getItem("sl-art-preview-design")==="1")document.documentElement.className+=" sl-pv-design",'
           'document.head.insertAdjacentHTML("beforeend","<link rel=stylesheet href=\'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700'
           '&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap\'>")</script>')
