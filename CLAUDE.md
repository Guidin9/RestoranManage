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
composer dev                      # serve + queue:listen + vite concurrently

composer test                     # or: php artisan test  (Pest 4)
php artisan test --filter=AuthTest
./vendor/bin/pest tests/Feature/AuthTest.php
./vendor/bin/pint                 # formatter (codebase is NOT pint-clean; scope it to files you touch)

# Re-provision only the admin/cashier accounts after changing their .env credentials.
# Never run a bare `db:seed` against a populated DB — DatabaseSeeder uses create()
# and will duplicate the waiters, tables, and products.
php artisan db:seed --class=StaffSeeder
```

Tests run against SQLite `:memory:` (configured in `phpunit.xml`), so no MySQL is needed for the suite. `RefreshDatabase` is commented out in `tests/Pest.php`, so test files that touch the DB must `uses(RefreshDatabase::class)` themselves.

Frontend (run from `qr-menu-frontend/`):

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
npm run lint      # oxlint, not eslint
npm run preview
```

## Deployment (Azure VM + Docker Compose)

Live on an Azure Linux VM. Access: `ssh -i <RestoranManage_key.pem> Gui@20.19.211.64`;
repo at `~/RestoranManage`. Root `docker-compose.yml` defines four services — `caddy`,
`frontend`, `backend`, `db` — and the root `.env` (copied from `.env.example`) supplies
config. `SITE_ADDRESS` is the single source of truth for the public host; `APP_URL` and
`VITE_API_URL` derive from it.

Server specifics that bite:
- **Use `sudo docker compose` (V2, space).** The old `docker-compose` (V1, hyphen) is
  still installed but is broken against BuildKit images (`KeyError: 'ContainerConfig'`);
  don't use it. `docker` needs `sudo` here — the `Gui` user isn't in the `docker` group.
- **Deploy a code change:** `git pull && sudo docker compose up -d --build <service>`.
  For a UI-only change that's `--build frontend` (30–60 s, backend/db untouched).
- **Never `down -v`** — that deletes the `restoranmanage_db_data` volume (real data).
- Provision/refresh staff after editing `.env`:
  `sudo docker compose exec -T backend php artisan db:seed --class=StaffSeeder --force`.
- `APP_KEY`: generate on the server with `echo "base64:$(openssl rand -base64 32)"` —
  `artisan key:generate` can't run before Compose validates the (still-empty) `APP_KEY`.

## Architecture

### Routing: hand-rolled, no react-router

`src/App.jsx` is both the customer menu screen and the app's router. It reads `window.location.pathname` directly and returns a different component per path:

- `/cashier` → `Cashier.jsx` (active tabs, close/pay)
- `/waiter` → `Waiter.jsx` (table occupancy grid, add/remove items)
- `/admin` → `admin.jsx` (CRUD for waiters, tables, categories, products)
- anything else → the customer menu, which requires a `?table=<uuid>` query param and 404s the QR lookup without it

Adding a screen means adding another pathname check in `App.jsx`. Vite's dev server falls back to `index.html` in dev; in production `qr-menu-frontend/nginx.conf` does the same via `try_files ... /index.html`, which is what keeps a hard load of `/cashier` from 404ing.

### Order lifecycle

`Table` (has a UUID `qr_code`) → `Order` (`status`: active/paid/cancelled) → `OrderItem` → `Product` → `Category`. `Waiter` stands alone.

A table has at most one open tab, enforced by `Order::firstOrCreate(['table_id' => ..., 'status' => 'active'])` in `OrderController@store` — repeat orders from the same table append `OrderItem`s to the existing order rather than creating a new one. "Occupied" is derived, not stored: a table is occupied iff an active order references it.

Closing a tab sets `status = 'paid'`, which is what frees the table. Note `OrderController@removeOrderItem` also flips an order to `paid` once its last item is removed — emptying a tab and paying a tab are the same terminal state.

`order_items.price_at_sale` snapshots the product price at order time so menu edits don't retroactively change open or historical tabs. Read totals from it, never from `products.price`.

