# Component Structure Migration Plan

## Executive Summary

**Goal**: Reorganize `/frontend/src/components` from a flat structure to a feature-based hierarchy that improves maintainability, scalability, and developer experience.

**Scope**: ~33,689 lines of component code across 21 top-level directories
**Timeline**: 6 phases over 2-4 weeks (can be done incrementally)
**Risk Level**: Low (gradual migration with rollback capability)

---

## Current State Analysis

### Current Structure (Problematic)
```
components/
├── ansible-inventory/          ❌ Should be under network/automation/
├── backup/                     ❌ Should be under network/configs/
├── bulk-edit/                  ❌ Should be under nautobot/tools/
├── checkmk/                    ⚠️  OK but should be features/checkmk/
├── compare/                    ❌ Should be under network/configs/
├── compliance/                 ❌ Should be under network/
├── configs/                    ❌ Should be under network/
├── jobs/                       ⚠️  OK but should be features/jobs/
├── nautobot/                   ⚠️  OK but incomplete (missing add-device, export, etc.)
├── nautobot-add-device/        ❌ Should be nautobot/add-device/
├── nautobot-export/            ❌ Should be nautobot/export/
├── netmiko/                    ❌ Should be under network/automation/
├── offboard-device/            ❌ Should be nautobot/offboard/
├── onboard-device/             ❌ Should be nautobot/onboard/
├── sync-devices/               ❌ Should be nautobot/sync-devices/
├── tools/                      ⚠️  Too generic, has ping under it
├── profile/                    ✅ OK
├── settings/                   ✅ OK
├── auth/                       ✅ OK
├── shared/                     ✅ OK
└── ui/                         ✅ OK (Shadcn)

# Standalone files (should move to layout/)
├── app-sidebar.tsx             ❌ Should be layout/app-sidebar.tsx
├── dashboard-layout.tsx        ❌ Should be layout/dashboard-layout.tsx
├── sidebar-context.tsx         ❌ Should be layout/sidebar-context.tsx
└── session-status.tsx          ❌ Should be layout/session-status.tsx
```

### Issues with Current Structure
1. **Inconsistent naming**: `nautobot-add-device` vs `add-device` vs `onboard-device`
2. **Flat structure**: Hard to find related components
3. **Mixed concerns**: Layout components alongside feature components
4. **No logical grouping**: Network features scattered across multiple directories
5. **Path confusion**: Routes don't match component paths

---

## Target Structure

### Proposed Organization
```
components/
├── features/                    # Feature-based organization
│   ├── nautobot/               # All Nautobot-related features
│   │   ├── add-device/         # FROM: nautobot-add-device/
│   │   ├── onboard/            # FROM: onboard-device/
│   │   ├── offboard/           # FROM: offboard-device/
│   │   ├── sync-devices/       # FROM: sync-devices/
│   │   ├── export/             # FROM: nautobot-export/
│   │   └── tools/
│   │       ├── bulk-edit/      # FROM: bulk-edit/
│   │       └── check-ip/       # FROM: nautobot/ (if exists)
│   │
│   ├── checkmk/                # FROM: checkmk/ (moved up)
│   │   ├── sync-devices/
│   │   ├── live-update/
│   │   └── hosts-inventory/
│   │
│   ├── network/                # Network operations grouped
│   │   ├── configs/
│   │   │   ├── view/           # FROM: configs/
│   │   │   ├── backup/         # FROM: backup/
│   │   │   └── compare/        # FROM: compare/
│   │   ├── automation/
│   │   │   ├── netmiko/        # FROM: netmiko/
│   │   │   ├── ansible-inventory/  # FROM: ansible-inventory/
│   │   │   └── templates/      # (if exists in app/)
│   │   ├── compliance/         # FROM: compliance/
│   │   └── tools/
│   │       └── ping/           # FROM: tools/
│   │
│   ├── jobs/                   # FROM: jobs/ (moved up)
│   │   ├── templates/
│   │   ├── scheduler/
│   │   └── view/
│   │
│   ├── settings/               # FROM: settings/ (moved up)
│   │   ├── common/
│   │   ├── connections/
│   │   ├── compliance/
│   │   ├── templates/
│   │   ├── git/
│   │   ├── cache/
│   │   ├── celery/
│   │   ├── credentials/
│   │   └── permissions/
│   │
│   └── profile/                # FROM: profile/ (moved up)
│
├── layout/                     # Layout & navigation components
│   ├── app-sidebar.tsx         # FROM: app-sidebar.tsx
│   ├── dashboard-layout.tsx    # FROM: dashboard-layout.tsx
│   ├── sidebar-context.tsx     # FROM: sidebar-context.tsx
│   └── session-status.tsx      # FROM: session-status.tsx
│
├── auth/                       # Auth components (no change)
│   └── auth-hydration.tsx
│
├── shared/                     # Shared/reusable components (no change)
│   └── device-selector.tsx
│
└── ui/                         # Shadcn UI primitives (no change)
    ├── button.tsx
    ├── input.tsx
    └── ...
```

