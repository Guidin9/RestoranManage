---
name: deploy
description: Deploy this repo to the live Azure VM with Docker Compose — SSH access, frontend/backend build commands, migrations, StaffSeeder, and the server quirks that bite. Use whenever deploying, restarting, or verifying the live site at restoranmanage.francecentral.cloudapp.azure.com.
---

# Deployment (Azure VM + Docker Compose)

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
