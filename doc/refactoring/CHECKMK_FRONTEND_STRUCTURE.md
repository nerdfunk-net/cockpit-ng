# CheckMK Feature: Directory Structure Refactoring Plan

## Overview

The CheckMK feature (`frontend/src/components/features/checkmk/`) contains four separately routed apps:

| App | Route | Main Page Component |
|-----|-------|---------------------|
| CheckMK / Sync Devices | `/checkmk/sync-devices` | `sync-devices/sync-devices-page.tsx` |
| CheckMK / Diff Viewer | `/checkmk/diff-viewer` | `diff-viewer/diff-viewer-page.tsx` |
| CheckMK / Hosts & Inventory | `/checkmk/hosts-inventory` | `hosts-inventory/hosts-inventory-page.tsx` |
| CheckMK / Tools | `/checkmk/tools` | `tools/tools-page.tsx` |

Each sub-app already has its own sub-directory, which is correct. However, each sub-directory does **not** implement the standard structure defined in `CLAUDE.md`. This document describes the gaps and the plan to close them.

> **Note:** The actual feature root is `frontend/src/components/features/checkmk/`, not `frontend/src/features/checkmk/`.

---

## Current State

### Directory Tree (as-is)

```
frontend/src/components/features/checkmk/
├── diff-viewer/
│   ├── api/                             ← non-standard (maps to utils/)
│   │   └── diff-viewer.api.ts
│   ├── components/
│   │   ├── diff-device-table.tsx
│   │   ├── diff-stats-cards.tsx
│   │   ├── diff-table-header.tsx
│   │   ├── diff-table-row.tsx
│   │   ├── diff-viewer-header.tsx
│   │   └── system-badge.tsx
│   ├── hooks/
│   │   ├── use-diff-device-loader.ts
│   │   └── use-diff-filters.ts
│   └── diff-viewer-page.tsx
│
├── hosts-inventory/
│   ├── hooks/
│   │   ├── use-checkmk-config.ts
│   │   ├── use-hosts-filter.test.ts
│   │   ├── use-hosts-filter.ts
│   │   ├── use-hosts-filter.ts.bak      ← DELETE (stale backup)
│   │   ├── use-hosts-pagination.ts
│   │   ├── use-hosts-selection.ts
│   │   ├── use-modal-state.ts
│   │   ├── use-nautobot-sync.ts
│   │   └── use-status-message.ts
│   ├── queries/                         ← non-standard (merge into hooks/)
│   │   └── use-checkmk-hosts-query.ts
│   └── hosts-inventory-page.tsx
│
├── modals/                              ← non-standard (replace with dialogs/ inside each sub-app)
│   ├── components/
│   │   ├── index.ts
│   │   ├── sync-form-footer.tsx
│   │   ├── sync-loading-state.tsx
│   │   ├── sync-modal-header.tsx
│   │   └── validation-results-modal.tsx
│   ├── device-sync-modal.tsx
│   ├── host-details-modal.tsx
│   ├── interface-mapping-table.tsx
│   ├── inventory-modal.tsx
│   └── sync-to-nautobot-modal.tsx      ← DELETE (superseded by device-sync-modal.tsx)
│
├── renderers/                           ← non-standard (move into hosts-inventory/components/)
│   ├── inventory-renderer.tsx
│   └── json-renderer.tsx
│
├── sync-devices/
│   ├── api/                             ← non-standard (maps to utils/)
│   │   └── sync-devices.api.ts
│   ├── components/
│   │   ├── active-tasks-panel.tsx
│   │   ├── add-device-modal.tsx
│   │   ├── device-table-header.tsx
│   │   ├── device-table-row.tsx
│   │   ├── device-table.tsx
│   │   ├── diff-modal.tsx              ← used by diff-viewer too → move to shared/
│   │   ├── job-controls-panel.tsx      ← used by diff-viewer too → move to shared/
│   │   ├── status-message-card.tsx     ← used by diff-viewer too → move to shared/
│   │   └── sync-devices-header.tsx
│   ├── hooks/
│   │   ├── use-device-filters.ts
│   │   ├── use-device-loader.ts
│   │   ├── use-device-operations.ts
│   │   ├── use-device-selection.ts
│   │   ├── use-diff-comparison.ts      ← used by diff-viewer too → move to shared/
│   │   ├── use-job-management.ts       ← used by diff-viewer too → move to shared/
│   │   ├── use-status-messages.ts      ← used by diff-viewer too → move to shared/
│   │   └── use-task-tracking.ts
│   └── sync-devices-page.tsx
│
└── tools/
    ├── components/
    │   └── activation-status-card.tsx
    ├── hooks/
    │   └── queries/                     ← non-standard (flatten into hooks/)
    │       ├── use-checkmk-changes-query.ts
    │       └── use-checkmk-discovery-mutations.ts
    ├── tabs/
    │   ├── changes-tab.tsx
    │   └── discovery-tab.tsx
    └── tools-page.tsx
```

