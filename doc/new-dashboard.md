# Customizable Per-User Dashboard

## Context

The current dashboard (`frontend/src/app/(dashboard)/page.tsx` → `components/layout/dashboard-overview.tsx`) is **fixed**: every user sees the same 10 cards in a hard-coded responsive CSS grid (`grid-cols-1 … xl:grid-cols-5`). There is no way to add/remove cards, reorder them, or resize them, and nothing is per-user.

**Goal:** let each user compose their own dashboard — add/remove cards, drag to reposition, resize — with the layout persisted per-user on the server (syncs across devices). Introduce a **Widget Library** (registry) so that adding a new card in the future is just "register it once, user adds it from the library." This plan delivers the engine + migrates the existing 10 cards into the library; future cards are additive.

**Decisions (confirmed with user):**
- Grid engine: **react-grid-layout** (drag + resize + responsive + JSON-serializable layout out of the box).
- Persistence: **server, per-user** via a new `UserProfile.dashboard_layout` JSONB column.
- Card data fetching: **migrate the 10 cards to TanStack Query** (CLAUDE.md mandate) while wrapping them as widgets.
- Customization UX: **explicit Edit/Customize toggle** (static by default; edit mode shows drag handles, resize, remove, and "Add card").

## Current State (from exploration)

- Orchestrator: `components/layout/dashboard-overview.tsx` — 5 inline stat cards (4 from `nautobot/stats`, 1 from `checkmk/stats`) + 5 component cards.
- Component cards: `components/layout/dashboard-{job-stats,device-backup-status,checkmk-sync-status,scan-prefix-stats,ip-addresses-stats}.tsx` — each fetches via `useApi` + `useEffect`, takes a `refreshTrigger` prop.
- No TanStack Query in the dashboard today (it is installed and used elsewhere); manual `localStorage` cache for stats.
- `@dnd-kit` is installed but only does drag — react-grid-layout is the right tool for drag **+ resize**.
- Backend per-user data lives on `UserProfile` (`backend/core/models/users.py`), wired through `repositories/auth/profile_repository.py` → `services/auth/profile_service.py` → `routers/auth/profile.py`. JSONB is already used elsewhere (`core/models/servers.py`); schema changes auto-apply on startup (`AutoSchemaMigration`), no migration file needed.
- Frontend calls backend via `useApi` → `/api/proxy/*`. Query keys live in `lib/query-keys.ts`, query hooks in `hooks/queries/`.

---

## Backend — persist per-user layout

Mirror the existing profile CRUD pattern. Trace the value through **all** layers (CLAUDE.md end-to-end wiring rule) and verify it persists.

1. **Model** — `backend/core/models/users.py`, `UserProfile`: add
   `dashboard_layout = Column(JSONB, nullable=True)` (import `from sqlalchemy.dialects.postgresql import JSONB`). Column auto-creates on startup.
2. **Pydantic** — `backend/models/auth.py`: add `DashboardLayoutResponse` and `DashboardLayoutUpdateRequest` (a single `layout: dict` field holding the versioned layout document — see schema below). Validate it is a dict; reject oversized payloads.
3. **Repository** — `backend/repositories/auth/profile_repository.py`: add `get_dashboard_layout(username)` and `set_dashboard_layout(username, layout)` (create profile row if absent, like existing methods). ORM only — no `text()`.
4. **Service** — `backend/services/auth/profile_service.py`: add `get_dashboard_layout(username)` (return stored dict or `None`) and `update_dashboard_layout(username, layout)`.
5. **Router** — `backend/routers/auth/profile.py`: add
   - `GET /profile/dashboard-layout` → `{ success, data: layout | null }`
   - `PUT /profile/dashboard-layout` → save and return the saved layout.
   Use `Depends(get_current_username)` (same as the existing profile routes — a user only ever reads/writes their own layout). On 5xx, use `core.safe_http_errors.raise_internal_server_error` (never raw `str(e)` in detail).
   Router is already registered; no `main.py` change.

**Layout document schema** (stored in the JSONB column, opaque to the backend):
```json
{
  "version": 1,
  "layouts": { "lg": [ { "i": "nautobot-devices", "x": 0, "y": 0, "w": 3, "h": 2 } ], "md": [ ... ], "sm": [ ... ] }
}
```
The set of `i` keys present = the user's active widgets. `version` lets us migrate the schema later.

---

## Frontend — widget library + grid engine

New feature folder per CLAUDE.md (`components/features/{domain}/`); route file becomes a stub.

### Dependency
- Add `react-grid-layout` + `@types/react-grid-layout`. Its peer dep is open-ended (`react >= 16.3`), so React 19 installs cleanly.
- Import the RGL stylesheets once (in the dashboard feature component): `react-grid-layout/css/styles.css` and `react-resizable/css/styles.css`.