---

## Migration Phases

### Phase 1: Preparation & Foundation (Week 1, Day 1-2)
**Goal**: Set up new structure without breaking anything

**Tasks**:
1. ✅ Create new directory structure (empty)
   ```bash
   mkdir -p src/components/features/{nautobot,checkmk,network,jobs,settings,profile}
   mkdir -p src/components/features/nautobot/{add-device,onboard,offboard,sync-devices,export,tools}
   mkdir -p src/components/features/nautobot/tools/{bulk-edit,check-ip}
   mkdir -p src/components/features/checkmk/{sync-devices,live-update,hosts-inventory}
   mkdir -p src/components/features/network/{configs,automation,compliance,tools}
   mkdir -p src/components/features/network/configs/{view,backup,compare}
   mkdir -p src/components/features/network/automation/{netmiko,ansible-inventory,templates}
   mkdir -p src/components/features/network/tools/ping
   mkdir -p src/components/layout
   ```

2. ✅ Create path mapping document (for reference during migration)
   - Document old → new paths in a CSV/spreadsheet
   - Will help with automated find-replace

3. ✅ Set up git branch for migration
   ```bash
   git checkout -b refactor/component-structure
   ```

**Deliverables**:
- Empty feature directories created
- Migration tracking spreadsheet
- Feature branch ready

**Risk**: None (no code changes yet)

---

### Phase 2: Layout Components (Week 1, Day 3)
**Goal**: Move layout components first (smallest, easiest)

**Tasks**:
1. Move layout files
   ```bash
   git mv src/components/app-sidebar.tsx src/components/layout/
   git mv src/components/dashboard-layout.tsx src/components/layout/
   git mv src/components/sidebar-context.tsx src/components/layout/
   git mv src/components/session-status.tsx src/components/layout/
   git mv src/components/dashboard-*.tsx src/components/layout/
   ```

2. Update imports in all files that use these components
   ```typescript
   // OLD:
   import { DashboardLayout } from '@/components/dashboard-layout'

   // NEW:
   import { DashboardLayout } from '@/components/layout/dashboard-layout'
   ```

3. Create barrel export (optional but recommended)
   ```typescript
   // src/components/layout/index.ts
   export { DashboardLayout } from './dashboard-layout'
   export { AppSidebar } from './app-sidebar'
   export { SidebarProvider, useSidebar } from './sidebar-context'
   export { SessionStatus } from './session-status'
   ```

4. Test build and run
   ```bash
   npm run build
   npm run dev
   ```

**Files Affected**: ~10-15 import statements
**Time Estimate**: 2-3 hours
**Risk**: Low (isolated change)

**Rollback**: `git reset --hard` if issues

---

### Phase 3: Nautobot Features (Week 1, Day 4-5)
**Goal**: Consolidate all Nautobot-related components

**Priority Order** (easiest first):
1. `nautobot-export/` → `features/nautobot/export/`
2. `sync-devices/` → `features/nautobot/sync-devices/`
3. `offboard-device/` → `features/nautobot/offboard/`
4. `onboard-device/` → `features/nautobot/onboard/`
5. `bulk-edit/` → `features/nautobot/tools/bulk-edit/`
6. `nautobot-add-device/` → `features/nautobot/add-device/` (largest, do last)

