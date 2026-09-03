# Ananta CRM — Frontend (Next.js + TypeScript + Tailwind)

## Running

Backend must be running first (`../backend`, see its README) — this app talks to it over `NEXT_PUBLIC_API_URL`
(`.env.local`, defaults to `http://localhost:8000`).

```powershell
npm install
npm run dev
```

Opens on `http://localhost:3000`. Log in with the same account as the Django admin (e.g. `admin` / `AnantaAdmin!2026`
on a fresh local setup).

**Use `localhost`, not `127.0.0.1`, for both frontend and backend.** They're different origins either way (different
ports), but `localhost:3000` and `127.0.0.1:8000` are different *sites* as far as cookies are concerned — the
session cookie silently never gets sent and every request 403s. `localhost:3000` and `localhost:8000` are same-site
(same host, different port), which is what session-cookie auth across two dev servers needs. This tripped up the
very first end-to-end test of this app — worth knowing if a `403 Forbidden` shows up on GETs from a page that should
clearly be authenticated.

## Design system

Sourced from a Stitch-generated design system (`../stitch_export/`) and adapted — not copied 1:1 — into
`src/app/globals.css` as Tailwind v4 `@theme` tokens: a red primary (`primary-500` etc.) used only for actions/active
state/emphasis, warm white/off-white surfaces, Hanken Grotesk for UI text, IBM Plex Mono for tabular figures
(amounts, order numbers). See the 26 reference screens under `../stitch_export/` for the original visual direction —
real screens in this app take creative liberties from those where it improves usability, per direction from the
project owner.

## Auth

Session + CSRF against the Django backend (no token auth — see the backend README for why). `src/lib/auth-context.tsx`
provides `useAuth()`: `{ user, loading, login, logout, can(module, action) }`. `can()` mirrors the backend's RBAC
module × action matrix (`src/lib/modules.ts` — keep in sync with `apps/core/modules.py`) — it's used to hide nav
items and gate UI, but it's a UX convenience, not the security boundary; the backend enforces permissions
independently on every request regardless of what the frontend shows.

`src/app/(app)/layout.tsx` is the protected shell (sidebar + top bar) — redirects to `/login` if `useAuth()` resolves
with no user. `/login` itself lives outside that route group.

## API client