### Files
```
frontend/src/components/features/dashboard/
  dashboard-page.tsx              # 'use client'; owns edit mode + composes toolbar + grid
  components/
    dashboard-toolbar.tsx         # title, Customize/Done, Add card, Reset, Refresh
    dashboard-grid.tsx            # WidthProvider(Responsive) RGL; maps active layout → widget shells
    widget-shell.tsx              # shared frame: drag handle (.drag-handle) + remove ✕ (edit mode only)
  dialogs/
    add-widget-dialog.tsx         # Shadcn Dialog listing library widgets not yet on the board
  widgets/                        # one self-contained component per card (fetches own data)
    nautobot-devices-widget.tsx   nautobot-locations-widget.tsx
    nautobot-ip-addresses-widget.tsx  nautobot-prefixes-widget.tsx
    checkmk-hosts-widget.tsx      failed-jobs-widget.tsx
    device-backup-widget.tsx      checkmk-sync-widget.tsx
    network-scan-widget.tsx       stale-ip-addresses-widget.tsx
  registry/
    widget-registry.tsx           # THE LIBRARY: id → { title, description, icon, defaultSize {w,h,minW,minH}, component }
  constants/
    default-layout.ts             # default layout doc for users with no saved layout
  types/
    dashboard.ts                  # WidgetId, WidgetDefinition, DashboardLayoutItem, DashboardLayoutDoc
```

### Widget Library (registry) — the extensibility mechanism
`widget-registry.tsx` exports a typed map keyed by stable `WidgetId`. Each entry:
```ts
{ id, title, description, icon, defaultSize: { w, h, minW, minH }, component }
```
- `dashboard-grid.tsx` looks up each active layout item's `i` in the registry to render its `component` inside a `widget-shell`.
- `add-widget-dialog.tsx` lists registry entries **not** currently on the board; selecting one appends it at its `defaultSize`.
- **Adding a future card = add one registry entry + one widget component.** Nothing else changes. (Documents the user's "Dashboard Library" requirement.)
- Unknown `i` (e.g. a removed widget id still in a saved layout) is skipped gracefully.

### Card migration to TanStack Query
- Add query keys under `lib/query-keys.ts` (`dashboard.*`) and hooks in `hooks/queries/`:
  - `use-nautobot-stats-query.ts` (`nautobot/stats`) — shared by the 4 Nautobot stat widgets (one fetch, deduped by cache).
  - `use-checkmk-stats-query.ts` (`checkmk/stats`).
  - `use-job-stats-query.ts`, `use-device-backup-query.ts`, `use-checkmk-sync-query.ts`, `use-scan-prefix-query.ts`, `use-ip-addresses-query.ts` for the 5 component cards.
- Each widget calls its query hook (no more `refreshTrigger` prop / manual `useEffect`). Match `staleTime` to volatility; "Refresh" in the toolbar calls `queryClient.invalidateQueries` for the `dashboard` key. Port existing card JSX/modals largely as-is; replace only the data layer.
- Layout hooks: `use-dashboard-layout-query.ts` (GET) and `use-dashboard-layout-mutations.ts` (PUT, invalidates the layout key on success, toast on error) — follow the CLAUDE.md query/mutation patterns.

### Edit mode & persistence flow
- `dashboard-page.tsx`: `isEditing` state. Default view = static (RGL `isDraggable={false} isResizable={false}`, no handles/remove).
- "Customize" → edit mode: RGL draggable/resizable via `draggableHandle=".drag-handle"`, shells show handle + ✕, toolbar shows "Add card" + "Reset to default".
- RGL `onLayoutChange(_, allLayouts)` updates local layout state during editing.
- "Done" → PUT the `{ version, layouts }` doc via the mutation; exit edit mode.
- On load: layout query → if `data` is null/empty, seed from `constants/default-layout.ts` (the current 10-card arrangement) so existing users see no regression.
- "Reset to default" restores the default doc (persisted on Done).

### Route stub
`frontend/src/app/(dashboard)/page.tsx` becomes a pure stub (CLAUDE.md route rule):
```tsx
import { DashboardPage } from '@/components/features/dashboard/dashboard-page'
export default function DashboardRoute() { return <DashboardPage /> }
```
Once verified, remove the old `components/layout/dashboard-overview.tsx` and the 5 `components/layout/dashboard-*.tsx` files (their logic now lives in `widgets/`); grep to confirm no remaining imports.

---

## Verification

**Backend**
```bash
cd backend
ruff format . && ruff check --fix .
pytest -q
python scripts/check_text_sql.py && python scripts/check_http_500_leaks.py && python scripts/check_router_repositories.py
```
- Start backend; confirm the `dashboard_layout` column was auto-created on `user_profiles` (psql `\d user_profiles`).
- Hit `PUT /api/proxy/profile/dashboard-layout` with a sample doc, then `GET` it back — confirm it **persists to the DB** (re-query after restart), per the end-to-end wiring rule.

**Frontend**
```bash
cd frontend
npm install            # picks up react-grid-layout
npm run lint
```
- Run the app (`/run` or backend `python start.py` + `frontend npm run dev`, login admin/admin).
- Use Playwright MCP to drive the dashboard:
  1. Load `/` — default 10 cards render (existing user sees no regression).
  2. Click Customize → drag a card, resize a card, remove a card, Add card from the library dialog.
  3. Click Done → reload page → layout is exactly as left (server-persisted).
  4. Confirm in a second browser/session for the same user that the layout follows them.
  5. Reset to default → confirm the original arrangement returns.

## Out of scope / follow-ups
- New widgets beyond the existing 10 (the library makes these additive — register + component).
- Multiple named dashboards/tabs per user (current scope = one layout per user).
- Admin-defined org default layout (the per-user default lives in `constants/default-layout.ts`).
