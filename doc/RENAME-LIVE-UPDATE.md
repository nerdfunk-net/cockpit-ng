# Rename Live Update to Sync Devices - Migration Plan

## Overview
This document outlines the steps to:
1. **Remove** the obsolete "Sync Devices" app (CheckMK)
2. **Rename** "Live Update" to "Sync Devices"
3. **Update** all references, imports, and navigation

**Important:** The Nautobot Sync Devices feature (`/sync-devices`) is NOT affected by this refactoring.

---

## Phase 1: DELETE Old Sync Devices (CheckMK)

### Frontend Files to DELETE

#### 1.1 App Route
```
❌ DELETE: /frontend/src/app/(dashboard)/checkmk/sync-devices/page.tsx
```

#### 1.2 Feature Directory
```
❌ DELETE: /frontend/src/components/features/checkmk/sync-devices/
  ├── api/sync-devices.api.ts
  ├── components/
  │   ├── add-device-modal.tsx
  │   ├── device-actions-bar.tsx
  │   ├── device-details-modal.tsx
  │   ├── device-diff-modal.tsx
  │   ├── device-filters-row.tsx
  │   ├── device-table.tsx
  │   ├── job-controls.tsx
  │   ├── job-progress-modal.tsx
  │   ├── pagination-controls.tsx
  │   └── status-message-modal.tsx
  ├── hooks/
  │   ├── use-celery-job-polling.ts
  │   ├── use-device-filters.ts
  │   ├── use-device-selection.ts
  │   ├── use-job-management.ts
  │   ├── use-pagination.ts
  │   └── use-status-message.ts
  ├── types/
  │   └── sync-devices.types.ts
  ├── utils/
  │   └── sync-devices.utils.tsx
  ├── sync-devices-page.tsx
  └── sync-devices-page.test.tsx
```

#### 1.3 Build Artifacts
```
❌ DELETE: /frontend/.next/server/app/(dashboard)/checkmk/sync-devices/
❌ DELETE: /frontend/.next/static/chunks/app/(dashboard)/checkmk/sync-devices/
❌ DELETE: /frontend/.next/types/app/(dashboard)/checkmk/sync-devices/
```

### Backend Files to DELETE (if any exist)
```
# Search and delete any backend routes/services for CheckMK sync-devices
# (Currently no specific backend files found for old sync-devices)
```

### Documentation to DELETE/Archive
```
❌ DELETE or ARCHIVE: /doc/refactoring/REFACTORING_NAUTOBOT_SYNC_DEVICES.md (if related)
```

---

## Phase 2: RENAME Live Update → Sync Devices

### 2.1 Frontend Route Directory
```
RENAME: /frontend/src/app/(dashboard)/checkmk/live-update/
    TO: /frontend/src/app/(dashboard)/checkmk/sync-devices/

RENAME: /frontend/src/app/(dashboard)/checkmk/live-update/page.tsx
    TO: /frontend/src/app/(dashboard)/checkmk/sync-devices/page.tsx
```

### 2.2 Feature Components Directory
```
RENAME: /frontend/src/components/features/checkmk/live-update/
    TO: /frontend/src/components/features/checkmk/sync-devices/

Contents (all filenames stay same, just directory renamed):
  ├── api/
  │   └── live-update.api.ts  → sync-devices.api.ts
  ├── components/
  │   ├── active-tasks-panel.tsx
  │   ├── add-device-modal.tsx
  │   ├── device-table-header.tsx
  │   ├── device-table-row.tsx
  │   ├── device-table.tsx
  │   ├── diff-modal.tsx
  │   ├── job-controls-panel.tsx
  │   ├── live-update-header.tsx  → sync-devices-header.tsx
  │   └── status-message-card.tsx
  ├── hooks/
  │   ├── use-device-filters.ts
  │   ├── use-device-loader.ts
  │   ├── use-device-operations.ts
  │   ├── use-device-selection.ts
  │   ├── use-diff-comparison.ts
  │   ├── use-job-management.ts
  │   ├── use-status-messages.ts
  │   └── use-task-tracking.ts
  └── live-update-page.tsx  → sync-devices-page.tsx
```

