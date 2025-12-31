# Logical Expression Parser - Feature Guide

## Overview

The logical expression parser enables you to build complex device filter expressions with proper bracket precedence using AND, OR, and NOT operations.

## What's New

### Before (Flat Structure)
Previously, you could only build flat expressions without control over evaluation order:
```
Location = LAB AND Status = Active OR Location = DC1
```
This would be evaluated as: `(Location = LAB AND Status = Active) OR Location = DC1`

### After (Tree Structure with Groups)
Now you can group conditions to control precedence:
```
(Location = LAB OR Location = DC1) AND Status = Active
```

## How to Use

### Building Simple Conditions

1. Select a field (Location, Role, Status, etc.)
2. Choose an operator (equals, contains)
3. Enter a value
4. Select logic operator for the NEXT item (AND, OR, NOT)
5. Click the **"+"** button to add the condition

### Creating Groups

1. Fill in the field/operator/value as normal
2. Click the **"+ Group"** button instead of the regular "+" button
3. This creates an empty group you can add conditions to later
4. Groups have their own internal logic (AND or OR)
5. Click **"Toggle"** on a group to switch between AND/OR logic

### Targeting Groups (Where to Add Conditions)

**NEW FEATURE**: You can now choose where to add conditions!

1. **By default**, conditions are added to **Root** level
2. **Click on a group** to set it as the active target
3. The group will **highlight in blue** and show **"Active Target"** badge
4. All new conditions will be added **inside** that group
5. Click **"Back to Root"** button to return to adding at root level

**Visual Cues**:
- **Target indicator** at top shows current location (e.g., "Adding conditions to: Root")
- **Blue highlight**: Active group receiving new conditions
- **Purple highlight**: Inactive groups (hover to see clickable effect)
- **"Active Target"** badge: Shows which group is currently selected

### Visual Indicators

- **Blue boxes**: Individual conditions
- **Purple boxes with left border**: Groups (click to set as target)
- **Blue boxes with darker border**: Active target group
- **"GROUP (AND)"** or **"GROUP (OR)"**: Shows the group's internal logic
- **"Active Target"** badge: Appears on the currently selected group
- **Root logic badge**: Shows how top-level items are combined

## Example Use Cases

### Example 1: Multiple Locations with Status Filter
**Goal**: Get devices from LAB or DC1 that are Active

**Expression**: `(Location = LAB OR Location = DC1) AND Status = Active`

**Steps** (Updated with new targeting feature):
1. **Create a new group**: Click **"+ Group"** button
   - Empty group is created at root level
2. **Click on the group** to set it as active target
   - Group highlights in blue, shows "Active Target" badge
   - Top indicator shows: "Adding conditions to: Group 1"
3. **Add first location**: Field=Location, Value=City A, click **"+"**
   - Condition added inside the group
4. **Add second location**: Field=Location, Value=City B, click **"+"**
   - Another condition added inside the same group
5. **Toggle group logic**: Click **"Toggle"** button on group to change from AND to OR
6. **Go back to root**: Click **"Back to Root"** button
   - Top indicator shows: "Adding conditions to: Root"
7. **Add status condition**: Field=Status, Value=Active, click **"+"**
   - Condition added at root level (outside the group)

**Result Tree**:
```
ROOT (AND logic)
├─ GROUP (OR logic)          ← Contains location conditions
│  ├─ Location = City A
│  └─ Location = City B
└─ Status = Active           ← At root level
```

**Evaluation**:
1. Group evaluates to: devices in City A **OR** City B
2. Root combines with: result **AND** Active status
3. Final: Active devices from either City A or City B

### Example 2: Exclude Deprecated Devices
**Goal**: Get all active switches excluding deprecated ones

**Expression**: `Role = Switch AND Status = Active AND NOT Tag = deprecated`

**Steps**:
1. Add condition: Role = Switch
2. Add condition: Status = AND, Active
3. Add condition: Tag = AND NOT, deprecated

**Evaluation**:
1. Devices with Role = Switch
2. **AND** Status = Active
3. **AND NOT** Tag = deprecated

### Example 3: Complex Multi-Group Expression
**Goal**: `(Location = LAB AND Role = Router) OR (Location = DC1 AND Role = Switch)`

**Steps**:
1. Create Group 1 (internal logic: AND)
   - Add: Location = LAB
   - Add: Role = AND, Router
2. Create Group 2 (logic before: OR, internal logic: AND)
   - Add: Location = DC1
   - Add: Role = AND, Switch
3. Set root logic to OR

**Evaluation**:
1. Group 1: LAB Routers
2. Group 2: DC1 Switches
3. Combined with OR: LAB Routers **OR** DC1 Switches

## Backend Evaluation

The backend receives a properly structured operation tree and evaluates it respecting the correct order:

```javascript
{
  "operation_type": "AND",
  "conditions": [...],
  "nested_operations": [
    {
      "operation_type": "OR",
      "conditions": [...],
      "nested_operations": []
    }
  ]
}
```

The backend's `_execute_operation()` function recursively evaluates nested operations, ensuring proper precedence.

## Tips

1. **Start simple**: Add individual conditions first, then group them if needed
2. **Use Toggle**: Quickly switch group logic between AND/OR
3. **Visual feedback**: Purple groups show nesting clearly
4. **Test incrementally**: Use "Preview Results" after building each group
5. **Root logic matters**: Don't forget to check the root-level logic operator

## Limitations

- Groups must have at least one condition to be meaningful
- NOT logic applies to the entire group/condition that follows
- Maximum nesting level is unlimited, but keep it readable

## Troubleshooting

### Issue: Empty Groups
**Symptom**: Group shows "Empty group - add conditions here"
**Solution**: Add at least one condition to the group before previewing

### Issue: Unexpected Results
**Symptom**: Preview returns wrong devices
**Solution**:
1. Check root logic indicator
2. Verify each group's internal logic (AND vs OR)
3. Review the logic operators between items
4. Check browser console for generated operations JSON

### Issue: Can't Delete Group
**Symptom**: Group won't delete
**Solution**: Click the X button on the group header (not individual conditions)

## Future Enhancements

Potential improvements for future versions:
- Drag-and-drop condition reordering
- Group nesting indicators (breadcrumbs)
- Visual expression preview in text form
- Copy/paste groups
- Named group templates