`Table` auto-generates `qr_code` on create (model `booted()` hook), and `OrderController@waiterTables` additionally back-fills any `NULL` qr_code on read.

### Authentication: Sanctum tokens with role abilities

All logins live in `AuthController` and return a real Sanctum token. Two models hold tokens (Sanctum resolves `tokenable` polymorphically, and its service provider auto-registers the `sanctum` guard, so `config/auth.php` needs no guard entry):

- **`User`** — the fixed admin and cashier accounts, distinguished by a `role` column. Credentials come from `config/staff.php` (backed by `.env`), and `StaffSeeder` writes them to the DB. Login matches on `username` **and** `role`, so the cashier account cannot log in through the admin endpoint.
- **`Waiter`** — staff created via the admin panel. Passwords use the `hashed` cast and are in `$hidden`.

Authorization is by **token ability**, not by role lookup at request time:

| Login | Abilities on the token |
|---|---|
| admin | `admin`, `cashier`, `waiter` |
| cashier | `cashier` |
| waiter | `waiter` |

Admin gets all three because the admin panel calls `/api/waiter/tables` and `/api/waiter/menu` for its own screens. Routes are grouped under `auth:sanctum` plus an `abilities:<name>` check; the `abilities` alias is registered in `bootstrap/app.php` (Sanctum does not alias it by default). Wrong ability → 403, missing/revoked token → 401.

**Deliberately still public:** `GET /api/menu/{tableUuid}` and `POST /api/orders`. Customers have no accounts, so anyone with a table UUID can read the menu and place an order against that table. This is inherent to the QR flow — don't "fix" it by adding auth without redesigning how customers order.

Frontend tokens live in localStorage (`admin_token`, `cashier_token`, `waiter_token`) and are attached by `apiFetch`. Logout calls `POST /api/logout`, which deletes the current token server-side.

### API layer: always go through `src/api.js`

Every screen imports `apiFetch` from `src/api.js`, which owns the base URL (`VITE_API_URL`, falling back to `http://127.0.0.1:8000`), attaches `Authorization: Bearer`, and converts 401/403 into an `UnauthorizedError` after clearing the stored token. Screens catch that to drop back to their login form. Don't reintroduce bare `fetch` against the API — the one legitimate raw `fetch` is the ImgBB upload, which is a third-party host.

CORS is wide open (`allowed_origins: ['*']`) and must keep allowing the `authorization` header, or every authenticated request fails in the browser. It only actually matters in dev: the SPA on :5173 is cross-origin against the API on :8000. In production `Caddyfile` proxies `/api/*` to the backend from the same host, so `VITE_API_URL` is just the site's own origin and requests are same-origin.

Production topology is four containers — `caddy` (terminates TLS, routes `/api/*`, `/up`, `/storage/*` to backend, everything else to frontend), `frontend`, `backend`, `db`. Only Caddy publishes ports; the backend is unreachable from outside the Docker network. Because TLS ends at Caddy, `bootstrap/app.php` sets `trustProxies(at: '*')` — without it `asset()` emits `http://` URLs that a HTTPS page blocks.

Cashier and Waiter poll their endpoints on a 3–5s `setInterval`; there is no websocket/broadcast layer.

### Product images go to ImgBB, not to the backend

`Admin.jsx` uploads the file client-side to `api.imgbb.com` and posts only the resulting URL; `AdminController@storeProduct` stores it as a plain string in `products.image`. The key comes from `VITE_IMGBB_API_KEY`; uploads are blocked with a message when it's empty. `Product::getImageUrlAttribute` (appended as `image_url`) passes through anything starting with `http` and otherwise falls back to `asset('storage/'.$image)` for legacy locally-stored files.

Note that any `VITE_*` value is compiled into the client bundle, so the ImgBB key is readable by anyone who views the built JS. That's inherent to uploading direct from the browser; the only real fix is proxying uploads through the backend.

## Gotchas