### Files Currently Living Outside the Feature Directory

These files belong to the CheckMK feature but are scattered across unrelated top-level directories:

| Current Location | Belongs To |
|------------------|------------|
| `src/types/features/checkmk/sync-devices.ts` | `sync-devices/types/` |
| `src/types/features/checkmk/diff-viewer.ts` | `diff-viewer/types/` |
| `src/types/checkmk/types.ts` | `hosts-inventory/types/` |
| `src/utils/features/checkmk/sync-devices/diff-helpers.ts` | `sync-devices/utils/` |
| `src/utils/features/checkmk/sync-devices/badge-helpers.tsx` | `sync-devices/utils/` |
| `src/utils/features/checkmk/sync-devices/ui-helpers.ts` | `sync-devices/utils/` |
| `src/lib/checkmk/property-mapping-utils.ts` | `hosts-inventory/utils/` |
| `src/lib/checkmk/interface-mapping-utils.ts` | `hosts-inventory/utils/` |

---

## Gaps vs. CLAUDE.md Standard

| Gap | Description |
|-----|-------------|
| Missing `types/` inside each sub-app | Types live in 3 separate external locations (`src/types/checkmk/`, `src/types/features/checkmk/`, and external libs) |
| Missing `utils/` inside each sub-app | Utilities live in `src/utils/features/checkmk/` and `src/lib/checkmk/` — outside the feature |
| Missing `dialogs/` directory | Modals use a shared root-level `modals/` folder instead of being co-located inside each sub-app |
| Non-standard `api/` sub-folder | `sync-devices/api/` and `diff-viewer/api/` contain raw fetch utilities not mentioned in the standard — these belong in `utils/` |
| Non-standard `queries/` in `hosts-inventory` | TanStack Query hooks should live in `hooks/`, not a separate `queries/` sub-folder |
| Non-standard `hooks/queries/` in `tools` | Same issue — nested `queries/` inside `hooks/` is a third inconsistent pattern |
| Non-standard `renderers/` at checkmk root | Should be inside `hosts-inventory/components/` since only that sub-app uses them |
| Cross-app sibling coupling | `diff-viewer-page.tsx` imports hooks and components from `sync-devices/` directly — creates fragile coupling |
| Stale files | `use-hosts-filter.ts.bak` and `sync-to-nautobot-modal.tsx` should be deleted |
| Naming inconsistency (`modal` vs `dialog`) | CLAUDE.md uses `dialogs/` but all current modal files are named `*-modal.tsx` |

---

## Target Structure (to-be)

