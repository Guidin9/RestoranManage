# Styling — "Kor" design system

All five screens share **one central stylesheet, `src/index.css`** (light + dark). Screens are
styled with `className`, not inline `style` objects; keep inline `style` only for one-off layout
(spacing, grid template), never for colors or surfaces. Icons are inline SVG from `src/icons.jsx`
(no emoji in the product UI).

**Palette (2026-08-07):** warm charcoal + burnt orange. Cream surfaces (`--paper` `#FFFBF5`),
charcoal ink (`--ink` `#1C1917`), one saturated accent (`--accent` `#C2410C`). Green/amber/red are
**semantic only** — `--ok` confirms, `--warn` warns, `--danger` destroys. No decorative colour.
The previous "Mavi Liman" Mediterranean palette (sage/sea-blue/terracotta) was rejected by the user
as looking AI-generated; don't reintroduce it.

**Token names are roles, not hues** — `--accent`, `--ok`, `--danger`, not `--sea`/`--olive`/
`--terra`. When the palette next changes, only the values in `:root` move; no rule cares whether
`--accent` is orange. Keep it that way.

**Font: one family, Inter** (variable, `opsz` + `wght 400..800`, `font-optical-sizing: auto`).
There is **no `--serif`** and no `--font-serif` bridge — hierarchy comes from weight and size
alone. The old Marcellus display face was dropped with the palette.

**Design tokens** live in `:root` in `index.css` (ink/text, accents, surfaces, radii, easings,
tracking/leading). Don't hardcode hex — use the tokens. One sanctioned exception: `.qr-thumb`'s
`#fff` (a QR code needs a white quiet zone to scan, in both themes). Note that
`CashierSummary.jsx`'s charts are **no longer** an exception — `fill`/`stroke` are CSS properties
in SVG and resolve `var()` when written from CSS, so the chart classes live in `@layer components`
(`.chart-bar`, `.chart-axis`, `.chart-tick`, `.chart-label`) and follow dark mode for free.

## The shell: `.app-nav` + grouped surfaces

Every screen is `.page`/`.menu-page` → sticky glass `.app-nav` → content sections. There is **no
card wrapping a whole screen** (the old dark-gradient `.panel` shell is gone); the cards are the
data. The nav's material and hairline appear only once content scrolls under it — a scroll edge
effect driven by `useScrolled.js` (IntersectionObserver, no scroll listener).

`.app-nav-title` is visible by default. The customer menu adds `.app-nav--reveal` to opt into
Apple's large-title handoff (title hidden until the big `<h1>` scrolls under the bar); staff
screens don't, because they are tools with no vertical budget for a display title.

Surfaces that use the glass material (`--glass` + `blur(10px)` + `--glass-edge`/`--glass-top` +
`--shadow-inset, --shadow-card`): `.group-card`, `.order-card`, `.kpi`, `.chart-card`, `.cat-card`,
`.form-box`, `.table-admin-card`, `.staff-row`. **Adding another means adding it to the
`prefers-reduced-transparency` and `prefers-contrast` blocks too** — a surface left out of those
stays glass when the user asked for solid, and sticks out.

Lists separate rows with a hairline pseudo-element (`.menu-row + .menu-row::before`,
`.order-line + .order-line::before`, `.tab-item + .tab-item::before`), inset from the left to start
at the text edge — not with gaps and not with per-row borders.

## Dark mode — three unlayered `:root` blocks

`index.css` has `:root` (light, the source of truth), then
`@media (prefers-color-scheme: dark) { :root { … } }` with **only the tokens that flip**, then
`@media (prefers-contrast: more) { :root { … } }`. All three are **unlayered** and have equal
specificity; the media-qualified ones win by source order. No `!important`, no `:root:root`.

This survives Tailwind because **`@theme inline` emits the literal `var()`**
(`.bg-paper { background-color: var(--paper) }`), never a copy — so flipping `--paper` in the dark
block carries every utility and every `var(--paper)` rule with it for free. `light-dark()` is
**rejected**: it needs Chrome 123 / Safari 17.5, above our iOS 16.4 floor.

Two rules that are easy to get wrong:

- **Chrome must stay lighter than the page in dark mode.** `--deep-grad` and `--glass-deep` are
  elevated surfaces; if they go darker than the page they recede and text bleeds through the glass.
- **`--accent-deep` / `--ok-deep` are hover fills only.** As *text on a tint* they'd need to move
  the opposite way in dark, which is why the `--tint-*` / `--tint-*-ink` pairs exist. Use those for
  status tags, badges and banners.
