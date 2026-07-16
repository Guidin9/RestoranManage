# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A QR-code restaurant menu system, split into two independent projects that are developed and run separately (no monorepo tooling, no shared package manager, not a git repo):

- `Qr_menu/` — Laravel 13 / PHP 8.3 backend, API-only (MySQL in dev/prod, SQLite in tests)
- `qr-menu-frontend/` — React 19 + Vite SPA serving all four user-facing screens

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

CORS is wide open (`allowed_origins: ['*']`) and must keep allowing the `authorization` header, or every authenticated request fails in the browser.

Cashier and Waiter poll their endpoints on a 3–5s `setInterval`; there is no websocket/broadcast layer.

### Product images go to ImgBB, not to the backend

`Admin.jsx` uploads the file client-side to `api.imgbb.com` and posts only the resulting URL; `AdminController@storeProduct` stores it as a plain string in `products.image`. The key comes from `VITE_IMGBB_API_KEY`; uploads are blocked with a message when it's empty. `Product::getImageUrlAttribute` (appended as `image_url`) passes through anything starting with `http` and otherwise falls back to `asset('storage/'.$image)` for legacy locally-stored files.

Note that any `VITE_*` value is compiled into the client bundle, so the ImgBB key is readable by anyone who views the built JS. That's inherent to uploading direct from the browser; the only real fix is proxying uploads through the backend.

## Gotchas

- **Orders carry no waiter attribution.** `waiter_id` was removed from `Order::$fillable` because no migration ever created the column. Adding attribution needs a migration plus changes to `OrderController@store`.
- **Filename casing.** `App.jsx` imports `./Admin`, `./Cashier`, `./Waiter` — these must keep matching their files exactly, since Windows dev is case-insensitive but the Linux Docker build is not.
- **`Qr_menu/.env` is untracked** and must stay that way — it holds `APP_KEY` and the staff passwords. Only `.env.example` is committed; every deploy copies it and fills in the real values on the target machine.
- **QR codes point at `window.location.origin`**, so they're only correct when generated from the domain customers will actually scan into.

## Styling

Every screen uses inline `style={{}}` objects; there are no component/CSS modules to follow. Tailwind and postcss appear in `qr-menu-frontend/package.json` devDependencies but are not wired up (no config file, no directives in `index.css`) — don't assume Tailwind classes will work. Tailwind *is* fully wired in the backend's own Vite setup (`Qr_menu/vite.config.js`, `resources/css/app.css`), but that pipeline only backs the stock Laravel welcome page at `/` and is unrelated to the product UI.

## Default credentials

Set in `Qr_menu/.env` and seeded by `StaffSeeder`. **Change these before exposing the app.**

| Screen | Username | Password |
|---|---|---|
| `/admin` | `admin` | `admin123` |
| `/cashier` | `kasa` | `123456` |
| `/waiter` | from the `waiters` table (`ahmet`, …) | set by the admin panel |