```
frontend/src/components/features/checkmk/
│
├── shared/                              ← NEW: cross-app shared resources
│   ├── components/
│   │   ├── diff-modal.tsx              ← moved from sync-devices/components/
│   │   ├── job-controls-panel.tsx      ← moved from sync-devices/components/
│   │   └── status-message-card.tsx     ← moved from sync-devices/components/
│   └── hooks/
│       ├── use-diff-comparison.ts      ← moved from sync-devices/hooks/
│       ├── use-job-management.ts       ← moved from sync-devices/hooks/
│       └── use-status-messages.ts      ← moved from sync-devices/hooks/
│
├── sync-devices/
│   ├── components/
│   │   ├── active-tasks-panel.tsx
│   │   ├── add-device-modal.tsx
│   │   ├── device-table-header.tsx
│   │   ├── device-table-row.tsx
│   │   ├── device-table.tsx
│   │   └── sync-devices-header.tsx
│   ├── hooks/
│   │   ├── use-device-filters.ts
│   │   ├── use-device-loader.ts
│   │   ├── use-device-operations.ts
│   │   ├── use-device-selection.ts
│   │   └── use-task-tracking.ts
│   ├── types/
│   │   └── index.ts                    ← moved from src/types/features/checkmk/sync-devices.ts
│   ├── utils/
│   │   ├── sync-devices.api.ts         ← moved from api/sync-devices.api.ts
│   │   ├── diff-helpers.ts             ← moved from src/utils/features/checkmk/sync-devices/
│   │   ├── badge-helpers.tsx           ← moved from src/utils/features/checkmk/sync-devices/
│   │   └── ui-helpers.ts              ← moved from src/utils/features/checkmk/sync-devices/
│   └── sync-devices-page.tsx
│
├── diff-viewer/
│   ├── components/
│   │   ├── diff-device-table.tsx
│   │   ├── diff-stats-cards.tsx
│   │   ├── diff-table-header.tsx
│   │   ├── diff-table-row.tsx
│   │   ├── diff-viewer-header.tsx
│   │   └── system-badge.tsx
│   ├── hooks/
│   │   ├── use-diff-device-loader.ts
│   │   └── use-diff-filters.ts
│   ├── types/
│   │   └── index.ts                    ← moved from src/types/features/checkmk/diff-viewer.ts
│   ├── utils/
│   │   └── diff-viewer.api.ts          ← moved from api/diff-viewer.api.ts
│   └── diff-viewer-page.tsx
│
├── hosts-inventory/
│   ├── components/
│   │   ├── inventory-renderer.tsx      ← moved from renderers/
│   │   └── json-renderer.tsx           ← moved from renderers/
│   ├── dialogs/
│   │   ├── host-details-dialog.tsx     ← moved+renamed from modals/host-details-modal.tsx
│   │   ├── inventory-dialog.tsx        ← moved+renamed from modals/inventory-modal.tsx
│   │   ├── device-sync-dialog.tsx      ← moved+renamed from modals/device-sync-modal.tsx
│   │   ├── interface-mapping-table.tsx ← moved from modals/
│   │   └── components/
│   │       ├── index.ts
│   │       ├── sync-dialog-header.tsx  ← moved+renamed from modals/components/sync-modal-header.tsx
│   │       ├── sync-loading-state.tsx  ← moved from modals/components/
│   │       ├── sync-form-footer.tsx    ← moved from modals/components/
│   │       └── validation-results-dialog.tsx ← moved+renamed from modals/components/validation-results-modal.tsx
│   ├── hooks/
│   │   ├── use-checkmk-config.ts
│   │   ├── use-checkmk-hosts-query.ts  ← moved from queries/
│   │   ├── use-hosts-filter.ts
│   │   ├── use-hosts-filter.test.ts
│   │   ├── use-hosts-pagination.ts
│   │   ├── use-hosts-selection.ts
│   │   ├── use-modal-state.ts
│   │   ├── use-nautobot-sync.ts
│   │   └── use-status-message.ts
│   ├── types/
│   │   └── index.ts                    ← moved from src/types/checkmk/types.ts
│   ├── utils/
│   │   ├── property-mapping-utils.ts   ← moved from src/lib/checkmk/
│   │   └── interface-mapping-utils.ts  ← moved from src/lib/checkmk/
│   └── hosts-inventory-page.tsx
│
└── tools/
    ├── components/
    │   └── activation-status-card.tsx
    ├── hooks/
    │   ├── use-checkmk-changes-query.ts    ← moved from hooks/queries/
    │   └── use-checkmk-discovery-mutations.ts ← moved from hooks/queries/
    ├── tabs/
    │   ├── changes-tab.tsx
    │   └── discovery-tab.tsx
    └── tools-page.tsx
```

---

## Refactoring Phases

### Pre-work: Delete Stale Files

Before starting any phase, delete these files:

- `hosts-inventory/hooks/use-hosts-filter.ts.bak` — leftover backup, superseded by `use-hosts-filter.ts`
- `modals/sync-to-nautobot-modal.tsx` — superseded by `device-sync-modal.tsx`

---

### Phase 1 — `sync-devices/` Consolidation

**Goal:** Move scattered types and utils into `sync-devices/types/` and `sync-devices/utils/`. Extract cross-app shared hooks and components to `shared/`.

**Steps:**

1. Create `sync-devices/types/index.ts`
   - Move all content from `src/types/features/checkmk/sync-devices.ts`
   - Delete `src/types/features/checkmk/sync-devices.ts`

2. Create `sync-devices/utils/` and move:
   - `api/sync-devices.api.ts` → `utils/sync-devices.api.ts`
   - `src/utils/features/checkmk/sync-devices/diff-helpers.ts` → `utils/diff-helpers.ts`
   - `src/utils/features/checkmk/sync-devices/badge-helpers.tsx` → `utils/badge-helpers.tsx`
   - `src/utils/features/checkmk/sync-devices/ui-helpers.ts` → `utils/ui-helpers.ts`
   - Delete `api/` sub-folder and `src/utils/features/checkmk/sync-devices/`

3. Create `shared/hooks/` and move three hooks used by both sync-devices and diff-viewer:
   - `hooks/use-status-messages.ts` → `../shared/hooks/use-status-messages.ts`
   - `hooks/use-job-management.ts` → `../shared/hooks/use-job-management.ts`
   - `hooks/use-diff-comparison.ts` → `../shared/hooks/use-diff-comparison.ts`

