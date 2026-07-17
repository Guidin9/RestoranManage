# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A QR-code restaurant menu system. One git repo (`github.com/Guidin9/RestoranManage`,
branches `main` = live and `dev` = UI work) holding two apps that are developed and run
separately — no monorepo tooling, no shared package manager:

- `Qr_menu/` — Laravel 13 / PHP 8.4 backend, API-only (MySQL in dev/prod, SQLite in tests)
- `qr-menu-frontend/` — React 19 + Vite SPA serving all four user-facing screens

**Live** at `https://restoranmanage.francecentral.cloudapp.azure.com` on an Azure VM via
Docker Compose (Caddy + Let's Encrypt HTTPS). See the "Deployment" section below and
`README.md` for the operational details.

The UI, code comments, and API response messages are in Turkish. Keep new user-facing strings Turkish to match.

## Commands

Backend (run from `Qr_menu/`):

```bash
composer install
php artisan serve                 # http://127.0.0.1:8000 — the port the frontend expects
php artisan migrate --seed        # seed creates admin+cashier, 3 waiters, 3 tables, a sample menu
php artisan migrate:fresh --seed  # reset DB

composer test                     # or: php artisan test  (Pest 4)
php artisan test --filter=OrderTest
./vendor/bin/pest tests/Feature/OrderTest.php
./vendor/bin/pint                 # formatter (codebase is NOT pint-clean; scope it to files you touch)

# Re-provision only the admin/cashier accounts after changing their .env credentials.
# Never run a bare `db:seed` against a populated DB — DatabaseSeeder uses create()
# and will duplicate the waiters, tables, and products.
php artisan db:seed --class=StaffSeeder
```

Tests run against SQLite `:memory:` (configured in `phpunit.xml`), so no MySQL is needed for the suite. `RefreshDatabase` is commented out in `tests/Pest.php`, so test files that touch the DB must `uses(RefreshDatabase::class)` themselves. `tests/Feature/OrderTest.php` covers ordering, merging, delivery, and the daily summary.

Frontend (run from `qr-menu-frontend/`):

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
npm run lint      # oxlint, not eslint
npm run preview
```

Windows note: PHP here runs via Laravel Herd and is on PATH only in PowerShell, not the Bash tool. Docker and the `gh` CLI are not installed locally — deploy/verify happen on the live VM.

## Deployment (Azure VM + Docker Compose)

Live on an Azure Linux VM. Access: `ssh -i <RestoranManage_key.pem> Gui@20.19.211.64`;
repo at `~/RestoranManage`. Root `docker-compose.yml` defines four services — `caddy`,
`frontend`, `backend`, `db` — and the root `.env` (copied from `.env.example`) supplies
config. `SITE_ADDRESS` is the single source of truth for the public host; `APP_URL` and
`VITE_API_URL` derive from it. All four services use `restart: always`, so the stack comes
back on its own after a VM reboot.

Server specifics that bite:
- **Use `sudo docker compose` (V2, space).** The old `docker-compose` (V1, hyphen) is
  still installed but is broken against BuildKit images (`KeyError: 'ContainerConfig'`);
  don't use it. `docker` needs `sudo` here — the `Gui` user isn't in the `docker` group.
- **Deploy a UI-only change:** `git pull && sudo docker compose up -d --build frontend`
  (30–60 s, backend/db untouched).
- **Deploy a backend change:** `git pull && sudo docker compose up -d --build backend frontend`,
  then apply any new migrations: `sudo docker compose exec -T backend php artisan migrate --force`.
- **Never `down -v`** — that deletes the `restoranmanage_db_data` volume (real data).
- Provision/refresh staff after editing `.env`:
  `sudo docker compose exec -T backend php artisan db:seed --class=StaffSeeder --force`.
- `APP_KEY`: generate on the server with `echo "base64:$(openssl rand -base64 32)"` —
  `artisan key:generate` can't run before Compose validates the (still-empty) `APP_KEY`.

## Architecture

### Routing: hand-rolled, no react-router

`src/App.jsx` is both the customer menu screen and the app's router. It reads `window.location.pathname` directly and returns a different component per path:

- `/cashier` → `Cashier.jsx` (two views via an in-panel toggle: "Açık Hesaplar" and "Gün Özeti" → `CashierSummary.jsx`)
- `/kitchen` → `Kitchen.jsx` (kitchen tickets, no prices; mark items prepared)
- `/waiter` → `Waiter.jsx` (table occupancy grid, add/remove items, serve prepared items)
- `/admin` → `admin.jsx` (CRUD for waiters, tables, categories, products)
- anything else → the customer menu, which requires a `?table=<uuid>` query param and 404s the QR lookup without it

Adding a screen means adding another pathname check in `App.jsx`. Vite's dev server falls back to `index.html` in dev; in production `qr-menu-frontend/nginx.conf` does the same via `try_files ... /index.html`, which is what keeps a hard load of `/cashier` from 404ing.

Shared UI helpers: `src/icons.jsx` (inline lucide-style SVG line icons, `currentColor`) and `src/CashierSummary.jsx` (the cashier dashboard with hand-rolled inline-SVG charts, no chart library).

### Order lifecycle

`Table` (has a UUID `qr_code`) → `Order` (`status`: active/paid/cancelled, `paid_at`) → `OrderItem` → `Product` → `Category`. `Waiter` stands alone.

A table has at most one open tab, enforced by `Order::firstOrCreate(['table_id' => ..., 'status' => 'active'])` in `OrderController@store`. "Occupied" is derived, not stored: a table is occupied iff an active order references it.

**Items merge by product.** `OrderController@store` does not blindly `create()` a line per incoming item — if the active order already has an `OrderItem` for that `product_id`, it increments that row's `quantity` instead. So repeat orders from multiple customers or the waiter adding one at a time collapse into a single line in the cashier. `price_at_sale` on the existing row is preserved.

Closing a tab sets `status = 'paid'` and stamps `paid_at = now()` (`OrderController@closeOrder`), which frees the table and feeds the daily summary. `OrderController@removeOrderItem` also flips an order to `paid` (with `paid_at`) once its last item is removed — emptying a tab and paying a tab are the same terminal state; it also clamps `delivered_quantity` down when it decrements a partially-delivered row.

`order_items.price_at_sale` snapshots the product price at order time so menu edits don't retroactively change open or historical tabs. Read totals from it, never from `products.price`.

`Table` auto-generates `qr_code` on create (model `booted()` hook), and `OrderController@waiterTables` additionally back-fills any `NULL` qr_code on read.

### Three-stage flow: preparing → ready → served

Like online food-delivery apps, each order line moves through three stages, tracked by **two quantity counters** on `order_items` (invariant `0 ≤ delivered_quantity ≤ prepared_quantity ≤ quantity`):

- `prepared_quantity` — units the **kitchen** has finished preparing
- `delivered_quantity` — units the **waiter/cashier** has served

Computed attributes appended on the `OrderItem` model (serialize into every payload):

- `preparing_quantity = quantity − prepared_quantity` (in the kitchen)
- `ready_quantity = prepared_quantity − delivered_quantity` (prepared, waiting to be served)
- `pending_quantity = quantity − delivered_quantity` (not-yet-served total = preparing + ready)
- `stage` — the earliest active stage: `'preparing' | 'ready' | 'served'`
- `is_delivered = delivered_quantity ≥ quantity`

Marking is **per item** (with an order-level "all" convenience). Endpoints (Sanctum's `abilities` middleware requires *all* listed abilities, so shared actions need one route per ability group):

- Kitchen (ability `kitchen`): `POST /api/kitchen/items/{id}/prepare`, `POST /api/kitchen/orders/{id}/prepare` — set `prepared_quantity = quantity`.
- Serve (abilities `waiter` **and** `cashier`, mirrored routes): `POST /api/{waiter|cashier}/items/{id}/serve`, `POST /api/{waiter|cashier}/orders/{id}/serve` — set `delivered_quantity = prepared_quantity` (only prepared units can be served).

`GET /api/kitchen/orders` (ability `kitchen`) returns active orders that still have `preparing_quantity > 0`, as `{ id, table_number, opened_at, items: [...] }` **without any price fields**.

A table/order signals **servis bekliyor** (ready to serve) iff any active item has `ready_quantity > 0` — waiter and cashier show this as a top banner + pulsing per-card badge; the customer sees a per-line "Hazırlanıyor / Servise hazır / Servis edildi" tag.

Quantity-based staging composes with the merge behavior: a fully-served `çay ×3` that gets `+1` becomes `çay ×4` with `prepared 3 / delivered 3` → `preparing_quantity = 1` again → back into the kitchen. `OrderController@removeOrderItem` clamps `prepared`/`delivered` down when it decrements a line. Migrations backfilled `delivered_quantity = quantity` and `prepared_quantity = quantity` for pre-existing rows so old open tabs weren't flagged as unprepared/unserved on deploy.

### Authentication: Sanctum tokens with role abilities

All logins live in `AuthController` and return a real Sanctum token. Two models hold tokens (Sanctum resolves `tokenable` polymorphically):

- **`User`** — the fixed admin, cashier, and kitchen accounts, distinguished by a `role` column. Credentials come from `config/staff.php` (backed by `.env`), and `StaffSeeder` writes them. Login matches on `username` **and** `role`. Each fixed role has its own login endpoint (`adminLogin`/`cashierLogin`/`kitchenLogin` → `loginAsUser`).
- **`Waiter`** — staff created via the admin panel. Passwords use the `hashed` cast and are in `$hidden`.

Authorization is by **token ability**, not by role lookup at request time:

| Login | Abilities on the token |
|---|---|
| admin | `admin`, `cashier`, `waiter` |
| cashier | `cashier` |
| kitchen | `kitchen` |
| waiter | `waiter` |

Admin gets all three (cashier/waiter) because the admin panel calls `/api/waiter/tables` and `/api/waiter/menu`. Routes are grouped under `auth:sanctum` plus an `abilities:<name>` check; the `abilities` alias is registered in `bootstrap/app.php`. Wrong ability → 403, missing/revoked token → 401.

Endpoint groups: **cashier** — `/api/cashier/orders`, `/api/cashier/orders/{id}/pay`, `/api/cashier/items|orders/{id}/serve`, `/api/cashier/summary`. **kitchen** — `/api/kitchen/orders`, `/api/kitchen/items|orders/{id}/prepare`. **waiter** — `/api/waiter/tables`, `/api/waiter/menu`, `/api/waiter/items/{id}/remove`, `/api/waiter/items|orders/{id}/serve`.

Adding a fixed-role staff account = a `config/staff.php` block (+ `.env` vars, also wired into `docker-compose.yml`), a `ROLE_ABILITIES` entry + `xLogin()` in `AuthController`, an `upsertStaff(...)` line in `StaffSeeder`, and a login route. The `kitchen` role was added exactly this way.

**Deliberately still public:** `GET /api/menu/{tableUuid}` and `POST /api/orders`. Customers have no accounts, so anyone with a table UUID can read the menu and place an order against that table. This is inherent to the QR flow — don't "fix" it by adding auth without redesigning how customers order.

Frontend tokens live in localStorage (`admin_token`, `cashier_token`, `waiter_token`) and are attached by `apiFetch`. Logout calls `POST /api/logout`, which deletes the current token server-side.

### API layer: always go through `src/api.js`

Every screen imports `apiFetch` from `src/api.js`, which owns the base URL (`VITE_API_URL`, falling back to `http://127.0.0.1:8000`), attaches `Authorization: Bearer`, and converts 401/403 into an `UnauthorizedError` after clearing the stored token. Don't reintroduce bare `fetch` against the API — the one legitimate raw `fetch` is the ImgBB upload.

Notable payloads:
- `GET /api/menu/{uuid}` returns the menu plus `active_order_total`, `active_order_item_count`, and `active_order_items` (each with name, quantity, line_total, `pending_quantity`, `is_delivered`) so the customer sees the table's running tab and per-item delivery status.
- `GET /api/cashier/summary?date=YYYY-MM-DD` returns `today`/`week`/`month` blocks (`revenue`, `tables_closed`, `items_sold`, `avg_ticket`, `avg_daily_revenue`), a 14-day `daily_trend`, and `top_products` — computed from paid orders filtered by `paid_at`.

CORS is wide open (`allowed_origins: ['*']`) and must keep allowing the `authorization` header. It only matters in dev (SPA :5173 vs API :8000); in production `Caddyfile` proxies `/api/*` to the backend from the same host, so requests are same-origin. Because TLS ends at Caddy, `bootstrap/app.php` sets `trustProxies(at: '*')`.

Cashier ("Açık Hesaplar"), Waiter, and Kitchen poll their endpoints on a 3–5s `setInterval`; the customer menu re-fetches every 5s to keep the table total/list fresh; there is no websocket/broadcast layer, so the "servis bekliyor" notification to the waiter is just the next poll surfacing `ready_quantity > 0`. The cashier "Gün Özeti" view does not poll — it fetches on date change.

### Product images go to ImgBB, not to the backend

`Admin.jsx` uploads the file client-side to `api.imgbb.com` and posts only the resulting URL; `AdminController@storeProduct` stores it as a plain string in `products.image`. The key comes from `VITE_IMGBB_API_KEY`; uploads are blocked with a message when it's empty. `Product::getImageUrlAttribute` (appended as `image_url`) passes through anything starting with `http` and otherwise falls back to `asset('storage/'.$image)`. Any `VITE_*` value is compiled into the client bundle, so the ImgBB key is readable in the built JS.

## Gotchas

- **Orders carry no waiter attribution.** `waiter_id` was removed from `Order::$fillable` because no migration ever created the column.
- **Schema changes need a migration on deploy.** After `--build backend`, run `php artisan migrate --force` inside the backend container. Recent additions: `orders.paid_at`, `order_items.delivered_quantity` (both nullable/defaulted with backfills so live data stays consistent).
- **Filename casing.** `App.jsx` imports `./Admin`, `./Cashier`, `./Waiter`, `./CashierSummary`, `./icons` — these must keep matching their files exactly, since Windows dev is case-insensitive but the Linux Docker build is not.
- **`Qr_menu/.env` is untracked** and must stay that way — it holds `APP_KEY` and the staff passwords. Only `.env.example` is committed.
- **QR codes point at `window.location.origin`**, so they're only correct when generated from the domain customers will actually scan into.

## Styling — "Mavi Liman" design system

All four screens share **one central stylesheet, `src/index.css`**, a light-only Mediterranean
("Mavi Liman") theme imported from Claude Design. Screens are styled with `className`, not inline
`style` objects; keep inline `style` only for one-off layout (spacing, grid template), never for
colors or surfaces. Icons are inline SVG from `src/icons.jsx` (no emoji in the product UI).

**Fonts:** `--serif` = **Marcellus** (headings, table/panel titles, big numbers), `--sans` =
**Hanken Grotesk** (body). Both loaded via `@import` at the top of `index.css`.

**Design tokens** live in `:root`:
- Ink/text: `--ink`, `--ink-dim`, `--ink-faint`
- Accents: `--sea` / `--sea-deep` (deniz mavisi), `--olive` / `--olive-deep` / `--olive-light`
  (zeytin), `--terra` (terakota, silme/uyarı), `--warn` (amber, teslim uyarısı)
- Surfaces: `--paper`, `--paper-soft`, `--sand`, `--mist`, `--line`, `--line-strong`,
  `--deep-grad` (the dark petrol panel-header gradient)
- `--radius-lg` / `--radius-md` / `--radius-sm`, easing `--ease-spring` / `--ease-out`
- Don't hardcode hex — use the tokens. (Exception: `CashierSummary.jsx`'s SVG charts use hex
  constants because SVG presentation attributes don't resolve `var()`.)

### Tailwind v4 — hybrid, not a replacement

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

**Core classes** (all in `index.css`):
- Shell: `.page`, `.panel` + `.panel-head` / `.panel-icon` / `.panel-title` / `.panel-sub` /
  `.panel-body` / `.panel-actions` (dark-header white card used by waiter/cashier/admin)
- Layout: `.row-between`, `.stack`, `.grid` + `.grid-cards` / `.grid-tables` / `.grid-wide`
- Buttons: `.btn` + `.btn-primary` (sea) / `.btn-success` (olive) / `.btn-danger` (terra outline) /
  `.btn-ink` / `.btn-logout` / `.btn-block` / `.btn-sm`, plus `.btn-text-danger`
- Forms: `.field`, `.label`, `.input`, `.select`, `.form-box`
- Auth: `.login-card` + `.login-head` / `.login-arch` (arch monogram) / `.login-sub`, `.alert`
- Tabs: `.tabs` / `.tab` (underline style, used by admin and the cashier view toggle)
- Customer menu: `.menu-page` / `.menu-head` / `.menu-arch*`, `.cat-title`, `.prod-card` /
  `.prod-thumb` / `.stepper` / `.qty-btn`, `.cart-bar` + `.cart-*`, `.confirm-overlay` / `.confirm-card`,
  and the running-tab panel `.tab-panel` / `.tab-total` / `.tab-items` / `.tab-item` / `.status-tag`
- Waiter: `.table-card` (+ `--free` / `--busy` / `--pending`), `.pending-cart` (the batch-before-send
  basket), modal `.line-row` (+ `--pending`), `.add-chip`
- Cashier: `.order-card` (+ `--pending`) / `.order-*` / `.order-deliver`
- Dashboard: `.summary-toolbar`, `.kpi-grid` / `.kpi` (+ `--accent`), `.context-grid` / `.ctx`,
  `.chart-card` / `.chart-title` / `.chart-empty`, `.pbar-*` (top-products meter bars)
- Kitchen: reuses `.panel` / `.order-card` for tickets, `.order-prepare` ("Tümünü Hazırla" button)
- Stage warnings: `.alert-banner`, `.badge-pending` + `.dot-pending` (pulsing amber),
  status tags `.status-tag--wait` (Hazırlanıyor, amber) / `--ready` (Servise hazır, sea) / `--ok` (Servis edildi, olive)

**Charts (`CashierSummary.jsx`)** are hand-rolled inline SVG, single-hue by data job (sea for the
revenue trend, olive for top-products), no chart library. Follow the `dataviz` skill: thin marks,
rounded data-ends, direct value labels, recessive axes, `<title>` hover, `prefers-reduced-motion`
respected.

**The current look is settled — don't "modernize" it unprompted.** A 2026-07-17 redesign of the
customer menu (Marcellus category headings, one surface per category, 40px tap targets, collapsible
cart) was built, deployed, and **rejected**: the user preferred the existing layout. Tailwind was
kept, the visual changes were reverted (`git revert 9c2f6b0`). Treat the present spacing/type/
density as intentional. Restyling work needs an explicit request, and even then it should land in
its own commit, separate from any infrastructure change.

**Animation conventions:** cards enter with a staggered reveal — add `className="... reveal"` and
`style={{ '--i': index }}`. Keyframes (`fade-in-up`, `pop-in`, `pulse`, `shake`, `spin`) live in
`index.css`; a `@media (prefers-reduced-motion: reduce)` block disables them. Keep new motion in that
same system.

**Preserve logic when restyling.** The screens' data flow (`apiFetch`, `useState`, handlers) must stay
intact — change presentation only. Never touch `src/api.js` for a styling change.

Tailwind/postcss appear in `package.json` devDependencies but are **not wired up** — `className="flex gap-4"` does nothing. Design work happens on the **`dev` branch**; see `qr-menu-frontend/TASARIM.md`.

## Default credentials

These are the **local-dev** defaults, set in `Qr_menu/.env` and seeded by `StaffSeeder`.
Production uses different passwords (set in the server's root `.env`; not in the repo).

| Screen | Username | Password (local dev) |
|---|---|---|
| `/admin` | `admin` | `admin123` |
| `/cashier` | `kasa` | `123456` |
| `/kitchen` | `mutfak` | `123456` |
| `/waiter` | from the `waiters` table (`ahmet`, …) | set by the admin panel |
