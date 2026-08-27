#!/usr/bin/env python3
"""Build the field manual from the mod itself.

Every fact on the page is read out of the source rather than typed twice:
names from the lang file, descriptions from each item's javadoc, recipes from
the recipe JSON, icons from the PNGs the icon scripts draw. The only thing
written by hand is which section an item belongs in, and verify.py refuses any
item missing from that table — so an item cannot ship undocumented.
"""
import base64
import html
import json
import re
from pathlib import Path

import manual_data as M

ROOT = Path(__file__).parent
LANG = json.loads((ROOT / "src/main/resources/assets/orbital/lang/en_us.json").read_text())
ITEMS_DIR = ROOT / "src/main/java/com/orbital/arsenal/items"
ART = ROOT / "src/main/resources/assets/orbital/textures/item"
RECIPES = ROOT / "src/main/resources/data/orbital/recipe"

# Symbols in a recipe grid are letters, not textures — this mod does not ship
# Minecraft's own art and should not pretend to. A tint per material keeps the
# grids readable at a glance without claiming to be something they are not.
TINTS = [
    (("iron", "anvil", "rail", "bucket", "shears"), "#aeb6c4"),
    (("gold", "glowstone", "torch", "blaze"), "#f0c356"),
    (("diamond", "prismarine", "heart_of_the_sea"), "#79d8d0"),
    (("obsidian", "ender", "amethyst", "shulker"), "#8f6fd0"),
    (("log", "planks", "stick", "wood"), "#a97b4a"),
    (("stone", "cobble", "deepslate", "gravel", "flint"), "#8d919b"),
    (("redstone", "lava", "magma", "netherrack", "fire"), "#d2543c"),
    (("glass", "ice", "snow", "packed"), "#8fcfe8"),
    (("grass", "dirt", "wheat", "seeds", "leaves", "sapling"), "#79a355"),
    (("sand", "sandstone"), "#dcc98c"),
    (("wool", "feather", "string", "paper", "bone"), "#dcdfe6"),
    (("water", "lapis", "copper"), "#5b9bd4"),
    (("tnt", "gunpowder", "ink"), "#3f4552"),
]


def tint(ingredient):
    for words, colour in TINTS:
        if any(w in ingredient for w in words):
            return colour
    return "#6d7686"


def pretty(ingredient):
    return ingredient.split(":")[-1].replace("_", " ").title()


def icon(item_id):
    png = ART / f"{item_id}.png"
    if not png.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(png.read_bytes()).decode()


def blurb(cls_name):
    """The javadoc above the class, unwrapped. It is the description the item
    was written with, so the manual and the code cannot disagree."""
    src = (ITEMS_DIR / f"{cls_name}.java").read_text()
    match = re.search(r"/\*\*(.*?)\*/\s*public class", src, re.S)
    if not match:
        return ""
    text = " ".join(line.strip().lstrip("*").strip() for line in match.group(1).split("\n"))
    # Only the first paragraph: the rest of these comments explain the code,
    # which is not what a player needs.
    return re.split(r"\s{2,}", text.strip())[0].strip()


def recipe(item_id):
    path = RECIPES / f"{item_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    # Ten of the recipes name their ingredient as a bare string rather than
    # an {"item": ...} object. Both are valid; the reader has to take both.
    key = {k: (v["item"] if isinstance(v, dict) else v) for k, v in data["key"].items()}
    return data["pattern"], key


def registered():
    """Every id and the class behind it.

    Not every registration is `Cls::new` — the four rewind clocks share one
    class and differ by a constructor argument, so they register through a
    lambda. Matching only the method-reference form quietly dropped all four
    from the manual, which is exactly the failure this file exists to prevent.
    """
    mod = (ROOT / "src/main/java/com/orbital/arsenal/ModItems.java").read_text()
    found = []
    for match in re.finditer(r'register\(\s*"(\w+)",(.{0,160}?)\);', mod, re.S):
        cls = re.search(r"(\w+Item)\b", match.group(2))
        if cls:
            found.append((match.group(1), cls.group(1)))
    ids = {i for i, _ in found}
    declared = {k.split(".")[-1] for k in LANG if k.startswith("item.orbital.")}
    assert ids == declared, f"manual would miss {sorted(declared - ids)}"
    return found


def grid_html(item_id):
    made = recipe(item_id)
    if not made:
        return '<div class="norecipe">No recipe</div>'
    pattern, key = made
    rows = [row.ljust(3)[:3] for row in (list(pattern) + ["   ", "   ", "   "])[:3]]
    cells = []
    for row in rows:
        for ch in row:
            if ch == " ":
                cells.append('<i class="cell"></i>')
            else:
                name = html.escape(pretty(key[ch]))
                cells.append(f'<i class="cell on" style="--tint:{tint(key[ch])}" '
                             f'title="{name}">{html.escape(ch)}</i>')
    legend = " · ".join(f"<b>{html.escape(k)}</b> {html.escape(pretty(v))}"
                        for k, v in sorted(key.items()))
    return (f'<div class="craft"><div class="grid">{"".join(cells)}</div>'
            f'<p class="legend">{legend}</p></div>')


