# Refactoring Jobs Directory Structure

## Overview

The `/frontend/src/components/features/jobs/` directory currently has an inconsistent structure that deviates from the standardized pattern used in other features (e.g., `settings`, `nautobot`). This document outlines a plan to reorganize the jobs feature to match the established architectural standards.

## Problem Statement

**Current Issues:**
1. `job-result-dialog.tsx` at root level instead of in `dialogs/`
2. Non-standard `shared/` directory (should be `components/`)
3. `job-template-types/` and `results/` should be nested under `components/`
4. Inconsistent sub-feature structure (templates lacks proper organization)
5. Unclear separation between shared code and sub-feature-specific code

**Impact:**
- Harder to locate files
- Inconsistent with other features
- Confusing for new developers
- Violates established architectural patterns

## Current Structure

```
/components/features/jobs/
├── job-result-dialog.tsx          # ❌ Dialog at root
├── job-template-types/            # ❌ Should be under components/
│   ├── BackupJobTemplate.tsx
│   ├── CompareDevicesJobTemplate.tsx
│   ├── RunCommandsJobTemplate.tsx
│   ├── ScanPrefixesJobTemplate.tsx
│   └── SyncDevicesJobTemplate.tsx
├── results/                       # ❌ Should be under components/
│   ├── backup-job-result.tsx
│   ├── bulk-onboard-result.tsx
│   ├── check-ip-result.tsx
│   ├── export-devices-result.tsx
│   ├── generic-job-result.tsx
│   ├── index.ts
│   ├── run-commands-result.tsx
│   ├── scan-prefix-result.tsx
│   ├── sync-job-result.tsx
│   └── update-devices-result.tsx
├── scheduler/                     # ⚠️  Needs standardization
│   └── jobs-scheduler-page.tsx
├── shared/                        # ❌ Non-standard name
│   ├── JobTemplateCommonFields.tsx
│   ├── JobTemplateConfigRepoSection.tsx
│   └── JobTemplateInventorySection.tsx
├── templates/                     # ⚠️  Needs proper structure
│   └── job-templates-page.tsx
├── types/                         # ✅ Correct
│   └── job-results.ts
└── view/                          # ✅ Already proper structure
    ├── components/
    ├── hooks/
    ├── types/
    └── utils/
```

## Proposed Structure

```
/components/features/jobs/
├── components/                    # Shared components (renamed from "shared/")
│   ├── results/                  # Moved from root
│   │   ├── backup-job-result.tsx
│   │   ├── bulk-onboard-result.tsx
│   │   ├── check-ip-result.tsx
│   │   ├── export-devices-result.tsx
│   │   ├── generic-job-result.tsx
│   │   ├── index.ts
│   │   ├── run-commands-result.tsx
│   │   ├── scan-prefix-result.tsx
│   │   ├── sync-job-result.tsx
│   │   └── update-devices-result.tsx
│   ├── template-types/           # Moved from "job-template-types/"
│   │   ├── BackupJobTemplate.tsx
│   │   ├── CompareDevicesJobTemplate.tsx
│   │   ├── RunCommandsJobTemplate.tsx
│   │   ├── ScanPrefixesJobTemplate.tsx
│   │   └── SyncDevicesJobTemplate.tsx
│   ├── JobTemplateCommonFields.tsx
│   ├── JobTemplateConfigRepoSection.tsx
│   └── JobTemplateInventorySection.tsx
├── dialogs/                       # NEW - For shared dialogs
│   └── job-result-dialog.tsx     # Moved from root
├── hooks/                         # Shared hooks (if needed in future)
├── types/                         # ✅ Keep as-is
│   └── job-results.ts
├── utils/                         # Shared utilities (if needed in future)
├── scheduler/                     # Scheduler sub-feature
│   ├── components/               # NEW - Move page components here
│   │   └── jobs-scheduler-page.tsx
│   ├── hooks/                    # For future scheduler-specific hooks
│   ├── types/                    # For future scheduler-specific types
│   └── utils/                    # For future scheduler-specific utils
├── templates/                     # Templates sub-feature
│   ├── components/               # NEW - Move page components here
│   │   └── job-templates-page.tsx
│   ├── hooks/                    # For future templates-specific hooks
│   ├── types/                    # For future templates-specific types
│   └── utils/                    # For future templates-specific utils
└── view/                          # ✅ Already proper structure
    ├── components/
    ├── hooks/
    ├── types/
    └── utils/
```

## Migration Plan

### Phase 1: Create New Directory Structure