### 2.3 Utilities Directory
```
RENAME: /frontend/src/utils/features/checkmk/live-update/
    TO: /frontend/src/utils/features/checkmk/sync-devices/

Contents:
  ├── badge-helpers.tsx
  ├── diff-helpers.ts
  └── ui-helpers.ts
```

### 2.4 Types Directory
```
RENAME: /frontend/src/types/features/checkmk/live-update.ts
    TO: /frontend/src/types/features/checkmk/sync-devices.ts
```

---

## Phase 3: UPDATE File Contents

### 3.1 Update Import Paths in All Files

**Pattern Search & Replace:**

```typescript
// API imports
FROM: '@/components/features/checkmk/live-update/api/live-update.api'
TO:   '@/components/features/checkmk/sync-devices/api/sync-devices.api'

// Component imports
FROM: '@/components/features/checkmk/live-update/components/'
TO:   '@/components/features/checkmk/sync-devices/components/'

// Hook imports
FROM: '@/components/features/checkmk/live-update/hooks/'
TO:   '@/components/features/checkmk/sync-devices/hooks/'

// Type imports
FROM: '@/types/features/checkmk/live-update'
TO:   '@/types/features/checkmk/sync-devices'

// Utility imports
FROM: '@/utils/features/checkmk/live-update/'
TO:   '@/utils/features/checkmk/sync-devices/'

// Page imports
FROM: '@/components/features/checkmk/live-update/live-update-page'
TO:   '@/components/features/checkmk/sync-devices/sync-devices-page'
```

### 3.2 Files Requiring Import Updates

**Critical Files:**
1. `/frontend/src/app/(dashboard)/checkmk/sync-devices/page.tsx`
2. `/frontend/src/components/features/checkmk/sync-devices/sync-devices-page.tsx`
3. All component files in `/frontend/src/components/features/checkmk/sync-devices/components/`
4. All hook files in `/frontend/src/components/features/checkmk/sync-devices/hooks/`
5. All utility files in `/frontend/src/utils/features/checkmk/sync-devices/`

### 3.3 Update Component Names and Labels

**In `/frontend/src/components/features/checkmk/sync-devices/sync-devices-page.tsx`:**
```typescript
// Change export name
FROM: export default function LiveUpdatePage()
TO:   export default function SyncDevicesPage()
```

**In `/frontend/src/components/features/checkmk/sync-devices/components/sync-devices-header.tsx`:**
```typescript
// Rename component
FROM: export function LiveUpdateHeader
TO:   export function SyncDevicesHeader

// Update title text
FROM: <h1>CheckMK Live Update</h1>
TO:   <h1>CheckMK Sync Devices</h1>

// Update description
FROM: "Live sync and manage devices..."
TO:   "Compare and synchronize devices between Nautobot and CheckMK"
```

**In `/frontend/src/components/features/checkmk/sync-devices/components/device-table.tsx`:**
```typescript
// Update header text
FROM: "Device Live Update Management"
TO:   "Device Synchronization Management"
```

### 3.4 Update API File Names and Functions

**In `/frontend/src/components/features/checkmk/sync-devices/api/sync-devices.api.ts`:**
```typescript
// Keep existing API endpoint paths (no change needed - they use /nb2cmk/)
// Only update comments if they reference "live-update"
```

---

## Phase 4: UPDATE Navigation & Routes

### 4.1 Sidebar Navigation

**File:** `/frontend/src/components/layout/app-sidebar.tsx`

**Changes:**
```typescript
// REMOVE old CheckMK Sync Devices entry (line ~90)
DELETE: { label: 'Sync Devices', href: '/checkmk/sync-devices', icon: Shield }

// UPDATE Live Update entry (line ~91)
FROM: { label: 'Live Update', href: '/checkmk/live-update', icon: RefreshCw }
TO:   { label: 'Sync Devices', href: '/checkmk/sync-devices', icon: RefreshCw }

// Keep Nautobot Sync Devices unchanged (line ~73)
KEEP: { label: 'Sync Devices', href: '/sync-devices', icon: RefreshCw }
```