- **Orders carry no waiter attribution.** `waiter_id` was removed from `Order::$fillable` because no migration ever created the column. Adding attribution needs a migration plus changes to `OrderController@store`.
- **Filename casing.** `App.jsx` imports `./Admin`, `./Cashier`, `./Waiter` — these must keep matching their files exactly, since Windows dev is case-insensitive but the Linux Docker build is not.
- **`Qr_menu/.env` is untracked** and must stay that way — it holds `APP_KEY` and the staff passwords. Only `.env.example` is committed; every deploy copies it and fills in the real values on the target machine.
- **QR codes point at `window.location.origin`**, so they're only correct when generated from the domain customers will actually scan into.

## Styling — "Liquid Glass" design system

All four screens share **one central stylesheet, `src/index.css`**, written as a
glassmorphism ("liquid glass") design system. Screens are styled with `className`, not
inline `style` objects. When adding or changing UI, reach for an existing class first and
only add new rules to `index.css`; keep inline `style` for one-off layout tweaks
(spacing, grid template) — not for colors, surfaces, or anything themable.

**Design tokens** live in `:root` (and a `@media (prefers-color-scheme: light)` override):
`--glass-bg` / `--glass-bg-strong` / `--glass-border` (frosted surfaces), `--accent` +
`--accent-grad` (violet→magenta), `--success`/`--danger`/`--info` and their `-grad`
variants, `--radius*`, and easing curves `--ease-spring` / `--ease-out`. Use the tokens;
don't hardcode hex colors in components.

**Core classes** (all defined in `index.css`):
- Layout: `.page` / `.page--narrow`, `.topbar`, `.row-between`, `.stack`, `.grid` + `.grid-cards` / `.grid-tables` / `.grid-wide`
- Surfaces: `.glass`, `.card` (frosted panel with hover-lift + light-sweep), `.subpanel`
- Buttons: `.btn` + `.btn-primary` / `.btn-success` / `.btn-danger` / `.btn-block` / `.btn-sm` / `.btn-icon`
- Forms: `.field`, `.label`, `.input`, `.select`, `.form-inline`
- Auth screens: `.login-wrap`, `.login-card`, `.login-emoji`, `.login-sub`, `.alert`
- Bits: `.badge` (+ `-success`/`-danger`/`-accent`), `.dot-live` (pulsing), `.tabs`/`.tab`, `.modal-overlay`/`.modal`/`.modal-close`, `.empty` (empty state), `.spinner`
- Menu-specific: `.cat-block`/`.cat-title`, `.prod-list`/`.prod-row`/`.prod-thumb`, `.stepper`/`.qty-btn`, `.cart-bar`
- Table map: `.table-card` + `.table-card--free` / `.table-card--busy`

**Animation conventions:** the background is an animated aurora on `body::before`. Cards
enter with a staggered reveal — add `className="... reveal"` and `style={{ '--i': index }}`
so each item's `animation-delay` steps off its index. Hover lifts, the modal springs in
(`pop-in`), the live dot pulses. All keyframes are in `index.css`; a
`@media (prefers-reduced-motion: reduce)` block disables them for accessibility. Keep new
motion in that same system rather than inventing per-component animations.

**Preserve logic when restyling.** The screens' data flow (`apiFetch`, `useState`,
handlers) must stay intact — change the presentation (`className`, wrapper structure)
only. Never touch `src/api.js` for a styling change.

Tailwind and postcss appear in `package.json` devDependencies but are **not wired up** (no
config, no directives) — `className="flex gap-4"` does nothing. Tailwind *is* wired in the
backend's own Vite setup (`Qr_menu/vite.config.js`), but that only backs the stock Laravel
welcome page at `/` and is unrelated to the product UI.

The design work happens on the **`dev` branch**; see `qr-menu-frontend/TASARIM.md` for the
full UI workflow (local dev, deploy). Deploy a UI change with:
`git pull && sudo docker compose up -d --build frontend` on the server.

## Default credentials

These are the **local-dev** defaults, set in `Qr_menu/.env` and seeded by `StaffSeeder`.
Production uses different passwords (set in the server's root `.env`; not in the repo).

| Screen | Username | Password (local dev) |
|---|---|---|
| `/admin` | `admin` | `admin123` |
| `/cashier` | `kasa` | `123456` |
| `/waiter` | from the `waiters` table (`ahmet`, …) | set by the admin panel |