**Migration Script** (per component):
```bash
#!/bin/bash
# Example: migrate-nautobot-export.sh

OLD_PATH="src/components/nautobot-export"
NEW_PATH="src/components/features/nautobot/export"

# 1. Move directory
git mv $OLD_PATH $NEW_PATH

# 2. Update imports in moved files (internal references)
find $NEW_PATH -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  's|@/components/nautobot-export|@/components/features/nautobot/export|g'

# 3. Find all files that import from old path
grep -r "@/components/nautobot-export" src/ --include="*.tsx" --include="*.ts" | \
  cut -d: -f1 | sort -u > /tmp/files_to_update.txt

# 4. Update imports in those files
while read file; do
  sed -i '' 's|@/components/nautobot-export|@/components/features/nautobot/export|g' "$file"
done < /tmp/files_to_update.txt

# 5. Test
npm run build
```

**Tasks**:
1. Run migration script for each component (one at a time)
2. After each component:
   - Run `npm run build` to check for errors
   - Run `npm run lint` to check for issues
   - Test the specific page/feature in browser
   - Commit: `git commit -m "refactor: move nautobot-export to features/nautobot/export"`

**Files Affected**: ~100-150 import statements
**Time Estimate**: 1-2 days
**Risk**: Medium (many imports to update)

**Testing Checklist** (after each move):
- [ ] Build succeeds
- [ ] Linting passes
- [ ] Feature loads in browser
- [ ] No console errors
- [ ] Navigation works

---

### Phase 4: Network Features (Week 2, Day 1-2)
**Goal**: Consolidate network-related components

**Priority Order**:
1. `tools/` → `features/network/tools/` (small)
2. `compliance/` → `features/network/compliance/`
3. `compare/` → `features/network/configs/compare/`
4. `backup/` → `features/network/configs/backup/`
5. `configs/` → `features/network/configs/view/`
6. `ansible-inventory/` → `features/network/automation/ansible-inventory/`
7. `netmiko/` → `features/network/automation/netmiko/` (largest)

**Tasks**: Same as Phase 3 (use migration script)

**Files Affected**: ~80-120 import statements
**Time Estimate**: 1-2 days
**Risk**: Medium

---

### Phase 5: Remaining Features (Week 2, Day 3-4)
**Goal**: Move remaining top-level features

**Components to Move**:
1. `checkmk/` → `features/checkmk/`
2. `jobs/` → `features/jobs/`
3. `settings/` → `features/settings/`
4. `profile/` → `features/profile/`

**Tasks**: Same migration script pattern

**Files Affected**: ~60-80 import statements
**Time Estimate**: 1-2 days
**Risk**: Low (well-established pattern by now)

---

### Phase 6: Cleanup & Optimization (Week 2, Day 5)
**Goal**: Polish and optimize the new structure

**Tasks**:
1. **Add barrel exports** for common imports
   ```typescript
   // src/components/features/nautobot/index.ts
   export { AddDevicePage } from './add-device/add-device-page'
   export { OnboardPage } from './onboard/onboard-page'
   export { BulkEditPage } from './tools/bulk-edit/bulk-edit-page'
   ```

2. **Create README files** for each feature area
   ```markdown
   # Nautobot Components

   This directory contains all Nautobot-related components.

   ## Structure
   - `add-device/` - Add device to Nautobot
   - `onboard/` - Device onboarding workflow
   - `tools/bulk-edit/` - Bulk edit devices
   ```