**Result - CheckMK Section:**
```typescript
{
  title: 'CheckMK',
  items: [
    { label: 'Sync Devices', href: '/checkmk/sync-devices', icon: RefreshCw },  // ← Renamed from Live Update
    { label: 'Hosts & Inventory', href: '/checkmk/hosts-inventory', icon: Server },
  ],
}
```

---

## Phase 5: UPDATE Key IDs and Constants

### 5.1 Search for Hardcoded Strings

**Search and replace in all files:**
```bash
# Component keys
FROM: key=`live-update-
TO:   key=`sync-devices-

# CSS classes (if any)
FROM: class="live-update-
TO:   class="sync-devices-

# Data attributes (if any)
FROM: data-live-update
TO:   data-sync-devices
```

**Specific files to check:**
- `/frontend/src/components/features/checkmk/sync-devices/components/device-table-header.tsx`
- `/frontend/src/components/features/checkmk/sync-devices/components/device-table-row.tsx`
- `/frontend/src/components/features/checkmk/sync-devices/components/device-table.tsx`

---

## Phase 6: UPDATE Documentation

### 6.1 Archive Old Documentation
```
RENAME: /doc/refactoring/REFACTORING_LIVE_UPDATE.md
    TO: /doc/archive/REFACTORING_LIVE_UPDATE_LEGACY.md
```

### 6.2 Update References in CLAUDE.md
```
File: /CLAUDE.md

UPDATE all references:
FROM: "Live Update"
TO:   "Sync Devices" (CheckMK context)

UPDATE all paths:
FROM: /checkmk/live-update
TO:   /checkmk/sync-devices
```

---

## Phase 7: CLEAN Build Artifacts

### 7.1 Delete Next.js Cache
```bash
cd frontend
rm -rf .next
npm run build
```

### 7.2 Verify No References Remain
```bash
# Search for any remaining "live-update" references
grep -r "live-update" frontend/src --include="*.ts" --include="*.tsx"

# Should only find legacy/archived files or comments
```

---

## Phase 8: TESTING CHECKLIST

### 8.1 Functional Testing
- [ ] Navigate to `/checkmk/sync-devices` - page loads correctly
- [ ] Old route `/checkmk/live-update` returns 404 (expected)
- [ ] Sidebar shows "Sync Devices" under CheckMK section
- [ ] Load devices from Nautobot works
- [ ] Start comparison job works
- [ ] Load job results works
- [ ] Sync device operations work
- [ ] Activate changes works
- [ ] All modals open/close correctly
- [ ] Filters and pagination work
- [ ] IP address preservation works when loading job results

### 8.2 Visual Testing
- [ ] Page title shows "CheckMK Sync Devices"
- [ ] Table header shows correct title
- [ ] All buttons have correct labels
- [ ] No "Live Update" text visible anywhere
- [ ] Icons display correctly

### 8.3 Console Testing
- [ ] No console errors
- [ ] No 404 errors for missing files
- [ ] No import errors

---

## Phase 9: GIT WORKFLOW