- **`--warn` leans yellow on purpose.** With an orange `--accent`, an amber warn was too close to
  read apart — "Hazırlanıyor" and "Servise hazır" looked like the same tag.

Token families added for this: `--page-grad`, `--line-hair`/`--line-soft`, `--ink-lift`,
`--placeholder`, four `--tint-*` + `-ink` pairs, `--glass`/`--glass-edge`/`--glass-top`/
`--glass-deep`/`--scrim`/`--surface-deep`, a four-step shadow scale
(`--shadow-head` < `--shadow-card` < `--shadow-panel` < `--shadow-float`) plus `--shadow-inset`
(a transparent inset in light, a top highlight in dark — it must never be `none`, since `none`
can't sit in a `box-shadow` list).

**Typography** is a scale, not per-class values: `--track-*` (tighter as text grows, looser as it
shrinks) and `--lead-*`. A grouped block at the top of `@layer components` assigns them by size
band; the eight uppercase micro-labels that declare their own `letter-spacing` come later in the
file and correctly win.

**Core classes** are all defined in `index.css` — read it for the current inventory. Reuse an
existing named class before inventing a new one.

## Tailwind v4 — hybrid, not a replacement

Tailwind is wired up via `@tailwindcss/vite` (**not** PostCSS — there is no `postcss.config.*`
and no other PostCSS plugin; `postcss`/`autoprefixer` were removed and Lightning CSS handles
prefixing). `index.css` starts with `@import 'tailwindcss'`. The rules that matter:

- **Split rule.** A *named design object* used in 2+ places (`.btn`, `.group-card`, `.order-card`)
  stays as CSS in `@layer components`. *One-off layout/spacing* is a utility in JSX
  (`mt-5`, `flex-1`, `text-center`). Don't expand `.btn` into utilities at 6 call sites —
  that's how variant drift starts.
- **Every rule in `index.css` must live inside a `@layer`.** Unlayered CSS beats *all* layered
  CSS including `utilities`, so a rule left outside silently kills `className="group-card mb-3"`.
  `@layer base` holds element/global rules (`html`, `body`, headings, `::-webkit-scrollbar`,
  `prefers-reduced-motion`); everything else is `@layer components`. Preflight covers
  `box-sizing`, so don't re-add it.
- **`:root` is the single source of truth and is deliberately unlayered** — that's what makes it
  beat Tailwind's own `@layer theme` defaults (`rounded-md` → 16px, `ease-out` → our curve).
- **`@theme inline` bridges tokens to Tailwind's namespace** (`--color-accent: var(--accent)`), so
  `bg-accent` resolves straight to `var(--accent)` and **no separate `--color-accent` is emitted**.
  Change a value only in `:root`. Adding a color = a `:root` token + one bridge line.
- **The palette is locked**: `@theme { --color-*: initial }` strips Tailwind's 22 built-in
  ramps, so `bg-blue-500` **won't compile**. Only `white`/`black` were kept.
- **`@keyframes` are outside layers** (keyframes aren't scoped by them). Our pulse is named
  **`kor-pulse`** because Tailwind reserves `pulse` via `--animate-pulse` with a different curve.
- **`.reveal` + `style={{'--i': index}}` stays as-is** — `calc(var(--i,0) * 55ms)` is the one
  legitimate remaining inline `style`.
- **Scanning is pinned to `src/` with `@source`.** `index.css` opens with
  `@import 'tailwindcss' source(none)` plus explicit `@source '../index.html'` and
  `@source './**/*.{js,jsx}'`. Without the pin, Tailwind scanned the repo root and generated real
  utilities from class names *mentioned in the CLAUDE.md files*. Paths resolve relative to the CSS
  file, not the project root.
- **Fonts load via `<link>` in `index.html`.** Don't move them back into `index.css`:
  `@import 'tailwindcss'` expands inline, which would push a font `@import` behind real rules
  and CSS spec drops it silently (fonts fall back to system).
- Tailwind v4 requires **iOS 16.4+ / Chrome 111+** (`@property`, `color-mix`, cascade layers).
  Accepted knowingly; relevant because random customer phones scan the QR menu.

## Charts

**Charts (`CashierSummary.jsx`)** are hand-rolled inline SVG, no chart library, coloured from CSS
classes so dark mode follows for free. **Single hue per data job:** the revenue trend is all
`--accent`, and the selected day is separated by *opacity* (`.chart-bar` 0.55 → `.is-sel` 1),
not by a second colour. Follow the `dataviz` skill: thin marks, rounded data-ends, direct value
labels, recessive axes, `<title>` hover, `prefers-reduced-motion` respected.

## Layout history — what was rejected, and what is current

A 2026-07-17 redesign of the customer menu was built, deployed and **rejected**; the visual changes
were reverted (`git revert 9c2f6b0`). A 2026-08-06 pass then applied Apple's *mechanics* — springs,
materials, type scale, 44px hit areas, dark mode — keeping the then-current layout.

**2026-08-07 supersedes both, at the user's explicit request.** The customer menu moved to an
iOS inset-grouped list (sticky glass nav + horizontal category strip + one surface per category
with hairline rows), then the palette and font changed ("Kor"), then all four staff screens moved
to the same language. The user reviewed and approved each step. So the old do-not list is void:
`.cat-title`, `.prod-card`, `.menu-arch` and the dark `.panel` shell no longer exist.

What still holds:

- ❌ **The cart bar is never a hidden "peek".** `CartSheet` mounts fully expanded — bag row, line
  list, total, CTA. The drag gesture is purely additive.
- ✅ Hit areas grow via transparent `::after` pseudo-elements, so 44px targets cost no density.
- ✅ Staff screens are **tools**: compact nav, no large display title, information density over
  breathing room. The customer menu is the one screen that gets a large title.

Restyling still needs an explicit request, and should land in its own commit.

## Animation conventions

Two systems, deliberately split:

**CSS** owns mount-only motion with no exit and nothing to interrupt: `.reveal` +
`style={{ '--i': index }}`, `kor-pulse` dots, `.spinner`, `.alert` shake, page `fade-in`,
`.login-card` `pop-in`, `.pbar-fill` width. Keyframes live outside layers; the
`prefers-reduced-motion` block in `@layer base` disables them.

**Motion** (`motion/react`) owns anything that needs an exit or must be grabbable mid-flight:
`AnimatePresence` on the cart sheet, modals, toasts and polled lists.

- Presets live in `src/motion.js`. **`bounce: 0` is the default**; `bounce > 0` only when a real
  gesture carried momentum in. Use `visualDuration`, not `duration` — it is Apple's *response*.
- **`LazyMotion` + `m.*` + `domAnimation`, with `strict`.** This bundle rides the customer QR route
  over mobile data. `motion.*` throws on purpose; drag/layout features are not imported because
  the gesture is hand-written.
- **`MotionConfig reducedMotion="user"` in `main.jsx` is required** — the `!important` CSS
  kill-switch cannot touch JS-driven animation, and without it the app silently ignores
  Reduce Motion.
- **Never put `.reveal` on a `motion.*`/`m.*` element**, and never let CSS and Motion animate the
  same element's `transform`. The keyframe and the inline transform fight and it flickers.

### The gesture: `useDragSheet` + `springTo`

`src/useDragSheet.js` implements 1:1 pointer tracking with `setPointerCapture`, grab-offset
preservation, 10px hysteresis, a velocity ring buffer (clamped — a sub-millisecond gap between two
events otherwise yields tens of thousands of px/s), rubber-banding at bounds, Apple's momentum
projection (`project()`, d = 0.998), velocity handoff, and interruption from the *live* value.

The release spring is integrated by hand in `springTo` (`src/motion.js`) rather than via Motion's
imperative `animate()`: semi-implicit Euler, fixed 1/240s sub-steps, `ω₀ = 2π/response`,
`ζ = 1 − bounce`. It is covered by deterministic tests (convergence, no-overshoot at `bounce: 0`,
overshoot at `bounce: 0.2`, velocity handoff, stability at the velocity cap).

Two hazards worth remembering, both found the hard way:

- **Measure list height on an inner element, never the scrolling box.** `scrollHeight` cannot
  report less than the box's own height, so a 40px list inside a 104px box reports 104 and the
  sheet never collapses. Hence `.cart-lines` (animated height) wraps `.cart-lines-inner` (measured).
- **`.cart-lines` hides its scrollbar on purpose.** A visible scrollbar narrows the content, wraps
  a product name, changes the measured height, re-snaps, and hides the scrollbar again — a
  `ResizeObserver` feedback loop that freezes the page.

**Still unverified:** the cart drag has never been tried with a thumb on a real phone. Its physics
are covered by deterministic tests (`npm run test:motion`, 18 checks), the code has been reviewed,
and there is a `pointer-events: none` safety on exit — but *feel* is not something a test asserts.
If you get the chance, confirm it on hardware before changing anything in `useDragSheet.js`.

## Preserve logic when restyling

The screens' data flow (`apiFetch`, `useState`, handlers) must stay intact — change presentation
only. Never touch `src/api.js` for a styling change.