```bash
# Create missing directories
mkdir -p frontend/src/components/features/jobs/components/results
mkdir -p frontend/src/components/features/jobs/components/template-types
mkdir -p frontend/src/components/features/jobs/dialogs
mkdir -p frontend/src/components/features/jobs/hooks
mkdir -p frontend/src/components/features/jobs/utils
mkdir -p frontend/src/components/features/jobs/scheduler/components
mkdir -p frontend/src/components/features/jobs/scheduler/hooks
mkdir -p frontend/src/components/features/jobs/scheduler/types
mkdir -p frontend/src/components/features/jobs/scheduler/utils
mkdir -p frontend/src/components/features/jobs/templates/components
mkdir -p frontend/src/components/features/jobs/templates/hooks
mkdir -p frontend/src/components/features/jobs/templates/types
mkdir -p frontend/src/components/features/jobs/templates/utils
```

### Phase 2: Move Files

**2.1 Move result components**
```bash
# Move all result files
mv frontend/src/components/features/jobs/results/* \
   frontend/src/components/features/jobs/components/results/
```

**2.2 Move template type components**
```bash
# Move all template type files
mv frontend/src/components/features/jobs/job-template-types/* \
   frontend/src/components/features/jobs/components/template-types/
```

**2.3 Move shared components**
```bash
# Move shared components to components/ root
mv frontend/src/components/features/jobs/shared/JobTemplateCommonFields.tsx \
   frontend/src/components/features/jobs/components/
mv frontend/src/components/features/jobs/shared/JobTemplateConfigRepoSection.tsx \
   frontend/src/components/features/jobs/components/
mv frontend/src/components/features/jobs/shared/JobTemplateInventorySection.tsx \
   frontend/src/components/features/jobs/components/
```

**2.4 Move dialog**
```bash
# Move dialog to dialogs/
mv frontend/src/components/features/jobs/job-result-dialog.tsx \
   frontend/src/components/features/jobs/dialogs/
```

**2.5 Reorganize sub-features**
```bash
# Move scheduler page to components
mv frontend/src/components/features/jobs/scheduler/jobs-scheduler-page.tsx \
   frontend/src/components/features/jobs/scheduler/components/

# Move templates page to components
mv frontend/src/components/features/jobs/templates/job-templates-page.tsx \
   frontend/src/components/features/jobs/templates/components/
```

### Phase 3: Update Import Paths

**Files that need import path updates:**

1. **job-result-dialog.tsx** (after moving to `dialogs/`)
   - Update relative imports for:
     - `./types/job-results` → `../types/job-results`
     - `./results/*` → `../components/results/*`

2. **Page files** (`/app/(dashboard)/jobs/*/page.tsx`)
   - `/jobs/scheduler/page.tsx`:
     - Update import from `@/components/features/jobs/scheduler/jobs-scheduler-page`
     - To: `@/components/features/jobs/scheduler/components/jobs-scheduler-page`

   - `/jobs/templates/page.tsx`:
     - Update import from `@/components/features/jobs/templates/job-templates-page`
     - To: `@/components/features/jobs/templates/components/job-templates-page`

   - `/jobs/view/page.tsx`:
     - Check if it imports `job-result-dialog`
     - Update from `@/components/features/jobs/job-result-dialog`
     - To: `@/components/features/jobs/dialogs/job-result-dialog`

3. **Components importing template types**
   - Find all files importing from `job-template-types/`
   - Update to `components/template-types/`

4. **Components importing shared components**
   - Find all files importing from `shared/`
   - Update to `components/`

5. **Components importing results**
   - Find all files importing from `results/`
   - Update to `components/results/`

### Phase 4: Remove Empty Directories

```bash
# After moving all files, remove old directories
rmdir frontend/src/components/features/jobs/results
rmdir frontend/src/components/features/jobs/job-template-types
rmdir frontend/src/components/features/jobs/shared
```

## Detailed Import Path Changes

### 1. Dialog Component (`dialogs/job-result-dialog.tsx`)

**Old imports:**
```typescript
import { JobRun, ... } from "./types/job-results"
import { BackupJobResultView } from "./results/backup-job-result"
import { SyncJobResultView } from "./results/sync-job-result"
// ... other result imports
```

**New imports:**
```typescript
import { JobRun, ... } from "../types/job-results"
import { BackupJobResultView } from "../components/results/backup-job-result"
import { SyncJobResultView } from "../components/results/sync-job-result"
// ... other result imports
```

### 2. Scheduler Page (`scheduler/components/jobs-scheduler-page.tsx`)

**Find all imports that reference:**
- `@/components/features/jobs/shared/*` → `@/components/features/jobs/components/*`
- `@/components/features/jobs/job-template-types/*` → `@/components/features/jobs/components/template-types/*`
- `@/components/features/jobs/job-result-dialog` → `@/components/features/jobs/dialogs/job-result-dialog`

