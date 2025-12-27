# Component Migration Quick Start Guide

## Prerequisites

Before starting the migration:

1. ✅ **Commit all current work**
   ```bash
   git add .
   git commit -m "chore: save work before component migration"
   ```

2. ✅ **Create feature branch**
   ```bash
   git checkout -b refactor/component-structure
   ```

3. ✅ **Ensure clean build**
   ```bash
   cd frontend
   npm run build
   npm run lint
   ```

---

## Option 1: Use the Migration Script (Recommended)

The migration script handles everything automatically:

### Single Component Migration

```bash
# From project root
./migrate-component.sh components/nautobot-export components/features/nautobot/export
```

The script will:
1. ✅ Create new directories
2. ✅ Move files with git
3. ✅ Update all imports
4. ✅ Test build
5. ✅ Commit changes
6. ✅ Rollback on error

### Example: Migrate Layout Components (Phase 2)

```bash
# Move layout components one by one
./migrate-component.sh components/app-sidebar.tsx components/layout/app-sidebar.tsx
./migrate-component.sh components/dashboard-layout.tsx components/layout/dashboard-layout.tsx
./migrate-component.sh components/sidebar-context.tsx components/layout/sidebar-context.tsx
./migrate-component.sh components/session-status.tsx components/layout/session-status.tsx
```

**Time**: ~5 minutes per component

---

## Option 2: Manual Migration (For Learning)

If you want to understand the process:

### Step-by-Step Manual Migration

#### Example: Migrate `nautobot-export`

```bash
cd frontend/src
```

**1. Create directory structure**
```bash
mkdir -p components/features/nautobot/export
```

**2. Move files**
```bash
git mv components/nautobot-export components/features/nautobot/export
```

**3. Find all files that import from old path**
```bash
grep -r "@/components/nautobot-export" . --include="*.tsx" --include="*.ts"
```

**4. Update imports**
```bash
# Update in moved files (if directory)
find components/features/nautobot/export -type f \( -name "*.tsx" -o -name "*.ts" \) -exec \
  sed -i '' 's|@/components/nautobot-export|@/components/features/nautobot/export|g' {} \;

# Update in other files
find . -type f \( -name "*.tsx" -o -name "*.ts" \) -exec \
  sed -i '' 's|@/components/nautobot-export|@/components/features/nautobot/export|g' {} \;
```

**5. Test**
```bash
cd ..
npm run build
npm run lint
```

**6. Commit**
```bash
git add -A
git commit -m "refactor: move nautobot-export to features/nautobot/export"
```

**Time**: ~15-20 minutes per component

---

## Recommended Migration Order

### Day 1: Layout (Easy, Low Risk)
```bash
# Phase 2: Layout Components (~2 hours total)
./migrate-component.sh components/app-sidebar.tsx components/layout/app-sidebar.tsx
./migrate-component.sh components/dashboard-layout.tsx components/layout/dashboard-layout.tsx
./migrate-component.sh components/sidebar-context.tsx components/layout/sidebar-context.tsx
./migrate-component.sh components/session-status.tsx components/layout/session-status.tsx

# Create barrel export
cat > components/layout/index.ts << 'EOF'
export { DashboardLayout } from './dashboard-layout'
export { AppSidebar } from './app-sidebar'
export { SidebarProvider, useSidebar } from './sidebar-context'
export { SessionStatus } from './session-status'
EOF

git add components/layout/index.ts
git commit -m "feat: add barrel export for layout components"

# Test everything still works
npm run dev
# Navigate to http://localhost:3000 and verify sidebar works
```

### Day 2-3: Small Nautobot Features
```bash
# Start with smallest features first (easiest)
./migrate-component.sh components/nautobot-export components/features/nautobot/export
./migrate-component.sh components/sync-devices components/features/nautobot/sync-devices
./migrate-component.sh components/offboard-device components/features/nautobot/offboard
./migrate-component.sh components/onboard-device components/features/nautobot/onboard
```

### Day 4-5: Large Nautobot Features
```bash
# Larger features - do one per session
./migrate-component.sh components/bulk-edit components/features/nautobot/tools/bulk-edit
# Test thoroughly - this is complex

./migrate-component.sh components/nautobot-add-device components/features/nautobot/add-device
# Test thoroughly - this is the largest component
```