def item_html(item_id, cls_name):
    art = icon(item_id)
    img = (f'<img class="icon" src="{art}" alt="" width="32" height="32">'
           if art else '<span class="icon"></span>')
    return f'''<article class="item" data-find="{html.escape(item_id.replace("_", " "))} {
        html.escape(LANG["item.orbital." + item_id].lower())}">
  <header>{img}<div><h3>{html.escape(LANG["item.orbital." + item_id])}</h3>
  <code>orbital:{item_id}</code></div></header>
  <p class="what">{html.escape(M.NOTES.get(item_id) or blurb(cls_name))}</p>
  {grid_html(item_id)}
</article>'''


def build():
    by_id = dict(registered())
    counts = {}
    sections = []
    for key, title, standfirst in M.SECTIONS:
        ids = sorted(i for i in by_id if M.CATEGORY[i] == key)
        counts[key] = len(ids)
        cards = "\n".join(item_html(i, by_id[i]) for i in ids)
        sections.append(f'''<section id="{key}">
  <div class="shead"><h2>{html.escape(title)}</h2><span class="tally">{len(ids)}</span></div>
  <p class="stand">{html.escape(standfirst)}</p>
  <div class="items">{cards}</div>
</section>''')

    mobs = "\n".join(f'''<article class="mob">
  <img class="icon" src="{icon(summon)}" alt="" width="32" height="32">
  <div><h3>{html.escape(name)}</h3>
  <p>{html.escape(note)}</p>
  <p class="via">Called with <b>{html.escape(LANG["item.orbital." + summon])}</b></p></div>
</article>''' for _, name, summon, note in M.MOBS)

    rail = "\n".join(
        f'<a href="#{k}"><span>{html.escape(t)}</span><em>{counts[k]}</em></a>'
        for k, t, _ in M.SECTIONS)

    total = sum(counts.values())
    page = TEMPLATE.format(total=total, mobcount=len(M.MOBS), rail=rail,
                           sections="\n".join(sections), mobs=mobs,
                           sculptures=counts["sculptures"])
    out = ROOT / "manual.html"
    out.write_text(page)
    print(f"wrote {out} — {total} items, {len(M.MOBS)} mobs, {len(page) // 1024} KB")