### 3. Templates Page (`templates/components/job-templates-page.tsx`)

**Find all imports that reference:**
- `@/components/features/jobs/shared/*` → `@/components/features/jobs/components/*`
- `@/components/features/jobs/job-template-types/*` → `@/components/features/jobs/components/template-types/*`
- `@/components/features/jobs/job-result-dialog` → `@/components/features/jobs/dialogs/job-result-dialog`

### 4. View Components

**Check all files in `view/components/` for imports:**
- `@/components/features/jobs/job-result-dialog` → `@/components/features/jobs/dialogs/job-result-dialog`

### 5. Route Pages

**`/app/(dashboard)/jobs/scheduler/page.tsx`:**
```typescript
// OLD
import { JobsSchedulerPage } from '@/components/features/jobs/scheduler/jobs-scheduler-page'

// NEW
import { JobsSchedulerPage } from '@/components/features/jobs/scheduler/components/jobs-scheduler-page'
```

**`/app/(dashboard)/jobs/templates/page.tsx`:**
```typescript
// OLD
import { JobTemplatesPage } from '@/components/features/jobs/templates/job-templates-page'

// NEW
import { JobTemplatesPage } from '@/components/features/jobs/templates/components/job-templates-page'
```

## Search Commands for Finding References

```bash
# Find all imports from old paths
cd frontend/src

# Find references to job-result-dialog
grep -r "from.*job-result-dialog" .

# Find references to shared/
grep -r "from.*jobs/shared" .

# Find references to job-template-types/
grep -r "from.*job-template-types" .

# Find references to results/ (excluding the files themselves)
grep -r "from.*jobs/results" . | grep -v "jobs/results/"

# Find references to scheduler page
grep -r "jobs-scheduler-page" .

# Find references to templates page
grep -r "job-templates-page" .
```

## Testing Checklist

After refactoring, verify:

- [ ] All pages load without errors
  - [ ] `/jobs` - Main jobs page
  - [ ] `/jobs/scheduler` - Scheduler page
  - [ ] `/jobs/templates` - Templates page
  - [ ] `/jobs/view` - View page

- [ ] All dialogs work correctly
  - [ ] Job result dialog opens and displays results
  - [ ] All result types render correctly (backup, sync, run-commands, etc.)

- [ ] No TypeScript errors
  - [ ] Run `npm run type-check` (or `tsc --noEmit`)

- [ ] No console errors in browser
  - [ ] Check browser console on each page

- [ ] No broken imports
  - [ ] Search for `from "./shared` (should be 0 results outside jobs/)
  - [ ] Search for `from "./job-template-types` (should be 0 results)
  - [ ] Search for `from "./results` (should only be in index.ts)

- [ ] File structure matches standard
  - [ ] Compare with `/components/features/settings/` structure
  - [ ] Verify all sub-features have components/, hooks/, types/, utils/

## Rollback Plan

If issues arise during refactoring:

1. **Git is your friend** - Commit before starting, so you can revert
2. **Phase rollback** - If Phase 3 (imports) fails, you can still revert file moves
3. **Keep old directories temporarily** - Don't delete old dirs until all imports are verified

## Risk Assessment

**Low Risk:**
- Moving files (git tracks renames)
- Creating new directories

**Medium Risk:**
- Updating import paths (can cause runtime errors if missed)
- TypeScript may not catch all import issues (dynamic imports)

**Mitigation:**
- Use search commands to find all references
- Test each page manually after changes
- Run TypeScript compiler
- Check browser console

## Post-Refactoring Benefits

1. **Consistency** - Matches architectural standards (CLAUDE.md)
2. **Discoverability** - Clear separation of shared vs. sub-feature code
3. **Maintainability** - Easier to find and modify files
4. **Scalability** - Easy to add new sub-features
5. **Onboarding** - New developers can predict file locations

## Execution Timeline

**Estimated time:** 1-2 hours

1. Phase 1 (Create directories): 5 minutes
2. Phase 2 (Move files): 10 minutes
3. Phase 3 (Update imports): 30-60 minutes
4. Phase 4 (Cleanup): 5 minutes
5. Testing: 15-30 minutes

## Notes

- This refactoring is **non-functional** - no business logic changes
- All changes are **structural** - moving files and updating imports
- **Zero user-facing impact** - UI/UX remains identical
- **Git-friendly** - Modern git detects file renames automatically

## References

- **CLAUDE.md** - Frontend Structure section
- **Example structure** - `/frontend/src/components/features/settings/`
- **Standard pattern** - components/, hooks/, dialogs/, types/, utils/

---

**Status:** Planning Complete
**Next Step:** Execute Phase 1 - Create directory structure
**Assigned To:** TBD
**Priority:** Medium (Technical Debt)