---

## Verification Checklist

After each migration, verify:

### Build & Lint
```bash
npm run build        # ✅ Must succeed
npm run lint         # ✅ Must pass (warnings OK)
npm run type-check   # ✅ Must pass
```

### Browser Testing
1. Start dev server: `npm run dev`
2. Navigate to the migrated feature
3. Check browser console (should be no errors)
4. Test the feature works (click buttons, navigate)
5. Check network tab (API calls work)

### Example: Testing Nautobot Export
```bash
# After migrating nautobot-export
npm run dev

# In browser:
# 1. Go to http://localhost:3000/nautobot-export
# 2. Verify page loads
# 3. Verify no console errors
# 4. Test export functionality
```

---

## Troubleshooting

### Problem: Build fails after migration

**Check the error**:
```bash
npm run build 2>&1 | tee build.log
cat build.log | grep -i error
```

**Common issues**:
1. **Missed import**: Search for old import path
   ```bash
   grep -r "@/components/old-path" src/
   ```

2. **Circular dependency**: Check component imports
   ```bash
   # Look for components importing each other
   grep -r "from '@/components/features/nautobot/add-device'" src/components/features/nautobot/
   ```

**Rollback**:
```bash
git reset --hard HEAD~1  # Undo last commit
```

### Problem: TypeScript errors

**Find all TS errors**:
```bash
npm run type-check 2>&1 | grep "error TS"
```

**Fix**: Update import paths in those files

### Problem: Feature doesn't load in browser

**Check**:
1. Browser console errors?
2. Network tab showing 404s?
3. Import paths correct in page file?

**Debug**:
```bash
# Find where the page imports the component
grep -r "nautobot-export" src/app/
```

---

## Emergency Rollback

If something goes wrong and you want to start over:

```bash
# Reset to before migration started
git reset --hard main
git branch -D refactor/component-structure

# Start fresh
git checkout -b refactor/component-structure
```

---

## Progress Tracking

Use the CSV file to track progress:

```bash
# Open in spreadsheet app
open MIGRATION_TRACKING.csv

# Or view in terminal
column -t -s',' MIGRATION_TRACKING.csv | less
```

Update status column:
- `Pending` → `In Progress` → `Done` → `Tested` → `Merged`

---

## After Each Phase

1. **Test thoroughly**
   ```bash
   npm run build
   npm run lint
   npm test  # if you have tests
   ```

2. **Merge to main** (recommended after each phase)
   ```bash
   git checkout main
   git merge refactor/component-structure
   git push origin main
   ```

3. **Continue or pause**
   - Can continue to next phase
   - OR pause and resume later (each phase is independent)

---

## Time Estimates

| Phase | Components | Time (Script) | Time (Manual) |
|-------|-----------|---------------|---------------|
| 1. Prep | N/A | 30 min | 30 min |
| 2. Layout | 4 files | 30 min | 2 hours |
| 3. Nautobot | 6 dirs | 2 hours | 1 day |
| 4. Network | 7 dirs | 2 hours | 1 day |
| 5. Other | 4 dirs | 1 hour | 4 hours |
| 6. Cleanup | N/A | 2 hours | 4 hours |
| **Total** | **21+** | **8 hours** | **2-3 days** |

---

## Tips for Success

1. **Do one at a time** - Don't rush, test after each
2. **Commit frequently** - Each successful migration = 1 commit
3. **Test in browser** - Don't just rely on build passing
4. **Take breaks** - Between phases, not during
5. **Use the script** - It's faster and safer
6. **Document issues** - Note any problems for future reference

---

## Next Steps

1. ✅ Read full plan: `COMPONENT_MIGRATION_PLAN.md`
2. ✅ Review tracking sheet: `MIGRATION_TRACKING.csv`
3. ✅ Create feature branch
4. ✅ Start with Phase 2 (Layout)
5. ✅ Use migration script
6. ✅ Test thoroughly
7. ✅ Merge after each phase

**Ready to start?**

```bash
# Create branch
git checkout -b refactor/component-structure

# Start with layout (easiest)
./migrate-component.sh components/app-sidebar.tsx components/layout/app-sidebar.tsx
```

Good luck! 🚀
