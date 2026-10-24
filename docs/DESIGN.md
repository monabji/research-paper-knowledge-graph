# DESIGN.md — "Terminal ASCII" UI system

A complete, project-independent design system for web interfaces that look and behave like a **retro text
terminal**: one monospace font, panels framed with box-drawing characters, controls drawn with brackets,
animated ASCII art, and split-flap displays. It works for any kind of site — a dashboard, a shop, a blog, a
portfolio, a booking tool, an admin panel, a game page.

> **To the AI reading this:** use this document as the design system for the site you are building, whatever
> the site is about. Keep every rule unless the user asks otherwise. The CSS, JavaScript and HTML in this file
> are a working reference implementation: copy them, rename classes if you like, and fill them with the
> user's own content. When you need details on the ASCII art library, read the links in [§ 14](#14-links),
> starting with `https://ascii.rest/llms-full.txt`.

---

## Contents

1. [The idea](#1-the-idea)
2. [Principles](#2-principles)
3. [Design tokens](#3-design-tokens)
4. [Typography and the character grid](#4-typography-and-the-character-grid)
5. [Layout](#5-layout)
6. [The framed panel](#6-the-framed-panel)
7. [Components](#7-components)
8. [ASCII art and banners (ascii.rest)](#8-ascii-art-and-banners-asciirest)
9. [Motion](#9-motion)
10. [Writing](#10-writing)
11. [Responsive behaviour](#11-responsive-behaviour)
12. [Accessibility](#12-accessibility)
13. [Pitfalls and their fixes](#13-pitfalls-and-their-fixes)
14. [Links](#14-links)
15. [Starter page](#15-starter-page)
16. [Checklist](#16-checklist)

---

## 1. The idea

Everything on screen looks like output from a terminal program such as `htop` or a text-mode settings form:
a near-black background, light grey monospace text, one warm accent colour, and all structure drawn with
characters instead of CSS boxes.

```
 site  1 home  2 projects  3 status  4 about                              ← tab bar
╭─ new project ─────────────────────────────────────────────────────╮
│ > name        [ weather station                              ]    │    ← form row with cursor
│   visibility  (*) public   ( ) private                            │    ← radio buttons
│   tags        [x] hardware   [ ] web                              │    ← checkboxes
│   progress    ━━━━━━━━━━━━━━━█──────────────   48%                │    ← bar
│                                     [ cancel ]   [  create  ]     │    ← buttons
╰────────────────────────────────────────── tab next · enter save ─╯    ← frame with title and hint
```

Animated ASCII art (a turning globe, a scene, a scrolling LED sign, block-letter banners with a moving glint)
gives the page life. The result must feel **consistent**: no element may look like an ordinary web component —
no rounded CSS cards, no drop shadows, no gradient buttons, no sans-serif text, no default browser widgets.

---

## 2. Principles

1. **One font, one grid.** Every character uses the same monospace font, so everything lines up in columns.
   Size things in `ch` (character widths) and in lines (`var(--line)`), not in arbitrary pixels.
2. **Draw with characters.** Borders, dividers, buttons, checkboxes, radios, bars, grids and status markers are
   text. CSS borders are not used for structure.
3. **Dark, quiet, one accent.** Near-black background, grey text, and one accent colour (amber) for the single
   most important thing in each area: the active tab, the primary button, the key number, the selection.
   Green means good, red means bad; amber doubles as "notable / warning".
4. **Real content, not filler.** No slogans, taglines or marketing sentences. Show labels, values, counts,
   states and instructions. If a line does not help the user understand or act, remove it.
5. **Lowercase interface voice.** Labels, panel titles, tabs and buttons are lowercase (`save changes`,
   `new project`). Proper nouns keep their capitals; codes and IDs stay uppercase.
6. **Motion means "live".** Animation shows that something is running or changing (a flipping board, a
   scrolling sign, a glint on a banner, a spinner). It never blocks reading and it stops for users who prefer
   reduced motion.
7. **Frames fit content.** Panels are drawn to their real size and redraw whenever they resize.

---

## 3. Design tokens

```css
:root {
  --bg:    #0c0c0c;   /* page background */
  --fg:    #cfcfcf;   /* body text, values */
  --dim:   #6e6e6e;   /* labels, secondary text, inactive tabs, hints */
  --faint: #3a3a3a;   /* frame lines, rules, placeholders, disabled cells */
  --hover: #1a1a1a;   /* row hover background */

  --accent: #f5a623;  /* amber: active tab, primary action, key numbers, selection, warnings */
  --good:   #4ade80;  /* success, confirmed, online, done */
  --bad:    #f87171;  /* errors, failed, cancelled, destructive actions */
  --info:   #60a5fa;  /* optional fourth status colour (e.g. "in progress"), use sparingly */

  --mono: "JBM", ui-monospace, Menlo, Consolas, monospace;
  --lh:   1.25;                    /* line height of everything */
  --line: calc(var(--lh) * 1em);   /* one text line: the vertical spacing unit */
}
```

| Token | Use it for | Do not use it for |
|---|---|---|
| `--bg` | the page; backgrounds of dropdowns that cover content | panel fills (panels are transparent; only their frame is drawn) |
| `--fg` | body text, values, panel titles | labels |
| `--dim` | labels (`name`, `status`), hints, inactive tabs, secondary facts | anything the user must read first |
| `--faint` | frame lines, `──` rules, placeholders, disabled items | readable text |
| `--accent` | one thing per area: active tab, primary button, key figure, selected item, the `>` cursor, warnings | decoration |
| `--good` | positive states and success frames | buttons |
| `--bad` | errors, negative states, destructive buttons | anything else |

**Inverted state** (hover, keyboard focus, selected option, active tab): accent background with **black**
(`#000`) text.

**Gradients appear only inside pixel banners** (§ 8): accent → coral `#f5a623,#ff6a3d` for headings,
`#4ade80,#22c55e` for success. You may swap amber for another accent (cyan `#22d3ee`, lime `#a3e635`,
pink `#f472b6`) — keep exactly one.

---

## 4. Typography and the character grid

**Font: JetBrains Mono** (regular 400 and bold 700), loaded from the **full** font files. The Google Fonts
build is a subset that leaves out the box-drawing characters (`╭ ─ │ ╮ ╰ ╯`); the browser then borrows those
glyphs from another font with a different width, and every frame breaks.

```css
@font-face { font-family: "JBM"; font-weight: 400; font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/fonts/webfonts/JetBrainsMono-Regular.woff2") format("woff2"); }
@font-face { font-family: "JBM"; font-weight: 700; font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/fonts/webfonts/JetBrainsMono-Bold.woff2") format("woff2"); }

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); }
body { font: 14px/var(--lh) var(--mono); }
a { color: inherit; text-decoration: none; }
a:hover { color: var(--accent); }
::selection { background: var(--accent); color: #000; }
[hidden] { display: none !important; }
.dim { color: var(--dim); } .accent { color: var(--accent); } .good { color: var(--good); } .bad { color: var(--bad); }
```

| Role | Size | Weight | Colour |
|---|---|---|---|
| Body, labels, tables, buttons | 14 px | 400 | `--fg` / `--dim` |
| Brand word in the top bar | 14 px | 700 | `--accent` |
| Key figures (prices, totals, times, scores) | 22 px (18 px on phones) | 700 | `--fg` or `--accent` |
| Spaced subtitle under a big banner | 14 px, uppercase, `letter-spacing: .3em` | 400 | `--dim` |
| Page and section headings | **not text**: a pixel banner (`<ascii-banner>`, § 8) | — | gradient |

- Two weights only. Bold for the brand, key figures and the identifying value in a row — never whole sentences.
- No italics.
- Horizontal spacing in `ch` (`2ch`, `3ch`, label column `11ch`), vertical spacing in `var(--line)` or half of it.

---

## 5. Layout

```css
.page   { max-width: 1240px; margin: 0 auto; padding: 0 16px; }
.grid   { display: grid; gap: var(--line) 2ch; margin-bottom: var(--line); }
.stack  { display: grid; gap: var(--line); align-content: start; }
.center { display: flex; justify-content: center; overflow: hidden; }
.g-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.g-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.spaced { margin-bottom: var(--line); }
```

- Always `minmax(0, 1fr)`, never plain `1fr`: ASCII art and long lines would otherwise stretch columns past the screen.
- **Top bar:** the brand word on the left, then the tab bar. Nothing else.
- **Tabs, not pages, for the main sections** of an app-like site: each section is `<section data-tab="…">`,
  only one is visible, the URL hash selects it, number keys switch (§ 7.1). Content sites can use normal pages
  with the same top bar.
- **Landing / home:** two columns — a large animated piece on one side (globe, scene, rotating shape), and on
  the other a pixel banner with the site name, a spaced uppercase subtitle and at most one compact panel (a
  search, a sign-up, a quick action). Nothing else on the landing view.
- **Inside a section:** framed panels in grids; groups separated by a section rule (§ 7.3).
- **No footer copy** (no repeated tagline, no "made with" line). Credits belong in the README or an about page.

---

## 6. The framed panel

The core building block. Any element with class `tui` gets a frame of box-drawing characters drawn to its
exact size, an optional **title in the top edge** (`data-title`) and an optional **hint in the bottom edge**
(`data-foot`).

```html
<section class="tui hot" data-title="new project" data-foot="tab next · enter save"> … </section>
```

```css
.tui { position: relative; display: block; padding: var(--line) 2ch; overflow: hidden; }
.tui > .edge { position: absolute; inset: 0 auto auto 0; margin: 0; font: inherit; color: var(--faint);
  pointer-events: none; white-space: pre; user-select: none; }
.tui > .edge b { color: var(--fg); font-weight: 400; }     /* title */
.tui > .edge i { color: var(--dim); font-style: normal; }  /* bottom hint */
.tui.hot > .edge { color: var(--dim); }                    /* interactive panel: forms, results */
.tui.ok  > .edge { color: var(--good); }                   /* success: confirmation, receipt */
.tui.err > .edge { color: var(--bad); }                    /* failure panel */
.tui.pick:hover > .edge, .tui.pick.on > .edge { color: var(--accent); }   /* clickable / selected panel */
```

Drawing script — measures one character, computes the columns and rows that fit, writes the frame into a
`<pre class="edge">`, snaps the panel height to whole lines, and redraws on resize and after the font loads:

```js
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const TUI = (() => {
  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(100);
  probe.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;white-space:pre;font:inherit';
  let CW = 8.4, LH = 17.5;                                  // character width and line height in px
  const metrics = () => { const r = probe.getBoundingClientRect(); if (r.width) { CW = r.width / 100; LH = r.height; } };

  function draw(el) {
    if (el.hidden || !el.isConnected) return;
    let edge = el.querySelector(':scope > .edge');
    if (!edge) { edge = document.createElement('pre'); edge.className = 'edge'; edge.setAttribute('aria-hidden', 'true'); el.prepend(edge); }
    edge.textContent = '';
    el.style.minHeight = '';
    const cols = Math.max(8, Math.floor(el.clientWidth / CW));
    const rows = Math.max(3, Math.ceil(el.scrollHeight / LH - 0.05));
    el.style.minHeight = rows * LH + 'px';
    const room = cols - 6;
    const t = (el.dataset.title || '').slice(0, room), f = (el.dataset.foot || '').slice(0, Math.max(0, room - t.length - 4));
    const title = t ? `─ <b>${esc(t)}</b> ` : '', tLen = t ? t.length + 3 : 0;
    const foot  = f ? ` <i>${esc(f)}</i> ─` : '', fLen = f ? f.length + 3 : 0;
    const top = '╭' + title + '─'.repeat(Math.max(0, cols - 2 - tLen)) + '╮';
    const mid = '│' + ' '.repeat(cols - 2) + '│';
    const bot = '╰' + '─'.repeat(Math.max(0, cols - 2 - fLen)) + foot + '╯';
    edge.innerHTML = [top, ...Array(rows - 2).fill(mid), bot].join('\n');
  }

  let busy = false;
  const ro = new ResizeObserver(entries => {               // guard against resize feedback loops
    if (busy) return; busy = true;
    entries.forEach(e => draw(e.target));
    requestAnimationFrame(() => { busy = false; });
  });
  function watch(root = document) {
    root.querySelectorAll('.tui').forEach(el => { if (!el.dataset.framed) { el.dataset.framed = '1'; ro.observe(el); } draw(el); });
  }
  function start() {
    document.body.appendChild(probe);
    metrics(); watch();
    document.fonts.ready.then(() => { metrics(); watch(); });
    addEventListener('resize', () => { metrics(); document.querySelectorAll('.tui').forEach(draw); });
  }
  return { draw, watch, start };
})();
document.addEventListener('DOMContentLoaded', () => TUI.start());
```

After inserting new `.tui` elements call `TUI.watch(container)`; after changing a panel's `data-title` or
`data-foot` call `TUI.draw(panel)`. Other frame styles can be drawn the same way by swapping the characters:
`┌─┐└┘` (square), `╔═╗╚╝║` (double), `┏━┓┗┛┃` (heavy).

---

## 7. Components

### 7.1 Tab bar (htop style)

```
brand  1 home  2 projects  3 status  4 about
       └ active tab: accent background, black text; its number box turns black with accent text
```

```html
<header class="top">
  <a class="brand" href="#home">brand</a>
  <nav class="tabs">
    <a href="#home"><kbd>1</kbd>home</a>
    <a href="#projects"><kbd>2</kbd>projects</a>
  </nav>
</header>
<section data-tab="home">…</section>
<section data-tab="projects" hidden>…</section>
```

```css
.top { display: flex; flex-wrap: wrap; gap: 4px 24px; align-items: center; padding: 14px 0; }
.brand { font-weight: 700; color: var(--accent); }
.tabs { display: flex; flex-wrap: wrap; gap: 6px 1ch; flex: 1; }
.tabs a { color: var(--dim); white-space: pre; padding: 0 1ch 0 0; }
.tabs a kbd { font: inherit; background: #1d1d1d; color: var(--fg); padding: 0 1ch; margin-right: 1ch; }
.tabs a:hover { color: var(--fg); }
.tabs a.on { background: var(--accent); color: #000; }
.tabs a.on kbd { background: #000; color: var(--accent); }
```

```js
function startTabs(onShow) {
  const tabs = [...document.querySelectorAll('.tabs a[href^="#"]')];
  const show = () => {
    const id = (location.hash || '#home').slice(1);
    const target = document.querySelector(`section[data-tab="${id}"]`) ? id : 'home';
    document.querySelectorAll('section[data-tab]').forEach(s => { s.hidden = s.dataset.tab !== target; });
    tabs.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + target));
    TUI.watch(document.querySelector(`section[data-tab="${target}"]`));   // frames of the newly visible section
    onShow && onShow(target);
  };
  addEventListener('hashchange', () => { show(); scrollTo(0, 0); });
  addEventListener('keydown', e => {                                     // number keys switch tabs
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const t = tabs[+e.key - 1]; if (t) location.hash = t.getAttribute('href');
  });
  show();
}
```

### 7.2 Buttons

`[ save ]` — the brackets are pseudo-elements; hover and focus invert to accent with black text.

```css
.btn { background: none; border: 0; padding: 0; font: inherit; color: var(--fg); cursor: pointer; white-space: pre; }
.btn::before { content: "[ "; color: var(--dim); } .btn::after { content: " ]"; color: var(--dim); }
.btn:hover, .btn:focus-visible { color: #000; background: var(--accent); outline: none; }
.btn:hover::before, .btn:hover::after, .btn:focus-visible::before, .btn:focus-visible::after { color: #000; }
.btn.primary { color: var(--accent); }     /* at most one per panel */
.btn.danger  { color: var(--bad); }
.btn:disabled { color: var(--dim); cursor: wait; background: none; }
```

- Pad the primary label with spaces for weight: `<button class="btn primary"> save </button>`.
- While working, change the label (` saving… `) and disable the button.
- **Destructive actions confirm in place:** the first press turns `[ delete ]` into `[ yes, delete it ]` and
  shows a dim note "press again to confirm"; the second press acts. Avoid modal dialogs.
- Links that act like buttons can use the same class on an `<a>`.

### 7.3 Section rule

`── 01 · overview ────────────────────────────────`

```html
<div class="rule" data-label="01 · overview"></div>
```
```css
.rule { color: var(--faint); white-space: pre; overflow: hidden; margin: calc(var(--line) * 1.5) 0 var(--line); }
.rule b { color: var(--fg); font-weight: 400; }
```
```js
document.querySelectorAll('.rule[data-label]').forEach(r => {
  r.innerHTML = `── <b>${esc(r.dataset.label)}</b> ` + '─'.repeat(300);   /* overflow: hidden trims it */
});
```

Plain dividers: `─────` (default), `· · · · ·` (soft), `──── · ° · ────` (ornamental, use once per page).

### 7.4 Form rows

A row has three columns: a `>` cursor that appears while the row has focus, a dim label, and the control.

```html
<div class="row"><span class="cur">&gt;</span><label for="name">name</label>
  <span class="field"><input id="name" placeholder="weather station"></span></div>

<div class="row"><span class="cur">&gt;</span><label for="plan">plan</label>
  <span class="field sel"><select id="plan"><option>free</option><option>pro</option></select></span></div>

<div class="row"><span class="cur">&gt;</span><span class="lab">visibility</span>
  <span class="radios">
    <label><input type="radio" name="vis" value="public" checked>public</label>
    <label><input type="radio" name="vis" value="private">private</label>
  </span></div>

<div class="row"><span class="cur">&gt;</span><span class="lab">tags</span>
  <span class="checks">
    <label><input type="checkbox" checked>hardware</label>
    <label><input type="checkbox">web</label>
  </span></div>

<div class="actions"><span class="bad msg" id="err"></span>
  <button class="btn" type="button">cancel</button><button class="btn primary"> save </button></div>
```

```css
.row { display: grid; grid-template-columns: 2ch 11ch minmax(0, 1fr); align-items: center; min-height: calc(var(--line) * 2); }
.row .cur { color: var(--accent); visibility: hidden; }
.row:focus-within .cur { visibility: visible; }
.row label, .row .lab { color: var(--dim); }
.row:focus-within label, .row:focus-within .lab { color: var(--fg); }

.field { display: flex; min-width: 0; position: relative; }
.field::before { content: "[ "; color: var(--dim); white-space: pre; }
.field::after  { content: " ]"; color: var(--dim); white-space: pre; }
.field.sel::after { content: " v ]"; }
.field input, .field select, .field textarea { flex: 1; min-width: 0; appearance: none; -webkit-appearance: none;
  background: none; border: 0; padding: 0; margin: 0; font: inherit; color: var(--fg); outline: none; color-scheme: dark; resize: vertical; }
.field input::placeholder { color: var(--faint); }
.field input::-webkit-calendar-picker-indicator { filter: invert(.6); cursor: pointer; }
.field select option { background: #161616; }

.radios, .checks { display: flex; flex-wrap: wrap; gap: 0 3ch; }
.radios label, .checks label { cursor: pointer; color: var(--dim); white-space: pre; }
.radios input, .checks input { position: absolute; opacity: 0; pointer-events: none; }
.radios label::before { content: "( ) "; }
.radios label:has(input:checked)::before { content: "(*) "; color: var(--accent); }
.checks label::before { content: "[ ] "; }
.checks label:has(input:checked)::before { content: "[x] "; color: var(--accent); }
.radios label:has(input:checked), .checks label:has(input:checked) { color: var(--fg); }
.radios label:has(input:focus-visible), .checks label:has(input:focus-visible) { outline: 1px dotted var(--accent); }

.actions { display: flex; justify-content: flex-end; align-items: center; gap: 3ch; margin-top: var(--line); flex-wrap: wrap; }
.msg { min-height: var(--line); }
```

A toggle can be drawn as `▕██░░░░▏ off` / `▕░░░░██▏ on`; a slider as `━━━━━━━━█───────── 40%` (§ 7.9).

### 7.5 Type-to-search picker (autocomplete)

A text field that opens a framed dropdown of matches. Arrow keys move, Enter picks, the highlighted option is
inverted. The dropdown is itself a `.tui.hot` panel titled `matches` (or `no matches`).

```css
.picker { position: absolute; left: 0; right: 0; top: var(--line); z-index: 20; background: var(--bg); padding: var(--line) 1ch; }
.picker .opt { display: grid; grid-template-columns: 6ch minmax(0, 1fr); gap: 1ch; padding: 0 1ch; cursor: pointer; white-space: nowrap; }
.picker .opt span:last-child { overflow: hidden; text-overflow: ellipsis; color: var(--dim); }
.picker .opt.on, .picker .opt:hover { background: var(--accent); color: #000; }
.picker .opt.on span, .picker .opt:hover span { color: #000; }
.picker .none { color: var(--dim); padding: 0 1ch; }
.tui:has(.picker:not([hidden])) { overflow: visible; z-index: 10; }   /* let it spill out of its panel */
```

```js
function picker(input, items /* [{key, label, detail}] */, onPick) {
  const box = document.createElement('div');
  box.className = 'picker tui hot'; box.hidden = true; box.setAttribute('role', 'listbox');
  input.parentElement.appendChild(box);
  input.setAttribute('autocomplete', 'off'); input.setAttribute('role', 'combobox');
  let list = [], active = 0;
  const score = (it, q) => it.key.toLowerCase() === q ? 0 : it.label.toLowerCase().startsWith(q) ? 1
    : it.key.toLowerCase().startsWith(q) ? 2 : (it.label + ' ' + it.detail).toLowerCase().includes(q) ? 3 : 9;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    list = items.map(it => [score(it, q), it]).filter(([s]) => !q || s < 9).sort((a, b) => a[0] - b[0]).slice(0, 8).map(([, it]) => it);
    active = 0;
    box.dataset.title = list.length ? 'matches' : 'no matches';
    box.innerHTML = list.length
      ? list.map((it, i) => `<div class="opt${i ? '' : ' on'}" role="option" data-i="${i}"><span>${esc(it.key)}</span><span>${esc(it.label)} · ${esc(it.detail)}</span></div>`).join('')
      : '<div class="none">try another word</div>';
    box.hidden = false; TUI.draw(box);
  };
  const pick = it => { input.value = it.label; input.dataset.key = it.key; box.hidden = true; onPick && onPick(it); };
  input.addEventListener('focus', () => { input.select(); render(); });
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      active = Math.max(0, Math.min(list.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      box.querySelectorAll('.opt').forEach((o, i) => o.classList.toggle('on', i === active)); e.preventDefault();
    } else if (e.key === 'Enter' && list[active]) { pick(list[active]); e.preventDefault(); }
    else if (e.key === 'Escape') box.hidden = true;
  });
  box.addEventListener('mousedown', e => { const o = e.target.closest('.opt'); if (o) { pick(list[+o.dataset.i]); e.preventDefault(); } });
  input.addEventListener('blur', () => { box.hidden = true; });
}
```

Pick on `mousedown` (not `click`), otherwise the input's `blur` closes the list before the click lands.

### 7.6 List cards

Each item in a list (a product, project, article, event, search result) is its own framed panel: a media
column on the left, the main body, a right-aligned aside with the key figure and an action, and a row of dim
facts underneath. Tags such as `newest` or `best value` go in the frame's bottom hint.

```
╭─ weather station ─────────────────────────────────────────────────────────────╮
│ ██ ██    rust · esp32                updated 2 days ago            128 ★      │
│ ██▄██    temperature and humidity logger  ─────────────────────▶   stars       │
│ WX-01                                                            [ open ]     │
│          3 contributors   active   mit licence                                │
╰──────────────────────────────────────────────────────────────────── trending ─╯
```

```css
.cards { display: grid; gap: var(--line); }
.tui.card { display: grid; grid-template-columns: 14ch minmax(0, 1fr) 20ch; gap: 0 3ch; align-items: center; cursor: pointer; }
.card:hover > .edge, .card.on > .edge { color: var(--accent); }
.card .media ascii-banner { width: 12ch; }
.card .media .caption { color: var(--dim); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card .big { font-size: 22px; font-weight: 700; line-height: 1.25; }
.card .aside { text-align: right; }
.card .aside .figure { font-size: 22px; font-weight: 700; color: var(--accent); line-height: 1.25; }
.card .aside .unit { color: var(--dim); }
.card .facts { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 0 3ch; color: var(--dim); margin-top: calc(var(--line) / 2); }
.card.off { opacity: .45; cursor: not-allowed; }   /* unavailable; say why in the aside */
/* a text "track" between two values: <div class="track"><span class="dash">────…</span><span class="tip">▶</span></div> */
.track { display: flex; align-items: center; color: var(--faint); }
.track .dash { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; }
.track .tip { color: var(--accent); }
```

- Write the selector as `.tui.card`: `.tui { display: block }` would otherwise override `display: grid`.
- Put a sort control above the list as radios: `sort (*) newest ( ) name ( ) popular`, and sort on the client.
- Small grids of cards (galleries, features, team members) use the same frame with an art piece or banner on
  top and a meta line below (`title` left, key figure right in accent).

### 7.7 Cell grid picker

For choosing cells in a grid (seats, time slots, calendar days, inventory bins, a level map). Each cell is a
bracketed button.

```
      A   B   C       D   E   F
── premium · 2 free ──────────────────
 1   [ ]             [x]
── standard · 18 free ────────────────
 2   [■] [ ] [ ]     [ ] [x] [x]
 3   [x] [x] [ ]     [ ] [ ] [ ]
[ ] free   [x] taken   [■] yours
```

```css
.cell-row { display: grid; grid-template-columns: 3ch repeat(3, 4ch) 2ch repeat(3, 4ch); align-items: center; }
.cell { background: none; border: 0; padding: 0; font: inherit; color: var(--fg); cursor: pointer; white-space: pre; text-align: center; }
.cell:hover, .cell:focus-visible { color: #000; background: var(--accent); outline: none; }
.cell.taken { color: var(--faint); cursor: not-allowed; background: none; }
.cell.on { color: #000; background: var(--accent); }
.group-rule { color: var(--dim); white-space: pre; overflow: hidden; }   /* "── standard · 18 free ─────" */
.group-rule b { color: var(--fg); font-weight: 400; }
.legend { display: flex; flex-wrap: wrap; gap: 0 3ch; color: var(--dim); margin-top: var(--line); }
```

Free `[ ]`, taken `[x]` (faint, `disabled`), selected `[■]` (inverted). When several selections belong to
different people or slots, number them `[1]`, `[2]` and explain in the legend. Every cell is a `<button>` with
an `aria-label`.

### 7.8 Key–value lists and tables

```
name       weather station
status     active
updated    sat, 24 oct 2026 · 13:30
total      1,240
```

```css
.kv  { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0 2ch; }
.kv > :nth-child(odd) { color: var(--dim); }                                   /* keys */
.kv3 { display: grid; grid-template-columns: max-content minmax(0, 1fr) max-content; gap: 0 2ch; }  /* key · bar · value */

.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-weight: 400; color: var(--dim); padding: 0 2ch 0 0; }
.tbl td { padding: 0 2ch 0 0; white-space: nowrap; }
.tbl tr:hover td { background: var(--hover); }
.scroll-x { overflow-x: auto; overflow-y: hidden; }   /* wrap wide tables */
```

Tables have no borders: dim headers, aligned columns, hover rows. Totals and key figures in accent.

### 7.9 Bars, meters and counts

```js
// ━━━━━━━━━━█────────── 50%   (like a slider)
const bar = (pct, width = 20) => { const k = Math.round(pct / 100 * width);
  return `<span class="accent">${'━'.repeat(Math.max(0, k - 1))}█</span><span class="dim">${'─'.repeat(width - k)}</span>`; };
// ■■■■□□□□   (discrete counts)
const dots = (n, max) => '■'.repeat(n) + '□'.repeat(max - n);
// ▁▂▃▅▇▆▄▂   (sparkline)
const spark = values => { const lo = Math.min(...values), hi = Math.max(...values), b = '▁▂▃▄▅▆▇█';
  return values.map(v => b[Math.round((v - lo) / (hi - lo || 1) * 7)]).join(''); };
```

Wrap them in an element with `white-space: pre`. Avoid `░` for empty space: in many fonts it is nearly solid.

### 7.10 Confirmation / receipt panel

A success panel (`.tui.ok`, green frame) with a green pixel banner of the key value — an order number, a
username, a score — typed in with the `type` effect, and a key–value list beside it. Bottom hint: `confirmed`
or `saved`. Below it: one neutral and one primary button (`[ view details ]`, `[ make another ]`).

### 7.11 Split-flap board

A live table (arrivals, scores, prices, build status, leaderboards, schedules) rendered as split-flap tiles:
dark tiles with a black hairline across the middle that riffle through random characters before settling.
The status column is coloured; the tile size is computed so the columns fill the whole width.

```css
.board { overflow: hidden; --tile: 15px; }
.board-row { display: grid; grid-template-columns: repeat(var(--cols, 5), max-content); justify-content: space-between; padding: 3px 0; white-space: nowrap; }
.flap { display: inline-flex; gap: 2px; font-size: var(--tile); }
.flap i { font-style: normal; width: 1.2em; text-align: center; background: #181818; color: #eee; position: relative; line-height: 1.5; }
.flap i::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 1px solid #000; }
.board-row.head .flap i { background: none; color: var(--dim); }
.board-row.head .flap i::after { display: none; }
.st-good .st .flap i { color: var(--good); } .st-warn .st .flap i { color: var(--accent); }
.st-bad  .st .flap i { color: var(--bad);  } .st-info .st .flap i { color: var(--info); }
.st-done .flap i { color: var(--dim); }
```

```js
const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const flap = (text, n) => `<span class="flap">${String(text).toUpperCase().padEnd(n).slice(0, n).split('')
  .map(c => `<i data-c="${esc(c)}">${reduceMotion ? esc(c) : ' '}</i>`).join('')}</span>`;

function spin(tiles) {                     // each tile riffles a few times, then lands on its letter
  if (reduceMotion) return;
  tiles.forEach((t, i) => { t.dataset.n = 4 + Math.floor(Math.random() * 8) + (i % 14); });
  const step = () => { let busy = false;
    tiles.forEach(t => { const n = +t.dataset.n;
      if (n > 0) { t.textContent = FLAP[Math.floor(Math.random() * FLAP.length)]; t.dataset.n = n - 1; busy = true; }
      else t.textContent = t.dataset.c; });
    if (busy) setTimeout(step, 50); };
  step();
}

function fitBoard(board, widths /* characters per column, e.g. [5, 8, 16, 12, 9] */) {
  const tiles = widths.reduce((a, b) => a + b, 0), gaps = (widths.length - 1) * 20;
  const per = (board.clientWidth - gaps) / tiles;                         // px per tile incl. its 2px gap
  board.style.setProperty('--tile', Math.max(8, Math.min(22, (per - 2) / 1.2)) + 'px');
  board.style.setProperty('--cols', widths.length);
}
// Build rows as <div class="board-row st-good"><span>${flap(v1, 5)}</span>…<span class="st">${flap('ON TIME', 9)}</span></div>,
// call fitBoard() then spin() on all tiles; every few seconds re-spin one random status cell, like a real board.
```

### 7.12 Loading, empty and error states

- **Loading:** an accent braille spinner and a dim message: `⠋ loading projects…`
  (frames `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, 80 ms per frame). For bigger waits use the ascii.rest `skeleton` or `progress-bar` pieces.
- **Empty:** one dim sentence saying what happened and what to do: `no projects yet. create one with [ new ].`
- **Error:** the server's own message in red, right under the form or list that caused it. If data went stale
  (a conflict), reload it and say so.
- **404 page:** the ascii.rest `not-found` piece with your own title and message.

```js
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
function spinner(el, text) { let i = 0;
  const t = setInterval(() => { el.innerHTML = `<span class="accent">${SPIN[i++ % SPIN.length]}</span> <span class="dim">${esc(text)}</span>`; }, 80);
  return () => clearInterval(t); }          // call the returned function to stop
```

### 7.13 Text logos and avatars

Instead of image logos, icons or avatars, render a short code (initials, a ticker, a 2–3 letter abbreviation)
as a pixel banner in an identifying colour, with the same glint as other banners:

```js
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const shade = c => hex(...[1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) * 0.72));
function colorFor(code) {                              // stable colour per code: hue from a hash, HSL(h, 65%, 60%)
  let h = 0; for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360;
  const s = 0.65, l = 0.6, a = s * Math.min(l, 1 - l), k = n => (n + h / 30) % 12;
  const f = n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return hex(f(0), f(8), f(4));
}
const textLogo = (code, color = colorFor(code)) =>
  `<ascii-banner text="${esc(code)}" color="${color},${shade(color)}" shadow="rounded" effect="glint" label="${esc(code)}"></ascii-banner>`;
```

Use a fixed table of colours for known brands or people and `colorFor()` for the rest.

### 7.14 Status line and live sign

- A one-line **status** under a panel: `● online · 3 jobs running · last sync 13:30` (the dot in `--good`).
- A **scrolling LED sign** (ascii.rest `marquee`) fed with live text — latest events, prices, scores — in its
  own framed panel, scaled to fill the panel width (§ 8).

---

## 8. ASCII art and banners (ascii.rest)

Animated art comes from **[ascii.rest](https://ascii.rest)**, a free MIT-licensed library of about 240 ASCII
animations ("pieces") plus a block-letter banner generator. One script tag adds two custom elements:

```html
<script type="module" src="https://ascii.rest/ascii.js"></script>

<ascii-art piece="earth"></ascii-art>
<ascii-banner text="SITE" color="#f5a623,#ff6a3d" shadow="rounded"></ascii-banner>
```

**Where to use what**

| Need | Piece / element | Notes |
|---|---|---|
| Site name / page heading | `<ascii-banner text="…" color="#f5a623,#ff6a3d" shadow="rounded">` | glint sweeps across every few seconds; always set `max-width` |
| Success value | `<ascii-banner … color="#4ade80,#22c55e" effect="type">` | letters type in once |
| Landing hero | `earth`, `galaxy`, `solar-system`, `donut`, `torus-knot`, `starfield`, `aurora`, `synthwave` | large, beside the title |
| Card or section art | scenes: `night-coast`, `tokyo-rain`, `kyoto-dusk`, `misty-forest`, `alpine-dawn`, `aurora-fjord`, `deep-reef`, `desert-night`, `ocean-sunset`, `lantern-lake` … | coloured canvas that fills the card width |
| Live text | `marquee` (scrolling sign), `split-flap` (board), `typewriter`, `scramble`, `wave-text`, `glitch` | text comes from `options` |
| Forms and layout references | `form-controls`, `box-frames`, `dividers`, `file-tree`, `terminal`, `boot-log` | copy their look for your own components |
| Loading | `spinners`, `progress-bar`, `skeleton` | |
| Data | `sparkline`, `bar-chart`, `gauge`, `heatmap`, `uptime-bar`, `cpu-meters`, `radar` | feed your own values through `options` |
| Errors | `not-found` | your own code, title and message |
| Small logos | `<ascii-banner text="AB">` | § 7.13 (ascii.rest also has language, company and Linux-distro logo pieces) |

**Rules**

- **Text pieces** (most) render into a `<pre>`: size them with `font-size`. Force your font on them so their
  box characters line up with yours: `ascii-art pre { font-family: var(--mono) !important; }`.
- **Coloured pieces** (scenes, logos) and **banners with a colour** render on a `<canvas>` that fills the
  element's width: size with `width` / `max-width`, never `height`. Inside a centring flex/grid container give
  them an explicit `width`.
- Colours are six-digit hex only (`#ffffff`, not `#fff`). Two or more colours separated by commas make a gradient.
- Options are JSON in a single-quoted attribute: `options='{"text":"…","speed":10}'`. Changing the attribute
  restarts the piece, so you can feed live data by updating it.
- Pieces play only while visible and freeze for reduced-motion users automatically.
- `ascii.js` downloads each piece from ascii.rest when the page uses it. For production, copy the pieces into
  your project ([docs/copy](https://ascii.rest/docs/copy/)) so the site does not depend on another server.
- Read **https://ascii.rest/llms-full.txt** before building: it is every docs page in one file, written for AI
  assistants, including each piece's options.

**Fit a fixed-width piece to its panel** (e.g. a marquee that should fill a wide panel):

```js
function fitPiece(el, box) {             // el = <ascii-art>, box = the panel it should fill
  const pre = el.querySelector('pre'); if (!pre || !box.clientWidth) return;
  const room = box.clientWidth - 2 * parseFloat(getComputedStyle(box).paddingLeft);
  const size = parseFloat(getComputedStyle(el).fontSize), wide = pre.getBoundingClientRect().width;
  if (wide) el.style.fontSize = Math.min(48, Math.max(6, size * room / wide)) + 'px';
}
new MutationObserver(() => requestAnimationFrame(() => fitPiece(sign, signPanel))).observe(sign, { childList: true });
addEventListener('resize', () => fitPiece(sign, signPanel));
```

---

## 9. Motion

| Motion | Where | Timing |
|---|---|---|
| Glint (a bright band sweeping left → right) | every `<ascii-banner>`: headings, text logos | library default, every few seconds |
| Type-in | success banner | once |
| Split-flap riffle | boards on load; one random status cell every ~4 s | 50 ms per flip, 4–25 flips per tile |
| Scrolling LED text | marquee sign | `speed: 10` |
| Braille spinner | any loading state | 80 ms per frame |
| Smooth scroll | jumping to the result of an action | `scrollIntoView({ behavior: 'smooth' })` |

No fades, slides, bounces, parallax or CSS transitions on layout. Respect `prefers-reduced-motion` everywhere:
show the final state immediately.

---

## 10. Writing

- **Lowercase** labels, titles, tabs, buttons and states: `new project`, `save changes`, `online`, `sold out`.
- **Short, factual, specific:** `18 left`, `only 3 left`, `last sync 13:30`, `no results for "xyz".`
  Never taglines, slogans or marketing copy.
- **Separators:** a middle dot with spaces (` · `) between facts; `→` for direction; `─` and `▶` in drawn tracks.
- **Codes and IDs uppercase, names capitalised:** `WX-01`, `PRJ-1042`, `Lisbon`, `Ada Lovelace`.
- **Panel titles name the thing** (`settings`, `order 1042`); **bottom hints summarise or instruct**
  (`tab next · enter save`, `12 items · sorted by name`, `newest`).
- **Numbers:** thousands separators for the user's locale; key figures bold and accent; units dim beside them.
- **Dates and times:** `sat, 24 oct 2026`, `24 oct`, 24-hour `13:30`, durations `1h 30m`.
- **Errors** say what happened and what to do, in one line, without "Error:" prefixes.

---

## 11. Responsive behaviour

```css
@media (max-width: 980px) {                 /* tablets: page grids collapse */
  .g-2, .g-3, .landing { grid-template-columns: minmax(0, 1fr); }
}
@media (min-width: 640px) and (max-width: 980px) { .g-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) {                 /* list cards rearrange: media + aside on top, body below */
  .tui.card { grid-template-columns: minmax(0, 1fr) max-content; gap: calc(var(--line) / 2) 2ch; }
  .card .media { display: flex; align-items: center; gap: 2ch; }
  .card .media ascii-banner { width: 8ch; }
  .card .body  { grid-column: 1 / -1; grid-row: 2; }
  .card .aside { grid-column: 2; grid-row: 1; }
  .card .facts { grid-column: 1 / -1; }
  .card .big, .card .aside .figure { font-size: 18px; }
}
@media (max-width: 640px) {                 /* phones */
  .tui { padding-left: 1ch; padding-right: 1ch; }
  .tui ascii-art[piece] { font-size: 6px !important; }            /* shrink art, keep text readable */
  .tui ascii-art[piece="typewriter"] { font-size: 13px !important; }
  .row { grid-template-columns: 2ch 8ch minmax(0, 1fr); }
}
```

- **No horizontal page scroll at 375 px.** Wide tables scroll inside their panel (`.scroll-x`).
- Hidden measuring elements must be `position: fixed` off-screen, or they widen the page.
- Test at 375, 768 and 1280 px.

---

## 12. Accessibility

- Frames and decorative art are `aria-hidden="true"`; real content stays ordinary text.
- Use real `<button>`, `<input>`, `<select>`, `<textarea>` and `<label for>`; the bracket look is CSS only.
- Radio and checkbox inputs stay in the DOM, visually hidden, so keyboards and screen readers work; focus shows
  a dotted accent outline.
- Grid cells and clickable cards have `aria-label`s; cards are `tabindex="0"` and open on Enter.
- Keep `--dim` for labels beside stronger values, never for the only copy of important information.
- Every animation stops under `prefers-reduced-motion` (ascii.rest pieces do this themselves).

---

## 13. Pitfalls and their fixes

| Problem | Fix |
|---|---|
| Frames misaligned; `─` narrower than letters | The Google Fonts JetBrains Mono lacks box-drawing glyphs → load the full woff2 files (§ 4). |
| Shade blocks `░` look solid, so meters read wrong | Use `━ ─ █ ■ □` and the sparkline blocks instead of `░`. |
| Page scrolls sideways on phones | An off-screen measuring element used `position: absolute`; make it `position: fixed; left: -10000px`. |
| A component's grid is ignored | `.tui { display: block }` wins over a single class → combine selectors: `.tui.card`. |
| Dropdown clipped by its panel | `.tui:has(.picker:not([hidden])) { overflow: visible; }` |
| Frames redraw in an endless loop | Guard the ResizeObserver with a flag released on the next animation frame. |
| Frames in a hidden tab are 8 columns wide | Skip hidden panels; call `TUI.watch(section)` when the tab is shown. |
| A coloured banner is enormous | It fills its container: always give it `max-width` or `width`. |
| Art pieces use a different font | `ascii-art pre { font-family: var(--mono) !important; }` |
| A sign or board is too small for its panel | Scale its font from the panel width (`fitPiece`, `fitBoard`). |
| Picker closes before a click registers | Choose options on `mousedown` and call `preventDefault()`. |
| Native date/select widgets look out of place | `appearance: none`, `color-scheme: dark`, and the bracket wrapper `.field`. |

---

## 14. Links

**ascii.rest — the ASCII art library**

- Site and gallery of every piece: <https://ascii.rest>
- Documentation: <https://ascii.rest/docs/>
- All documentation in one file, for AI assistants: <https://ascii.rest/llms-full.txt> · index: <https://ascii.rest/llms.txt>
- Plain-HTML usage (`<ascii-art>`, `<ascii-banner>`, attributes, sizing): <https://ascii.rest/docs/html/>
- Banners (fonts, shadows, colours, effects): <https://ascii.rest/docs/banners/>
- Copy-paste recipes (hero scene, 404 page, spinner, progress bar, header banner): <https://ascii.rest/docs/examples/>
- Copying pieces into your own project: <https://ascii.rest/docs/copy/>
- The script tag source: <https://ascii.rest/ascii.js>
- Pieces referenced in this document (each page shows the piece and its options):
  [earth](https://ascii.rest/earth/) ·
  [marquee](https://ascii.rest/marquee/) ·
  [split-flap](https://ascii.rest/split-flap/) ·
  [typewriter](https://ascii.rest/typewriter/) ·
  [form-controls](https://ascii.rest/form-controls/) ·
  [box-frames](https://ascii.rest/box-frames/) ·
  [dividers](https://ascii.rest/dividers/) ·
  [spinners](https://ascii.rest/spinners/) ·
  [progress-bar](https://ascii.rest/progress-bar/) ·
  [not-found](https://ascii.rest/not-found/) ·
  [tokyo-rain](https://ascii.rest/tokyo-rain/) ·
  [kyoto-dusk](https://ascii.rest/kyoto-dusk/) ·
  [alpine-dawn](https://ascii.rest/alpine-dawn/) ·
  [aurora-fjord](https://ascii.rest/aurora-fjord/) ·
  [deep-reef](https://ascii.rest/deep-reef/) ·
  [desert-night](https://ascii.rest/desert-night/)

**Font**

- JetBrains Mono: <https://www.jetbrains.com/lp/mono/> · source: <https://github.com/JetBrains/JetBrainsMono>
- Full woff2 files (they include the box-drawing characters):
  <https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/fonts/webfonts/JetBrainsMono-Regular.woff2> ·
  <https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/fonts/webfonts/JetBrainsMono-Bold.woff2>

**References for the look**

- htop, the source of the numbered tab bar: <https://htop.dev>
- Unicode box-drawing characters: <https://en.wikipedia.org/wiki/Box-drawing_characters>
- Unicode block elements (█ ▀ ▄ ▁▂▃▅▇): <https://en.wikipedia.org/wiki/Block_Elements>
- Braille patterns used by the spinner: <https://en.wikipedia.org/wiki/Braille_Patterns>

---

## 15. Starter page

A minimal page with every core piece wired up. Put the CSS from §§ 3–7 in `<style>` (or `style.css`) and the
JavaScript from §§ 6–7 in `<script>` (or `app.js`), then build from here.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Site</title>
  <link rel="stylesheet" href="style.css">
  <script type="module" src="https://ascii.rest/ascii.js"></script>
  <script src="app.js" defer></script>
</head>
<body>
<div class="page">
  <header class="top">
    <a class="brand" href="#home">site</a>
    <nav class="tabs">
      <a href="#home"><kbd>1</kbd>home</a>
      <a href="#items"><kbd>2</kbd>items</a>
      <a href="#settings"><kbd>3</kbd>settings</a>
    </nav>
  </header>

  <section data-tab="home">
    <div class="grid g-2" style="align-items: center; min-height: calc(100vh - 80px)">
      <div class="center" aria-hidden="true"><ascii-art piece="earth" style="font-size: 13px"></ascii-art></div>
      <div class="stack">
        <ascii-banner text="SITE" color="#f5a623,#ff6a3d" shadow="rounded" style="max-width: 340px"></ascii-banner>
        <div class="dim" style="letter-spacing: .3em; text-transform: uppercase">what this site does</div>
        <form class="tui hot" data-title="quick start" data-foot="enter go">
          <div class="row"><span class="cur">&gt;</span><label for="q">search</label>
            <span class="field"><input id="q" placeholder="type something"></span></div>
          <div class="actions"><button class="btn primary"> go </button></div>
        </form>
      </div>
    </div>
  </section>

  <section data-tab="items" hidden>
    <div class="rule" data-label="01 · items"></div>
    <div class="cards" id="cards"></div>
  </section>

  <section data-tab="settings" hidden>
    <form class="tui hot" data-title="settings" data-foot="tab next · enter save" style="max-width: 760px">
      <div class="row"><span class="cur">&gt;</span><label for="name">name</label>
        <span class="field"><input id="name"></span></div>
      <div class="row"><span class="cur">&gt;</span><span class="lab">theme</span>
        <span class="radios"><label><input type="radio" name="t" checked>dark</label><label><input type="radio" name="t">darker</label></span></div>
      <div class="actions"><button class="btn" type="reset">cancel</button><button class="btn primary"> save </button></div>
    </form>
  </section>
</div>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.rule[data-label]').forEach(r => { r.innerHTML = `── <b>${esc(r.dataset.label)}</b> ` + '─'.repeat(300); });
    startTabs();
  });
</script>
</body>
</html>
```

---

## 16. Checklist

- [ ] Only JetBrains Mono, loaded from the full files; frames line up at every width and after the font loads.
- [ ] Every panel is a `.tui` frame with a lowercase title; bottom hints where they help.
- [ ] Buttons `[ … ]`, radios `( ) / (*)`, checkboxes `[ ] / [x]`, inputs `[ … ]`, selects `[ … v ]`;
      no default browser widget is visible.
- [ ] One accent colour, at most one primary action per panel; green and red only for states.
- [ ] No slogans, no footer tagline, no filler: every string is a label, value, state or instruction.
- [ ] Headings are `<ascii-banner>`s with a `max-width`; art pieces use the site font.
- [ ] Loading uses the braille spinner; errors show the real message in red; empty states say what to do.
- [ ] No horizontal scroll at 375 px; grids collapse at 980 px; cards rearrange at 760 px.
- [ ] Keyboard: number keys switch tabs, Enter works in pickers and cards, focus is visible.
- [ ] `prefers-reduced-motion` freezes flaps, spinners and pieces.