4. Create `shared/components/` and move three components used by both apps:
   - `components/diff-modal.tsx` → `../shared/components/diff-modal.tsx`
   - `components/job-controls-panel.tsx` → `../shared/components/job-controls-panel.tsx`
   - `components/status-message-card.tsx` → `../shared/components/status-message-card.tsx`

5. Update all import paths in `sync-devices/` files to reflect the new locations.

**Files affected by import updates:**
- `sync-devices-page.tsx` — imports from `hooks/`, `components/`, and external type paths
- All hooks inside `sync-devices/hooks/` that import from `utils/` or each other

---

### Phase 2 — `diff-viewer/` Consolidation

**Goal:** Move scattered types into `diff-viewer/types/`. Move API utilities into `diff-viewer/utils/`. Update cross-app imports to use `shared/`.

**Steps:**

1. Create `diff-viewer/types/index.ts`
   - Move all content from `src/types/features/checkmk/diff-viewer.ts`
   - Delete `src/types/features/checkmk/diff-viewer.ts`
   - If `src/types/features/checkmk/` is now empty, delete the directory

2. Create `diff-viewer/utils/` and move:
   - `api/diff-viewer.api.ts` → `utils/diff-viewer.api.ts`
   - Delete `api/` sub-folder

3. Update `diff-viewer-page.tsx` and all `diff-viewer/hooks/` files:
   - Replace any imports from `../sync-devices/hooks/` with `../shared/hooks/`
   - Replace any imports from `../sync-devices/components/` with `../shared/components/`
   - Update type import paths to `./types` or `../sync-devices/types`

**Phase 2 depends on Phase 1** (shared hooks/components must exist before diff-viewer can import them).

---

### Phase 3 — `hosts-inventory/` Consolidation

**Goal:** Consolidate all hosts-inventory resources (types, utils, modals, renderers) into the sub-app directory. Replace the root `modals/` folder and `renderers/` folder.

**Steps:**

1. Create `hosts-inventory/types/index.ts`
   - Move all content from `src/types/checkmk/types.ts`
   - Delete `src/types/checkmk/types.ts` (and `src/types/checkmk/` if empty)

2. Create `hosts-inventory/utils/` and move:
   - `src/lib/checkmk/property-mapping-utils.ts` → `utils/property-mapping-utils.ts`
   - `src/lib/checkmk/interface-mapping-utils.ts` → `utils/interface-mapping-utils.ts`
   - Delete `src/lib/checkmk/`

3. Create `hosts-inventory/components/` and move:
   - `renderers/inventory-renderer.tsx` → `hosts-inventory/components/inventory-renderer.tsx`
   - `renderers/json-renderer.tsx` → `hosts-inventory/components/json-renderer.tsx`
   - Delete `renderers/`

4. Create `hosts-inventory/dialogs/` and move from root `modals/`:
   - `modals/host-details-modal.tsx` → `dialogs/host-details-dialog.tsx` *(rename)*
   - `modals/inventory-modal.tsx` → `dialogs/inventory-dialog.tsx` *(rename)*
   - `modals/device-sync-modal.tsx` → `dialogs/device-sync-dialog.tsx` *(rename)*
   - `modals/interface-mapping-table.tsx` → `dialogs/interface-mapping-table.tsx`
   - `modals/components/index.ts` → `dialogs/components/index.ts`
   - `modals/components/sync-modal-header.tsx` → `dialogs/components/sync-dialog-header.tsx` *(rename)*
   - `modals/components/sync-loading-state.tsx` → `dialogs/components/sync-loading-state.tsx`
   - `modals/components/sync-form-footer.tsx` → `dialogs/components/sync-form-footer.tsx`
   - `modals/components/validation-results-modal.tsx` → `dialogs/components/validation-results-dialog.tsx` *(rename)*
   - Delete root `modals/` folder (now empty)

5. Merge `queries/use-checkmk-hosts-query.ts` into `hosts-inventory/hooks/`:
   - Move `queries/use-checkmk-hosts-query.ts` → `hooks/use-checkmk-hosts-query.ts`
   - Delete `queries/` sub-folder

6. Update all import paths in `hosts-inventory-page.tsx` and all hooks/dialogs.

> **File rename policy:** When renaming `*-modal.tsx` → `*-dialog.tsx`, the internal component names must also be updated (e.g., `function HostDetailsModal` → `function HostDetailsDialog`). Check for named exports in barrel files.

---

### Phase 4 — `tools/` Cleanup

**Goal:** Flatten the non-standard `hooks/queries/` nesting.

**Steps:**

