# Bug Fix: Inventory Groups Flattening After Preview

## Problem Description

When using the inventory feature in Netmiko, Compliance, Bulk Edit, or Export apps:
1. User loads a saved inventory with grouped expressions
2. Groups display correctly ✅
3. User clicks "Preview Results"
4. **Groups disappear and expression becomes flat** ❌

This issue **did NOT** occur in the Ansible Inventory app.

## Root Cause Analysis

### The Feedback Loop

The shared `device-selection-tab.tsx` component was passing `initialConditions` and `initialDevices` props to `DeviceSelector`, creating a problematic feedback loop:

```typescript
// device-selection-tab.tsx (BEFORE FIX)
<DeviceSelector
  onDevicesSelected={onDevicesSelected}
  initialConditions={deviceConditions}  // ❌ PROBLEM
  initialDevices={previewDevices}       // ❌ PROBLEM
  ...
/>
```

**Flow of the bug:**

1. User loads inventory → Tree structure loaded into DeviceSelector ✅
2. User clicks "Preview" → DeviceSelector calls `onDevicesSelected(devices, **flatConditions**)`
3. Parent component (netmiko-page.tsx) sets state: `setDeviceConditions(flatConditions)`
4. device-selection-tab.tsx receives updated props
5. device-selection-tab.tsx passes `initialConditions={flatConditions}` back to DeviceSelector
6. DeviceSelector's useEffect detects prop change
7. DeviceSelector converts flat conditions → tree (loses all grouping) ❌

### Why Ansible Inventory Worked

The ansible-inventory-page.tsx **never passed** `initialConditions` or `initialDevices` to DeviceSelector:

```typescript
// ansible-inventory-page.tsx (CORRECT PATTERN)
<DeviceSelector
  onDevicesSelected={handleDevicesSelected}
  showActions={true}
  showSaveLoad={true}
  enableSelection={false}
  // NO initialConditions or initialDevices! ✅
/>
```

DeviceSelector manages its own state internally and only communicates **outward** via callbacks.

## The Fix

### Changes Made

1. **Removed props from device-selection-tab.tsx interface**:
   ```typescript
   interface DeviceSelectionTabProps {
     // Removed: previewDevices, deviceConditions
     selectedDeviceIds: string[]
     selectedDevices: DeviceInfo[]
     onDevicesSelected: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
     onSelectionChange: (selectedIds: string[], devices: DeviceInfo[]) => void
     ...
   }
   ```

2. **Removed props from DeviceSelector usage**:
   ```typescript
   <DeviceSelector
     onDevicesSelected={onDevicesSelected}
     showActions={true}
     showSaveLoad={true}
     enableSelection={true}
     selectedDeviceIds={selectedDeviceIds}
     onSelectionChange={onSelectionChange}
     // NO initialConditions or initialDevices
   />
   ```

3. **Updated all parent components**:
   - [netmiko-page.tsx](frontend/src/components/features/network/automation/netmiko/netmiko-page.tsx:160-165)
   - [compliance-page.tsx](frontend/src/components/features/network/compliance/compliance-page.tsx:64-69)
   - [bulk-edit-page.tsx](frontend/src/components/features/nautobot/tools/bulk-edit/bulk-edit-page.tsx:354-360)
   - [nautobot-export/page.tsx](frontend/src/app/(dashboard)/nautobot-export/page.tsx:164-169)

## Result

✅ **Groups are now preserved** across save/load/preview operations in all apps
✅ **Consistent behavior** across all inventory features
✅ **DeviceSelector is truly self-contained** - manages own state internally
✅ **Matches the proven pattern** from ansible-inventory-page

## Testing

### Test Case 1: Grouped Expression with Preview
1. Go to Netmiko app
2. Create expression: `(Location = City A OR Location = City B) AND Status = Active`
3. Click "Preview Results"
4. **Expected**: Groups remain intact ✅
5. **Before Fix**: Groups would flatten ❌

### Test Case 2: Load Saved Inventory
1. Go to any app (Netmiko, Compliance, Bulk Edit, Export)
2. Load a saved inventory with groups
3. Click "Preview Results"
4. **Expected**: Groups remain intact ✅
5. **Before Fix**: Groups would flatten ❌

### Test Case 3: Save and Reload
1. Create grouped expression
2. Save inventory
3. Clear expression
4. Load saved inventory
5. **Expected**: Groups display correctly ✅

## Key Architectural Lesson

**When using shared components with internal state:**

✅ **DO**: Let the component manage its own state
✅ **DO**: Communicate via callbacks (unidirectional data flow)
✅ **DON'T**: Pass state back to the component as props (creates feedback loops)

This is the **React controlled vs uncontrolled component** pattern:
- **Controlled**: Parent manages state, passes it down (use when parent needs full control)
- **Uncontrolled**: Component manages own state, reports changes via callbacks (use for complex internal state)

DeviceSelector has complex tree-based state → **Uncontrolled pattern is correct** ✅

## Commits

1. `🐛 fix(inventory): Store tree structure directly instead of flattening` - Initial tree save/load fix
2. `🐛 fix(backend): Accept tree structure in inventory models` - Backend validation fix
3. `🐛 fix(backend): Remove model_dump() calls for dict conditions` - Backend model_dump fix
4. `🐛 fix(inventory): Remove feedback loop causing group flattening` - **This commit**

## Files Changed (This Commit)

- `/frontend/src/components/shared/device-selection-tab.tsx`
- `/frontend/src/components/features/network/automation/netmiko/netmiko-page.tsx`
- `/frontend/src/components/features/network/automation/netmiko/tabs/device-selection-tab.tsx`
- `/frontend/src/components/features/network/compliance/compliance-page.tsx`
- `/frontend/src/components/features/network/compliance/tabs/device-selection-tab.tsx`
- `/frontend/src/components/features/nautobot/tools/bulk-edit/bulk-edit-page.tsx`
- `/frontend/src/components/features/nautobot/tools/bulk-edit/tabs/device-selection-tab.tsx`
- `/frontend/src/components/features/nautobot/export/tabs/device-selection-tab.tsx`
- `/frontend/src/app/(dashboard)/nautobot-export/page.tsx`

Total: 9 files changed, 22 deletions