TEMPLATE = r'''<title>Orbital Arsenal Field Manual</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root {{
  --ground:#eaedf3; --surface:#ffffff; --sunk:#dfe3ec; --line:#c8cedb;
  --ink:#191e27; --muted:#5d687d; --faint:#828ea3;
  --accent:#d0521f; --signal:#1f7f9e; --warn:#a2740c;
  /* The recipe tints are fixed material colours, the same in both
     themes, so the ink on them is fixed too rather than tokenised
     per theme — dark text on a gold swatch reads either way. */
  --on-tint:#10141a;
  --shadow:0 1px 2px rgba(25,30,39,.07), 0 6px 18px rgba(25,30,39,.06);
  --step:clamp(.5rem,.4rem + .4vw,.85rem);
}}
:root:not([data-theme="light"]) {{ color-scheme:light dark; }}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --ground:#12161d; --surface:#1a202a; --sunk:#0d1116; --line:#2b3442;
    --ink:#dce2ec; --muted:#8b97ab; --faint:#6b7688;
    --accent:#ee6830; --signal:#7ed8f4; --warn:#ffd66c;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3);
  }}
}}
:root[data-theme="dark"] {{
  --ground:#12161d; --surface:#1a202a; --sunk:#0d1116; --line:#2b3442;
  --ink:#dce2ec; --muted:#8b97ab; --faint:#6b7688;
  --accent:#ee6830; --signal:#7ed8f4; --warn:#ffd66c;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3);
}}
* {{ box-sizing:border-box; }}
body {{
  margin:0; background:var(--ground); color:var(--ink);
  font:400 16px/1.6 "IBM Plex Sans", system-ui, sans-serif;
  -webkit-font-smoothing:antialiased;
}}
h1,h2,h3 {{ font-family:"Chakra Petch", "IBM Plex Sans", system-ui, sans-serif; text-wrap:balance; margin:0; }}
code, .grid, .legend b, .tally, em {{ font-family:"IBM Plex Mono", ui-monospace, monospace; }}
a {{ color:inherit; }}
:focus-visible {{ outline:2px solid var(--accent); outline-offset:3px; border-radius:3px; }}

/* ---- masthead ------------------------------------------------------- */
.top {{ border-bottom:1px solid var(--line); background:var(--surface); }}
.top .in {{ max-width:1180px; margin:0 auto; padding:3.2rem 1.5rem 2.4rem; }}
.eyebrow {{
  font-family:"IBM Plex Mono", monospace; font-size:.72rem; letter-spacing:.18em;
  text-transform:uppercase; color:var(--accent); margin:0 0 .9rem;
}}
h1 {{ font-size:clamp(2.1rem,1.3rem + 3.4vw,3.4rem); font-weight:700; letter-spacing:-.015em; line-height:1.05; }}
.lede {{ max-width:60ch; color:var(--muted); font-size:1.05rem; margin:.9rem 0 0; }}
.counts {{ display:flex; flex-wrap:wrap; gap:1.6rem; margin-top:1.8rem; }}
.counts div {{ display:flex; flex-direction:column; }}
.counts b {{ font-family:"Chakra Petch",sans-serif; font-size:1.9rem; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; }}
.counts span {{ font-size:.75rem; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin-top:.35rem; }}

/* ---- start-here ----------------------------------------------------- */
.start {{ max-width:1180px; margin:0 auto; padding:2.4rem 1.5rem 0; }}
.notes {{ display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); }}
.note {{
  background:var(--surface); border:1px solid var(--line); border-radius:4px;
  padding:1.1rem 1.2rem; box-shadow:var(--shadow);
}}
.note h3 {{ font-size:.95rem; letter-spacing:.02em; margin-bottom:.4rem; }}
.note p {{ margin:0; font-size:.9rem; color:var(--muted); }}
.note code {{ background:var(--sunk); padding:.1em .35em; border-radius:3px; font-size:.85em; color:var(--ink); }}

/* ---- layout --------------------------------------------------------- */
.body {{ max-width:1180px; margin:0 auto; padding:2.4rem 1.5rem 5rem; display:grid; gap:2.4rem; grid-template-columns:190px 1fr; align-items:start; }}
@media (max-width:820px) {{ .body {{ grid-template-columns:1fr; }} nav {{ position:static !important; }} }}
nav {{ position:sticky; top:1rem; display:flex; flex-direction:column; gap:.15rem; }}
nav a {{
  display:flex; justify-content:space-between; align-items:baseline; gap:.6rem;
  padding:.42rem .6rem; border-radius:3px; text-decoration:none;
  font-size:.88rem; color:var(--muted); border-left:2px solid transparent;
}}
nav a:hover {{ background:var(--surface); color:var(--ink); border-left-color:var(--accent); }}
nav em {{ font-style:normal; font-size:.75rem; color:var(--faint); font-variant-numeric:tabular-nums; }}
.find {{ margin-bottom:1rem; }}
.find input {{
  width:100%; padding:.6rem .8rem; font:inherit; font-size:.9rem;
  background:var(--surface); color:var(--ink);
  border:1px solid var(--line); border-radius:3px;
}}
.find input::placeholder {{ color:var(--faint); }}

/* ---- sections ------------------------------------------------------- */
section {{ scroll-margin-top:1rem; margin-bottom:3rem; }}
.shead {{ display:flex; align-items:baseline; gap:.7rem; border-bottom:2px solid var(--accent); padding-bottom:.4rem; }}
.shead h2 {{ font-size:1.45rem; font-weight:600; letter-spacing:-.01em; }}
.tally {{ font-size:.78rem; color:var(--faint); font-variant-numeric:tabular-nums; }}
.stand {{ color:var(--muted); font-size:.92rem; margin:.7rem 0 1.2rem; max-width:64ch; }}
.items {{ display:grid; gap:.9rem; grid-template-columns:repeat(auto-fill,minmax(268px,1fr)); }}

/* ---- item card ------------------------------------------------------ */
.item {{
  background:var(--surface); border:1px solid var(--line); border-radius:4px;
  padding:.95rem 1rem 1rem; display:flex; flex-direction:column; gap:.6rem;
  box-shadow:var(--shadow);
}}
.item header {{ display:flex; gap:.7rem; align-items:center; }}
.icon {{
  width:32px; height:32px; flex:none; image-rendering:pixelated;
  background:var(--sunk); border-radius:3px; padding:1px;
}}
.item h3 {{ font-size:1rem; font-weight:600; letter-spacing:-.005em; }}
.item code {{ font-size:.7rem; color:var(--faint); }}
.what {{ margin:0; font-size:.87rem; color:var(--muted); flex:1; }}
.craft {{ display:flex; gap:.7rem; align-items:flex-start; border-top:1px solid var(--line); padding-top:.7rem; }}
.grid {{
  display:grid; grid-template-columns:repeat(3,18px); grid-auto-rows:18px;
  gap:2px; flex:none; padding:3px; background:var(--sunk); border-radius:3px;
}}
.cell {{ background:var(--ground); border-radius:2px; }}
.cell.on {{
  background:var(--tint); color:var(--on-tint); font-style:normal;
  font-size:.62rem; font-weight:600; display:grid; place-items:center;
  /* A hairline, because the palest tints — wool, bone, paper — sit on a
     white card in light mode and disappear without one. */
  box-shadow:inset 0 0 0 1px rgba(16,20,26,.18);
}}
.legend {{ margin:0; font-size:.68rem; line-height:1.5; color:var(--faint); }}
.legend b {{ color:var(--muted); font-weight:600; }}
.norecipe {{ font-size:.75rem; color:var(--faint); border-top:1px solid var(--line); padding-top:.7rem; }}

/* ---- mobs ----------------------------------------------------------- */
.mob {{
  display:flex; gap:.9rem; background:var(--surface); border:1px solid var(--line);
  border-radius:4px; padding:1rem; box-shadow:var(--shadow);
}}
.mob h3 {{ font-size:1.05rem; font-weight:600; }}
.mob p {{ margin:.3rem 0 0; font-size:.88rem; color:var(--muted); }}
.via {{ font-size:.78rem !important; color:var(--faint) !important; }}
.via b {{ color:var(--muted); font-weight:600; }}
.empty {{ display:none; color:var(--faint); font-size:.9rem; }}
.searching section:not(:has(.item:not([hidden]))) {{ display:none; }}
</style>

<header class="top"><div class="in">
  <p class="eyebrow">Orbital Arsenal · Fabric · Minecraft 1.21.11</p>
  <h1>Everything in the mod, and how to use it</h1>
  <p class="lede">One hundred and fifty items and eight creatures. Most of them
  break the world; a fair number put it back. Every recipe below is the one the
  mod actually ships — this page is generated from the mod's own files, so it
  cannot drift from what is in the jar.</p>
  <div class="counts">
    <div><b>{total}</b><span>Items</span></div>
    <div><b>{mobcount}</b><span>Creatures</span></div>
    <div><b>{sculptures}</b><span>Sculptures</span></div>
  </div>
</div></header>

<div class="start"><div class="notes">
  <div class="note"><h3>Finding them</h3><p>They are all in one creative tab
  called <b>Orbital Arsenal</b>. In survival, craft them — every recipe is below.</p></div>
  <div class="note"><h3>Using them</h3><p>Hold the item and right-click. Most aim
  where you are looking, up to about a hundred blocks. Nearly all have a cooldown,
  so nothing can be spammed.</p></div>
  <div class="note"><h3>Undoing them</h3><p>Every block this mod changes is
  recorded. A <b>Rewind Clock</b> puts the last thirty seconds back; the longer
  clocks go further, and the <b>Genesis Clock</b> goes back to the start.</p></div>
  <div class="note"><h3>Building by command</h3><p><code>/build</code> lists what
  it can raise — house, tower, castle, bridge, dome, pyramid, wall. It goes up
  where you stand, and the clocks undo it.</p></div>
  <div class="note"><h3>The companion</h3><p><code>/ai spawn</code> calls it,
  <code>/ai &lt;message&gt;</code> talks to it. <code>/ai provider ollama</code>
  points it at a model running on your own machine, so no key is needed.</p></div>
  <div class="note"><h3>A warning</h3><p>Several of these permanently reshape
  hundreds of blocks. Try them somewhere you do not mind losing, or keep a clock
  in your other hand.</p></div>
</div></div>

<div class="body">
  <nav aria-label="Sections">
    <div class="find"><input id="find" type="search" placeholder="Filter items…"
      aria-label="Filter items by name"></div>
    {rail}
  </nav>
  <main>
    {sections}
    <section id="creatures-list">
      <div class="shead"><h2>The creatures themselves</h2><span class="tally">{mobcount}</span></div>
      <p class="stand">Each of these has a model built for it rather than a
      re-skinned vanilla mob — its own proportions, its own animation.</p>
      <div class="items">{mobs}</div>
    </section>
  </main>
</div>

<script>
const find = document.getElementById("find");
const cards = [...document.querySelectorAll(".item")];
find.addEventListener("input", () => {{
  const q = find.value.trim().toLowerCase();
  document.body.classList.toggle("searching", q.length > 0);
  for (const card of cards) {{
    card.hidden = q.length > 0 && !card.dataset.find.includes(q);
  }}
}});
</script>
'''

if __name__ == "__main__":
    build()
