# Styling — "Mavi Liman" design system

All four screens share **one central stylesheet, `src/index.css`**, a light-only Mediterranean
("Mavi Liman") theme imported from Claude Design. Screens are styled with `className`, not inline
`style` objects; keep inline `style` only for one-off layout (spacing, grid template), never for
colors or surfaces. Icons are inline SVG from `src/icons.jsx` (no emoji in the product UI).

**Fonts:** `--serif` = **Marcellus** (headings, table/panel titles, big numbers), `--sans` =
**Hanken Grotesk** (body).

**Design tokens** live in `:root` in `index.css` (ink/text, accents, surfaces, radii, easings,
tracking/leading). Don't hardcode hex — use the tokens. Two sanctioned exceptions:
`CashierSummary.jsx`'s SVG charts (SVG presentation attributes don't resolve `var()`), and
`.qr-thumb`'s `#fff` (a QR code needs a white quiet zone to scan, in both themes).

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
- **`--sea-deep` / `--olive-deep` are hover fills only.** As *text on a tint* they'd need to move
  the opposite way in dark, which is why the `--tint-*` / `--tint-*-ink` pairs exist. Use those for
  status tags, badges and banners.

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

- **Split rule.** A *named design object* used in 2+ places (`.btn`, `.panel`, `.prod-card`)
  stays as CSS in `@layer components`. *One-off layout/spacing* is a utility in JSX
  (`mt-5`, `flex-1`, `text-center`). Don't expand `.btn` into utilities at 6 call sites —
  that's how variant drift starts.
- **Every rule in `index.css` must live inside a `@layer`.** Unlayered CSS beats *all* layered
  CSS including `utilities`, so a rule left outside silently kills `className="prod-card mb-3"`.
  `@layer base` holds element/global rules (`html`, `body`, headings, `::-webkit-scrollbar`,
  `prefers-reduced-motion`); everything else is `@layer components`. Preflight covers
  `box-sizing`, so don't re-add it.
- **`:root` is the single source of truth and is deliberately unlayered** — that's what makes it
  beat Tailwind's own `@layer theme` defaults (`rounded-md` → 16px, `ease-out` → our curve).
- **`@theme inline` bridges tokens to Tailwind's namespace** (`--color-sea: var(--sea)`), so
  `bg-sea` resolves straight to `var(--sea)` and **no separate `--color-sea` is ever emitted**.
  Change a value only in `:root`. Adding a color = a `:root` token + one bridge line.
- **The palette is locked**: `@theme { --color-*: initial }` strips Tailwind's 22 built-in
  ramps, so `bg-blue-500` **won't compile**. Only `white`/`black` were kept.
- **`@keyframes` are outside layers** (keyframes aren't scoped by them). Our pulse is named
  **`ml-pulse`** because Tailwind reserves `pulse` via `--animate-pulse` with a different curve.
- **`.reveal` + `style={{'--i': index}}` stays as-is** — `calc(var(--i,0) * 55ms)` is the one
  legitimate remaining inline `style`.
- **Fonts load via `<link>` in `index.html`.** Don't move them back into `index.css`:
  `@import 'tailwindcss'` expands inline, which would push a font `@import` behind real rules
  and CSS spec drops it silently (fonts fall back to system).
- Tailwind v4 requires **iOS 16.4+ / Chrome 111+** (`@property`, `color-mix`, cascade layers).
  Accepted knowingly; relevant because random customer phones scan the QR menu.

## Charts

**Charts (`CashierSummary.jsx`)** are hand-rolled inline SVG, single-hue by data job (sea for the
revenue trend, olive for top-products), no chart library. Follow the `dataviz` skill: thin marks,
rounded data-ends, direct value labels, recessive axes, `<title>` hover, `prefers-reduced-motion`
respected.

## Layout and density are settled — don't "modernize" them unprompted

A 2026-07-17 redesign of the customer menu (Marcellus category headings, one surface per category,
40px tap targets, collapsible cart) was built, deployed, and **rejected**: the user preferred the
existing layout. Tailwind was kept, the visual changes were reverted (`git revert 9c2f6b0`).

A 2026-08-06 pass (explicitly requested) then applied Apple's *mechanics* — springs, materials,
type scale, 44px hit areas, dark mode — while **deliberately keeping that layout and density**.
The ergonomic wins from the reverted commit were re-landed; its layout changes were not. So:

- ❌ `.cat-title` stays 13px bold Hanken. No Marcellus, no bottom rule.
- ❌ No per-category shared surface. `.prod-card` keeps its own background, blur, border, shadow.
- ❌ **The cart bar is never a hidden "peek".** `CartSheet` mounts fully expanded — bag row, line
  list, total, CTA. The drag gesture is purely additive.
- ❌ Don't change `.menu-page` max-width, card padding/gap/margins.
- ✅ Hit areas grow via transparent `::after` pseudo-elements, so 44px targets cost no density.

Restyling still needs an explicit request, and should land in its own commit.

## Animation conventions

Two systems, deliberately split:

**CSS** owns mount-only motion with no exit and nothing to interrupt: `.reveal` +
`style={{ '--i': index }}`, `ml-pulse` dots, `.spinner`, `.alert` shake, page `fade-in`,
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

## Preserve logic when restyling

The screens' data flow (`apiFetch`, `useState`, handlers) must stay intact — change presentation
only. Never touch `src/api.js` for a styling change.