### 9.1 Recommended Git Operations
```bash
# 1. Create feature branch
git checkout -b refactoring/rename-live-update-to-sync-devices

# 2. Delete old sync-devices (CheckMK)
git rm -r frontend/src/app/\(dashboard\)/checkmk/sync-devices
git rm -r frontend/src/components/features/checkmk/sync-devices

# 3. Move live-update to sync-devices using git mv (preserves history)
git mv frontend/src/app/\(dashboard\)/checkmk/live-update \
       frontend/src/app/\(dashboard\)/checkmk/sync-devices

git mv frontend/src/components/features/checkmk/live-update \
       frontend/src/components/features/checkmk/sync-devices

git mv frontend/src/utils/features/checkmk/live-update \
       frontend/src/utils/features/checkmk/sync-devices

git mv frontend/src/types/features/checkmk/live-update.ts \
       frontend/src/types/features/checkmk/sync-devices.ts

# 4. Rename specific files
cd frontend/src/components/features/checkmk/sync-devices
git mv live-update-page.tsx sync-devices-page.tsx
git mv components/live-update-header.tsx components/sync-devices-header.tsx
git mv api/live-update.api.ts api/sync-devices.api.ts

# 5. Make content changes (imports, labels, etc.)
# ... edit files according to Phase 3 ...

# 6. Update sidebar and other references
# ... edit according to Phase 4 ...

# 7. Clean build
cd frontend
rm -rf .next
npm run build

# 8. Commit
git add -A
git commit -m "♻️ refactor(checkmk): Rename Live Update to Sync Devices

- Remove obsolete CheckMK Sync Devices app
- Rename Live Update → Sync Devices
- Update all imports, routes, and navigation
- Update component names and labels
- Clean build artifacts

BREAKING CHANGE: Route changed from /checkmk/live-update to /checkmk/sync-devices"

# 9. Push and create PR
git push -u origin refactoring/rename-live-update-to-sync-devices
```

---

## Summary of Changes

### Deletions
- ❌ Old CheckMK Sync Devices app (entire feature directory)
- ❌ Build artifacts for old app
- ❌ "Sync Devices" entry from CheckMK sidebar section

### Renames
- ✅ `/checkmk/live-update` → `/checkmk/sync-devices` (route)
- ✅ `LiveUpdatePage` → `SyncDevicesPage` (component)
- ✅ `LiveUpdateHeader` → `SyncDevicesHeader` (component)
- ✅ `live-update.api.ts` → `sync-devices.api.ts`
- ✅ `live-update.ts` → `sync-devices.ts` (types)
- ✅ All directory paths containing `live-update` → `sync-devices`

### Updates
- ✅ All import statements
- ✅ All component references
- ✅ Sidebar navigation labels
- ✅ Page titles and descriptions
- ✅ Table headers and UI text
- ✅ Component keys (from `live-update-*` to `sync-devices-*`)

### Preserved
- ✅ Nautobot Sync Devices (`/sync-devices`) - UNCHANGED
- ✅ All functionality and features
- ✅ Git history (using `git mv`)

---

## Risk Assessment

### Low Risk
- Directory and file renames (using `git mv`)
- Import path updates (TypeScript will catch errors)
- Sidebar navigation updates

### Medium Risk
- Component key updates (could affect React reconciliation)
- Build artifacts cleanup

### Mitigation
- Thorough testing before merge
- Keep PR focused and reviewable
- Test on staging environment first
- Keep old branch accessible for rollback

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate:** Revert the merge commit
```bash
git revert <merge-commit-hash>
git push
```

2. **Temporary:** Create hotfix to restore old routes
```bash
# Add redirect from new to old route if needed
```

3. **Full Rollback:** Restore from backup branch
```bash
git checkout main
git reset --hard <pre-merge-commit-hash>
git push --force
```

---

## Timeline Estimate

- **Phase 1-2 (Delete & Rename):** 30 minutes
- **Phase 3-4 (Update Contents):** 1-2 hours
- **Phase 5-6 (Constants & Docs):** 30 minutes
- **Phase 7 (Clean Build):** 15 minutes
- **Phase 8 (Testing):** 1 hour
- **Phase 9 (Git & PR):** 30 minutes

**Total Estimated Time:** 3.5-4.5 hours

---

## Post-Deployment Tasks

- [ ] Update any external documentation
- [ ] Update any bookmarks or saved links
- [ ] Notify team of route change
- [ ] Monitor error logs for 404s on old route
- [ ] Update any automation scripts using old route
- [ ] Archive this migration document

---

**Document Version:** 1.0
**Created:** 2026-01-20
**Last Updated:** 2026-01-20