1. Move both files up one level:
   - `hooks/queries/use-checkmk-changes-query.ts` → `hooks/use-checkmk-changes-query.ts`
   - `hooks/queries/use-checkmk-discovery-mutations.ts` → `hooks/use-checkmk-discovery-mutations.ts`

2. Delete `hooks/queries/` sub-folder

3. Update imports inside `tabs/changes-tab.tsx`, `tabs/discovery-tab.tsx`, and `tools-page.tsx`

**Phase 4 has no dependencies** — it can be executed in parallel with Phases 1–2.

---

### Phase 5 — External Directory Cleanup

**Goal:** Delete the external directories that housed CheckMK files, now all moved in Phases 1–3.

Directories to verify and delete:

| Directory | Emptied by |
|-----------|------------|
| `src/types/features/checkmk/` | Phases 1 & 2 |
| `src/types/checkmk/` | Phase 3 |
| `src/utils/features/checkmk/` | Phase 1 |
| `src/lib/checkmk/` | Phase 3 |

> If any of these directories contain non-CheckMK files, **do not delete them** — only remove the files moved in Phases 1–3.

---

## Decisions & Design Rationale

### `shared/` at the checkmk root

Three hooks (`use-status-messages`, `use-job-management`, `use-diff-comparison`) and three components (`DiffModal`, `JobControlsPanel`, `StatusMessageCard`) are imported by both `sync-devices` and `diff-viewer`. Rather than duplicating them, a `shared/` sub-directory at the checkmk root level eliminates the cross-app sibling dependency without creating a global shared folder.

`shared/` is intentionally scoped inside `checkmk/` — not in `src/components/shared/` — because these artifacts are domain-specific and not used outside the CheckMK feature.

### `api/` sub-folders → `utils/`

The `api/` pattern is not in the CLAUDE.md standard. The files inside (`sync-devices.api.ts`, `diff-viewer.api.ts`) contain raw fetch functions — stateless utilities. They map cleanly to `utils/`.

### `queries/` and `hooks/queries/` → `hooks/`

TanStack Query hooks are hooks. CLAUDE.md standard has `hooks/`, not `queries/` or `hooks/queries/`. All query hook files move to their respective sub-app's `hooks/` folder. This enforces consistency with how every other feature handles TanStack Query hooks.

### `modals/` → `dialogs/` renamed and co-located

CLAUDE.md uses `dialogs/` (not `modals/`). The root-level `modals/` folder mixed components from different sub-apps. After the move, all dialog files are co-located inside `hosts-inventory/dialogs/` (the only sub-app that owns them). File names change from `*-modal.tsx` to `*-dialog.tsx` to match the naming convention.

### `renderers/` → `hosts-inventory/components/`

The two renderer components (`inventory-renderer.tsx`, `json-renderer.tsx`) are only used by `hosts-inventory`. Moving them inside `hosts-inventory/components/` removes the ambiguity of a root-level folder with no clear owner.

### Out of scope

- Route page files in `app/(dashboard)/checkmk/*` — not affected
- `src/lib/query-keys.ts` checkmk entries — not affected
- `app-sidebar.tsx` checkmk navigation entries — not affected
- Any behavioral or logic changes — this is a pure structural refactoring

---

## Verification Checklist

After all phases are complete, run the following checks:

```bash
# 1. No remaining references to old external type locations
grep -r "from.*types/checkmk" frontend/src/
grep -r "from.*types/features/checkmk" frontend/src/

# 2. No remaining references to old external util locations
grep -r "from.*utils/features/checkmk" frontend/src/
grep -r "from.*lib/checkmk" frontend/src/

# 3. No remaining cross-app sibling imports (diff-viewer → sync-devices)
grep -r "sync-devices/hooks" frontend/src/components/features/checkmk/diff-viewer/
grep -r "sync-devices/components" frontend/src/components/features/checkmk/diff-viewer/

# 4. No remaining references to old modals/ location
grep -r "from.*checkmk/modals" frontend/src/

# 5. TypeScript build passes cleanly
cd frontend && npm run build

# 6. Linting passes
cd frontend && npm run lint
```

All six checks must return 0 results / 0 errors before the refactoring is considered complete.

---

## Execution Order

```
Pre-work        → delete .bak and legacy sync-to-nautobot-modal.tsx
Phase 1 & 4    → can run in parallel (sync-devices consolidation + tools flattening)
Phase 2         → after Phase 1 (needs shared/ to exist)
Phase 3         → after Phase 1 & 2 (hosts-inventory uses types from both)
Phase 5         → after Phases 1–3 (cleanup now-empty external dirs)
Verification    → run all grep + build checks
```
