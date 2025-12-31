# Testing Tree Structure Save/Load Fix

## Bug Fixed
**Issue**: Saving inventories with grouped logical expressions would flatten the tree structure. Loading them back would lose all groups.

**Fix**:
- Frontend now saves the complete tree structure as JSON (version 2 format)
- Backend accepts flexible dict structure instead of strict validation
- Load function detects version and handles both new tree format (v2) and legacy flat format (v1)

## Testing Steps

### Prerequisites
1. Restart the backend server to apply the model changes:
   ```bash
   cd /Users/mp/programming/cockpit-ng/backend
   # Stop the current backend (Ctrl+C)
   python start.py
   ```

2. Frontend should already be running on port 3000

### Test 1: Save and Load Grouped Expression

**Step 1: Create a grouped expression**
1. Navigate to the Ansible Inventory page
2. Click "+ Group" to create a group
3. Click on the group to make it the active target (should highlight blue)
4. Add two conditions to the group:
   - Field: Location, Value: "City A", click "+"
   - Field: Location, Value: "City B", click "+"
5. Click "Toggle" on the group to change it to OR logic
6. Click "Back to Root" button
7. Add a condition at root level:
   - Field: Status, Value: "Active", click "+"

**Expected tree structure**:
```
ROOT (AND)
├─ GROUP (OR)
│  ├─ Location equals "City A"
│  └─ Location equals "City B"
└─ Status equals "Active"
```

**Step 2: Save the expression**
1. Click "Save" button
2. Enter inventory name: "Test Grouped Expression"
3. Click "Save Inventory"
4. Should see success message

**Step 3: Clear the current expression**
1. Click the "Clear All" button (rotate icon)
2. Verify the expression area shows "No conditions added yet"

**Step 4: Load the saved expression**
1. Click "Load" button
2. Select "Test Grouped Expression" from the list
3. Click "Load Selected"

**Expected Result**:
- ✅ The group should appear with two conditions inside (City A, City B)
- ✅ The group should show "GROUP (OR)" indicating OR logic
- ✅ The root level should show "Status equals Active"
- ✅ Structure should match exactly what you saved

**Failure Indicator**:
- ❌ All three conditions appear as a flat list at root level
- ❌ No group box visible
- ❌ Group structure is lost

### Test 2: Nested Groups

**Step 1: Create nested groups**
1. Click "Clear All"
2. Click "+ Group" to create first group
3. Click on the group to target it
4. Add condition: Location = "City A"
5. Click "+ Group" inside the first group (creates nested group)
6. Click on the nested group to target it
7. Add condition: Role = "Router"
8. Click "Back to Root"
9. Add condition at root: Status = "Active"

**Expected tree structure**:
```
ROOT (AND)
├─ GROUP (AND)
│  ├─ Location equals "City A"
│  └─ GROUP (AND)
│     └─ Role equals "Router"
└─ Status equals "Active"
```

**Step 2: Save, clear, and reload**
1. Save as "Test Nested Groups"
2. Clear all
3. Load "Test Nested Groups"

**Expected Result**:
- ✅ Nested group structure preserved
- ✅ All three levels visible (root, group, nested group)

### Test 3: Complex Expression with Multiple Groups

**Step 1: Create complex expression**
1. Click "Clear All"
2. Create Group 1: Location = "City A" OR Location = "City B" (OR logic)
3. Back to root
4. Create Group 2: Role = "Router" AND Status = "Active" (AND logic)
5. Toggle root logic to OR

**Expected tree structure**:
```
ROOT (OR)
├─ GROUP (OR)
│  ├─ Location equals "City A"
│  └─ Location equals "City B"
└─ GROUP (AND)
   ├─ Role equals "Router"
   └─ Status equals "Active"
```

**Step 2: Save, clear, and reload**
1. Save as "Test Multiple Groups"
2. Clear all
3. Load "Test Multiple Groups"

**Expected Result**:
- ✅ Both groups preserved with correct internal logic
- ✅ Root logic shows OR
- ✅ First group shows OR logic
- ✅ Second group shows AND logic

### Test 4: Backward Compatibility (Legacy Format)

**Purpose**: Verify that old saved inventories (v1 flat format) still load correctly

**Note**: If you have any inventories saved before this fix, try loading them. They should still work and be converted to a flat tree structure.

### Test 5: Show Logical Tree Modal

After loading any saved inventory:
1. Click "Show Tree" button
2. Verify the ASCII tree visualization matches the visual tree
3. Copy to clipboard and verify the text format is correct

## Debugging

### Check Browser Console
1. Open browser DevTools (F12)
2. Look for messages:
   - "Loading tree structure (version 2)" - New format loaded successfully
   - "Loading legacy flat conditions (version 1)" - Old format loaded successfully

### Check Saved Data Format
1. Save an expression with groups
2. In browser DevTools → Network tab:
   - Look for POST to `/api/proxy/inventory`
   - Check request payload → `conditions` field
   - Should see: `[{"version": 2, "tree": {...}}]`

### Check Backend Logs
Look for validation errors or successful saves in backend terminal

## Success Criteria

All tests should pass with:
- ✅ Groups preserved across save/load
- ✅ Nested groups work correctly
- ✅ Internal logic (AND/OR) preserved
- ✅ Root logic preserved
- ✅ No validation errors
- ✅ Legacy inventories still load

## Known Issues

None - the fix addresses all identified issues with tree structure preservation.

## Files Changed

### Frontend
- `/frontend/src/components/shared/device-selector.tsx`
  - Modified `handleSaveInventory()` to save tree as JSON
  - Modified `handleLoadInventory()` to detect version and load appropriately

### Backend
- `/backend/models/ansible_inventory.py`
  - Changed `SavedInventory.conditions` to `List[dict]`
- `/backend/routers/inventory/main.py`
  - Changed all request/response models to use `List[dict]` for conditions
