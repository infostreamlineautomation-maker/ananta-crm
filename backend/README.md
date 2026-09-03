# Ananta CRM — Backend (Django + DRF + PostgreSQL)

## First-time setup

Already done on this machine: `ananta_crm` database + `ananta_app` user created in the local
Postgres 18 install, `.venv` created, dependencies installed, migrations applied, baseline data
seeded, superuser created (`admin` / `AnantaAdmin!2026` — change this).

On a different machine:

```powershell
py -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env   # then fill in DB_PASSWORD for a Postgres user you've created
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py seed_initial_data
.venv\Scripts\python manage.py createsuperuser
```

## Running

```powershell
.venv\Scripts\python manage.py runserver
```

- API: `http://127.0.0.1:8000/api/`
- Django admin (useful for poking at data before the frontend exists): `http://127.0.0.1:8000/admin/`

## Auth flow (session + CSRF, like a real browser client)

1. `GET /api/auth/csrf/` → sets a `csrftoken` cookie, returns it in the body too.
2. `POST /api/auth/login/` with `{"username", "password"}` and header `X-CSRFToken: <token>` → sets the session cookie.
3. Every subsequent request sends the session cookie; state-changing requests (POST/PUT/PATCH/DELETE) also need the `X-CSRFToken` header.
4. `GET /api/auth/me/` → current user + their full module × action permission matrix (frontend uses this to show/hide UI, not as the source of truth — the API enforces it server-side regardless).

## What's built so far

The full API layer is done — every module from the audit has a working, permission-checked endpoint.

- **RBAC**: `Role` / `RolePermission` — a module × (view/add/edit/delete) matrix, enforced server-side
  on every endpoint via `ModulePermission`. Two seeded roles, Admin (full access) and Staff (scoped,
  matching legacy behavior) — add more roles and edit the matrix from `/api/auth/roles/`.
- **Master data**: Countries (reference data, read-only), Companies, Clients (currency auto-derives
  from the client's or parent company's country), Products, Suppliers (+ contacts, linked products,
  file uploads with content-sniffed validation and the legacy duplicate-name/contact guard).
- **Projects**: groups one client's related orders, quotations, and costing sheets under a single
  engagement (`/api/projects/`, summary counts + total order value per project). Attaching an
  order/quotation/costing to a project is optional — standalone one-off jobs don't need one.
- **Orders**: multi-line (`OrderItem`), auto-numbered `ORD-YYYY-NNNN`, totals always recalculated
  server-side (`Order.recalc_totals()` — never trusts a client-submitted total), staff/admin
  visibility scoping, a `/copy/` action mirroring the legacy "Copy Order" flow.
- **Quotations**: multi-line with dynamic custom columns (`columns_config` / `extra_data`) and a real
  `image` field per line item, auto-numbered from the Settings prefix, currency defaults from the
  client's country. A `/create-order/` action does the one-off "convert to order" copy we agreed on
  (no stored link kept afterward) — quotation line items aren't tied to a catalog Product, so this
  resolves/creates one from each item's description on the way in.
- **Costing**: real FKs to Supplier/Product/Client (fixed from the legacy free-text version) with the
  same "fast-track" UX — pass an id, or a `*_name` string to find-or-create — resolved to a real row
  *before* saving, not matched by name after the fact.
- **Notifications**: a real, persisted event log (`Notification` + per-user `NotificationRead`),
  populated by signals in `apps/orders/signals.py` when an order is created or its payment/delivery
  status changes — replacing the legacy app's "recompute from order state every request" approach.
- **Settings**: singleton resource at `/api/settings/` (GET needs Settings/view, PATCH needs
  Settings/edit).
- **Reports**: `/api/reports/summary/`, `/sales-by-product/`, `/top-clients/`, all accepting
  `?date_from=&date_to=` and gated on the Reports module.

All of this was tested live end-to-end during development (not just unit-level): logged in as both
an Admin and a scoped Staff user, created linked records across every module, verified the RBAC
matrix actually blocks a Staff user from deleting a client or listing Users (403), and confirmed
order/quotation totals and the quotation→order conversion compute correctly.

## Project layout

```
backend/
  config/            Django project settings, root urls
  apps/
    core/            shared mixins, Country, ActivityLog, RBAC-adjacent permission module registry
    accounts/        User, Role, RolePermission, auth endpoints
    clients/         Company, Client
    catalog/         Product
    suppliers/       Supplier, contacts, products, file uploads
    projects/        Project — groups a client's orders/quotations/costings
    orders/          Order, OrderItem — auto-numbered, server-computed totals, /copy/
    quotations/      Quotation, QuotationItem — dynamic columns, /create-order/
    costing/         Costing, CostingItem — FK-based margin calculator
    notifications/   Notification, NotificationRead — event-sourced via orders/signals.py
    siteconfig/      AppSettings singleton
    reports/         Read-only aggregation endpoints (no models)
```

## Hardening pass (post-first-build)

- **Numbering race condition fixed**: order/quotation numbers now come from a locked
  `NumberSequence` counter row (`apps/core/numbering.py`) instead of scanning `MAX(existing number)`,
  which could let two concurrent requests compute the same next value.
- **Audit trail generalized**: `ModuleViewSet`/`SoftDeleteModuleViewSet` (`apps/core/viewsets.py`) now
  write an `ActivityLog` row on every create/update/delete, for every module — previously only
  Suppliers logged anything.
- **Login throttling**: 5 attempts/minute per IP on `/api/auth/login/` (`DEFAULT_THROTTLE_RATES` in
  settings) — the legacy app had no brute-force protection at all.
- **Auth simplified to session + CSRF only**: dropped `TokenAuthentication` (it was declared but
  never actually wired up to issue tokens, and would have errored if exercised — no
  `rest_framework.authtoken` app was installed). An httpOnly session cookie is a better fit for a
  same-site Next.js frontend than a JS-readable token; revisit only if a non-browser API client
  (e.g. a mobile app) shows up later.

## Notes

- `.env` holds real local DB credentials — never commit it (already in `.gitignore`).
- Image uploads (order/quotation item photos, company/settings logos) use Django's `ImageField`,
  which validates real image content via Pillow and rejects SVG — closing the stored-SVG-script
  risk flagged in the legacy app's audit.
- Non-image uploads (supplier brochures/rate cards) are validated by both extension and magic-byte
  content sniffing, with a 10MB cap — see `apps/core/validators.py`.