`src/lib/api.ts` — `apiFetch<T>(path, options)` wraps `fetch`: adds credentials, auto-attaches the CSRF token header
on mutating requests (fetching a fresh `csrftoken` cookie first if needed), and throws `ApiError` (with `.status` and
DRF's `.data`) on non-2xx responses.

## What's built so far

- Login, protected app shell (sidebar with RBAC-filtered nav groups, top bar with live notifications dropdown + user
  menu), Dashboard wired to real data (`/api/reports/summary/`, `/api/orders/`, `/api/projects/?status=active`,
  `/api/notifications/`).
- **Full master data CRUD**: Products (modal add/edit), Companies (slide-over with sectioned fields, country picker,
  logo upload), Clients (slide-over with a client-type segmented control, company/country pickers, and the
  fast-track "+ Add new company" inline-create flow), Suppliers (list + a full detail page with Overview/Contacts/
  Products/Files/Activity Log tabs — contact CRUD, product linking, file upload with type selector, and a real
  activity timeline).
- Shared UI primitives: `Button`, `Card`/`CardHeader`, `StatCard`, `StatusPill`, `Modal`, `SlideOver`,
  `ConfirmDialog`, `Toast`, `Field`/`Input`/`Textarea`/`Select`/`FieldGroup`, `Combobox` (searchable picker with an
  optional "+ Add new" fast-track slot), `QuickCreateModal` (the fast-track create-inline flow), `Tabs`,
  `Pagination`, plus `usePaginatedList`/`useList`/`useDebouncedValue` hooks. Every later module (Projects, Orders,
  Quotations, Costing) should reuse these rather than hand-rolling equivalents.

- **Projects**: card-grid list (name, client, status pill, orders/quotations count, total value), a New Project
  modal, and a detail page with Orders/Quotations/Costings tabs — Orders tab is fully live (scoped `?project=` list
  + "+ New Order" that pre-fills the project); Quotations/Costings tabs show an honest "N linked, module coming
  soon" placeholder rather than fake UI, since those modules don't exist yet.
- **Orders**: list with delivery/payment filters, checkbox multi-select + bulk delete, and a full create/edit page —
  header fields (client/project/supplier pickers), an editable line-item table with a live client-side total preview
  that's then re-verified against the server-computed totals on save, a "Copy Order" action, and delivery/payment
  status controls. `/orders/new?project=<id>` pre-fills the project, used by the Projects detail page's "+ New
  Order" button.

- **Quotations**: list, a full create/edit page (client/project pickers with the fast-track "+ Add new client" flow,
  currency auto-derived live from the client's country and shown as a hint on create, editable directly when
  editing), dynamic custom columns (add/rename/remove a column, per-item value cells, all round-tripping correctly
  through save → reload → print), and a **print/preview page that intentionally breaks from the app shell** (its own
  route group, letterhead-style document, "Download PDF" via `window.print()`, "Create Order from this Quotation").
  Verified end-to-end: created a quotation with a custom "Size" column, confirmed it round-tripped correctly through
  edit and rendered on the print view, then used "Create Order from this Quotation" and confirmed the resulting
  order correctly auto-created a matching Product and copied the line item over.
- **Costing**: list and a create/edit page with the same fast-track pattern for Supplier/Product/Client (each can be
  picked or created inline), a line-item table with live per-row and total profit/margin calculation. The Projects
  detail page's Quotations and Costings tabs are now live too (were placeholders before these modules existed).

- **Notifications**: full page (`/notifications`), grouped by Today/Yesterday/Earlier, All/Unread toggle, click to
  mark read, dismiss — plus the top bar's dropdown now links here ("View all notifications").
- **Users**: list with role badges and active/inactive status, add/edit modal, and a dedicated reset-password flow.
  Self-delete stays blocked (no delete action on your own row).
- **Roles & Permissions**: role list (Admin locked, Staff and any custom role editable) + the module × action
  checkbox matrix, `+ Add Role`, `Save Permissions`. Verified the actual write path: toggled Staff's Suppliers/View
  checkbox, saved, confirmed via the API that the row actually changed, then reverted it.
- **Settings**: General / Company Info / Quotation Defaults tabs, all backed by the one `AppSettings` singleton,
  logo/background/signature image uploads. Verified a save round-trips to the database, not just the toast.
- **Reports**: date-range picker, revenue/orders stat cards, a Sales by Product bar list and a Top Clients ranked
  list, both using real proportional bars off actual data — confirmed changing the date range actually re-queries
  (revenue correctly dropped to ₹0 for a range with no orders in it).

This completes every module from the original Stitch screen set (adapted, not copied 1:1, per the "make it
attractive, doesn't need to be exact" direction). Nothing left on the original plan.

## Ideas for a next pass (not started)

Nothing is required, but worth knowing about if this keeps going: no automated test suite yet (everything above was
verified by hand, screen by screen); no dark mode; Combobox/list pickers fetch up to 200 rows client-side rather
than server-side searching, which is fine at this data volume but won't scale indefinitely; Reports has no CSV/PDF
export; and there's no polish pass yet for small screens/tablet (the shell is desktop-first, matching the brief).

## A backend bug this pass caught (fixed, not just noted)

**`useList` assumed every list endpoint returns a bare array.** It didn't — every endpoint except `/api/countries/`
(which explicitly sets `pagination_class = None`) returns DRF's paginated `{count, results: [...]}` shape, so every
picker built on `useList` (client/project/supplier/product comboboxes in the Order form, the client picker in the
Project form) crashed with `products.map is not a function` the first time it was actually exercised in the browser
— caught building the Orders form, fixed once in `src/lib/hooks.ts` (it now unwraps either shape), which silently
fixed the same latent bug in the Projects "New Project" modal too.

**`Modal`/`SlideOver` rendered inline instead of via a portal, breaking any fast-track "+ Add new" flow nested
inside another form.** `QuickCreateModal` (used for "+ Add new client/company/supplier/product" everywhere) renders
its own `<form>`. When `Modal` rendered inline, opening it from inside e.g. `CostingForm`'s `<form>` put that inner
`<form>` in the DOM as a descendant of the outer one — invalid HTML, which browsers silently "fix" by merging the
two, so the inner "Create" button actually submitted the *outer* form instead of running the modal's own submit
handler. It surfaced as the whole page seeming to randomly reset in the middle of the Costing fast-track flow, with
the new supplier/product never actually getting created. Root cause was in the console the whole time (`<form>
cannot be a descendant of <form>`) — fixed at the source in `Modal.tsx`/`SlideOver.tsx` by rendering via
`createPortal(..., document.body)`, which prevents this class of bug for every current and future modal-in-form
case, not just this one.

**Activity log misattribution for child records.** `ModuleViewSet`'s generic create/update/delete logging used
`instance.pk` as the `object_id` — fine for top-level records, but `SupplierContact`/`SupplierProduct` are separate
tables with their own auto-increment sequence, so a contact's own pk could coincidentally collide with an unrelated
supplier's id and show up on the wrong supplier's Activity Log tab. Fixed by adding an overridable
`_log_object_id()`/`_log_details()` hook to `ModuleViewSet` (`apps/core/viewsets.py`) so a child-record viewset can
point logging at its parent instead — verified by deliberately creating enough contacts that the pk diverged from
the supplier id, confirming the log still attributed correctly.

**No way to reset an existing user's password.** `UserSerializer` (used for GET/PATCH) deliberately has no
`password` field — a PATCH with one would've been silently ignored, not errored, which is the kind of bug that's
easy to ship without noticing. `UserCreateSerializer` (POST-only) has one, but only for account creation. Added a
dedicated `set_password` action on `UserViewSet` (`apps/accounts/views.py`) gated on Users/edit, and verified the
whole loop: reset a password through the UI, then logged in with it via a raw `fetch` in a separate, uncredentialed
request to prove it actually took effect server-side.

**Roles & Permissions locked the wrong roles as read-only.** The UI disabled the permission matrix whenever
`role.is_system` was true — but `is_system` only means "protected from deletion" on the backend, and *both* Admin
and Staff are marked that way. That silently made Staff's permissions uneditable too, which defeats the entire
point of the screen (Staff is the one role you'd actually want to tune). Fixed by keying the lock to the Admin role
by name specifically, and confirmed by toggling one of Staff's checkboxes, saving, and checking the change actually
landed via the API.

## A couple of real bugs this first pass caught (fixed, not just noted)

- **Cross-site cookie blocking** — see the `localhost` vs `127.0.0.1` note above.
- **`CSRF_TRUSTED_ORIGINS` missing on the backend** — Django's CSRF check validates the request's `Origin` header
  against this list for any cross-origin mutating request; `CORS_ALLOWED_ORIGINS` alone doesn't satisfy it. Without
  it, every POST/PUT/PATCH/DELETE made *while logged in* (not just cross-site ones) was rejected with "Origin
  checking failed" — caught via the logout button, fixed in `config/settings.py`.
- **Order notification messages showed unrounded amounts** (`"100.0000"` instead of `"₹100.00"`) — `Order.recalc_totals()`
  wasn't quantizing `subtotal` before using it in-memory (qty × rate multiplies out to 4 decimal places even though
  the DB column rounds to 2 on save). Fixed in `apps/orders/models.py`.