3. **Update tsconfig paths** (optional - for cleaner imports)
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/components/features/nautobot/*": ["./src/components/features/nautobot/*"],
         "@/features/nautobot/*": ["./src/components/features/nautobot/*"]
       }
     }
   }
   ```

4. **Remove old directories** (verify they're empty)
   ```bash
   rmdir src/components/nautobot-add-device  # Should be empty now
   rmdir src/components/bulk-edit
   # etc.
   ```

5. **Update documentation**
   - Update CLAUDE.md with new structure
   - Update component organization section

6. **Final validation**
   ```bash
   npm run build          # Full build
   npm run lint           # Linting
   npm run type-check     # TypeScript check
   ```

**Time Estimate**: 4-6 hours
**Risk**: Very Low

---

## Migration Automation Script

### Full Migration Script
```bash
#!/bin/bash
# migrate-components.sh - Component migration automation

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Migration map (OLD_PATH:NEW_PATH)
declare -A MIGRATIONS=(
  # Layout
  ["components/app-sidebar.tsx"]="components/layout/app-sidebar.tsx"
  ["components/dashboard-layout.tsx"]="components/layout/dashboard-layout.tsx"
  ["components/sidebar-context.tsx"]="components/layout/sidebar-context.tsx"

  # Nautobot
  ["components/nautobot-export"]="components/features/nautobot/export"
  ["components/nautobot-add-device"]="components/features/nautobot/add-device"
  ["components/sync-devices"]="components/features/nautobot/sync-devices"
  ["components/onboard-device"]="components/features/nautobot/onboard"
  ["components/offboard-device"]="components/features/nautobot/offboard"
  ["components/bulk-edit"]="components/features/nautobot/tools/bulk-edit"

  # Network
  ["components/configs"]="components/features/network/configs/view"
  ["components/backup"]="components/features/network/configs/backup"
  ["components/compare"]="components/features/network/configs/compare"
  ["components/netmiko"]="components/features/network/automation/netmiko"
  ["components/ansible-inventory"]="components/features/network/automation/ansible-inventory"
  ["components/compliance"]="components/features/network/compliance"
  ["components/tools"]="components/features/network/tools"

  # Other features
  ["components/checkmk"]="components/features/checkmk"
  ["components/jobs"]="components/features/jobs"
  ["components/settings"]="components/features/settings"
  ["components/profile"]="components/features/profile"
)

migrate_component() {
  local old_path="$1"
  local new_path="$2"

  echo -e "${YELLOW}Migrating: $old_path → $new_path${NC}"

  # Create parent directory
  mkdir -p "src/$(dirname "$new_path")"

  # Move files
  if [ -e "src/$old_path" ]; then
    git mv "src/$old_path" "src/$new_path"
  else
    echo -e "${RED}Warning: $old_path does not exist${NC}"
    return 1
  fi

  # Update imports in moved files
  local old_import="@/${old_path%.*}"
  local new_import="@/${new_path%.*}"

  if [ -d "src/$new_path" ]; then
    # Directory - update all files inside
    find "src/$new_path" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec \
      sed -i '' "s|${old_import}|${new_import}|g" {} \;
  fi

  # Find and update all files that import from old path
  echo "  Updating imports in other files..."
  grep -r "${old_import}" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | \
    cut -d: -f1 | sort -u | while read file; do
      sed -i '' "s|${old_import}|${new_import}|g" "$file"
      echo "    Updated: $file"
    done

  echo -e "${GREEN}✓ Migration complete${NC}"
}

# Main execution
echo -e "${GREEN}Starting component migration...${NC}"

for old_path in "${!MIGRATIONS[@]}"; do
  new_path="${MIGRATIONS[$old_path]}"
  migrate_component "$old_path" "$new_path"

  # Build check after each migration
  echo "  Running build check..."
  if npm run build &> /dev/null; then
    echo -e "  ${GREEN}✓ Build successful${NC}"
    git add -A
    git commit -m "refactor: move $old_path to $new_path"
  else
    echo -e "  ${RED}✗ Build failed - rolling back${NC}"
    git reset --hard HEAD
    exit 1
  fi
done

echo -e "${GREEN}All migrations complete!${NC}"
```

**Usage**:
```bash
chmod +x migrate-components.sh
./migrate-components.sh
```

---

## Risk Mitigation

### Rollback Strategy
At any point, you can rollback:
```bash
# Rollback last commit
git reset --hard HEAD~1

# Rollback entire migration
git reset --hard main
git branch -D refactor/component-structure
```

### Testing Strategy
After each phase:
1. ✅ Run `npm run build` - must succeed
2. ✅ Run `npm run lint` - must pass
3. ✅ Run `npm run type-check` - must pass
4. ✅ Manual browser testing - navigate to affected pages
5. ✅ Check console for errors
6. ✅ Test feature functionality

### Gradual Rollout
- Merge to `main` after each phase completes successfully
- Can pause migration at any phase boundary
- Each phase is independently functional

---

## Success Criteria

### Metrics
- [ ] All components in feature-based directories
- [ ] No broken imports
- [ ] Build succeeds
- [ ] All linting passes
- [ ] All TypeScript checks pass
- [ ] All features work in browser
- [ ] No console errors
- [ ] Documentation updated

### Benefits Achieved
- ✅ Improved discoverability (related components together)
- ✅ Scalability (can add features easily)
- ✅ Consistency (clear naming patterns)
- ✅ Better IDE navigation
- ✅ Easier onboarding for new developers

---

## Timeline Summary

| Phase | Duration | Risk | Can Pause After? |
|-------|----------|------|------------------|
| 1. Preparation | 0.5 days | None | ✅ Yes |
| 2. Layout | 0.5 days | Low | ✅ Yes |
| 3. Nautobot | 2 days | Medium | ✅ Yes |
| 4. Network | 2 days | Medium | ✅ Yes |
| 5. Remaining | 2 days | Low | ✅ Yes |
| 6. Cleanup | 1 day | Very Low | ✅ Yes |
| **Total** | **8 days** | **Low** | **Very flexible** |

---

## Post-Migration Maintenance

### New Component Guidelines
When adding new components:

1. **Identify the domain**: Nautobot, CheckMK, Network, Jobs, Settings
2. **Place in appropriate feature directory**
   ```
   features/nautobot/new-feature/
   ```
3. **Follow naming conventions**
   - Use kebab-case for directories
   - Use PascalCase for component files
   - Name main component file after feature (e.g., `new-feature-page.tsx`)

4. **Create sub-structure for complex features**
   ```
   new-feature/
   ├── new-feature-page.tsx       # Main component
   ├── components/                # Sub-components
   │   └── feature-dialog.tsx
   ├── hooks/                     # Custom hooks
   │   └── use-feature-data.ts
   ├── types.ts                   # TypeScript types
   └── utils.ts                   # Helper functions
   ```

### Update Checklist
- [ ] Add to appropriate feature directory
- [ ] Update barrel export (index.ts) if applicable
- [ ] Add README if creating new feature area
- [ ] Follow established patterns

---

## Appendix

### A. Path Mapping Reference

| Old Path | New Path | Component Count |
|----------|----------|-----------------|
| `components/nautobot-add-device/` | `features/nautobot/add-device/` | 1 (large) |
| `components/bulk-edit/` | `features/nautobot/tools/bulk-edit/` | ~10 |
| `components/netmiko/` | `features/network/automation/netmiko/` | ~15 |
| (Add all mappings here) | | |

### B. Import Statement Examples

**Before**:
```typescript
import { AddDevicePage } from '@/components/nautobot-add-device/add-device-page'
import { BulkEditDialog } from '@/components/bulk-edit/dialogs/bulk-edit-dialog'
import { NetmikoPage } from '@/components/netmiko/netmiko-page'
```

**After**:
```typescript
import { AddDevicePage } from '@/components/features/nautobot/add-device/add-device-page'
import { BulkEditDialog } from '@/components/features/nautobot/tools/bulk-edit/dialogs/bulk-edit-dialog'
import { NetmikoPage } from '@/components/features/network/automation/netmiko/netmiko-page'
```

**With Barrel Exports** (optional):
```typescript
import { AddDevicePage } from '@/features/nautobot'
import { BulkEditDialog } from '@/features/nautobot/tools'
import { NetmikoPage } from '@/features/network/automation'
```

### C. Frequently Asked Questions

**Q: Can we do this migration incrementally over several weeks?**
A: Yes! Each phase can be done independently and merged to main. You can pause between phases.

**Q: What if we find issues after merging a phase?**
A: Each phase is committed separately, so you can revert just that phase if needed.

**Q: Will this affect production?**
A: No, this is purely internal reorganization. The built output and routes remain the same.

**Q: Can we add new features during migration?**
A: Yes, but add them to the new structure in `features/` to avoid migration work.

**Q: What about shared components used across features?**
A: Keep them in `/shared` or move to the most appropriate feature (if 80%+ usage is in one area).

---

## Next Steps

1. **Review this plan** with the team
2. **Create tracking spreadsheet** with all components
3. **Set up feature branch**: `git checkout -b refactor/component-structure`
4. **Start Phase 1** (preparation)
5. **Execute phase-by-phase**, testing after each
6. **Merge to main** after each successful phase

---

**Document Version**: 1.0
**Last Updated**: 2025-12-27
**Author**: Claude
**Status**: Ready for Implementation
