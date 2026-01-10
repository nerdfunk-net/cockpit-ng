# Refactoring Plan for `device-selector.tsx`

## Objective
Refactor `src/components/shared/device-selector.tsx` to improve maintainability, following the pattern used in `hosts-inventory-page.tsx`.

## Strategy
1.  **Extract Types**: Move interfaces and types to a dedicated definition file.
2.  **Extract Hooks**: Move state management and business logic into custom hooks.
3.  **Extract Components**: Break down the monolithic component into smaller, focused sub-components.

## Detailed Steps

### 1. Extract Types
Create `src/types/shared/device-selector.ts` and move the following interfaces:
- `LogicalCondition`
- `ConditionItem`
- `ConditionGroup`
- `ConditionTree`
- `DeviceInfo`
- `FieldOption`
- `LocationItem`
- `CustomField`
- `BackendConditionsResponse`
- `DeviceSelectorProps`

### 2. Extract Hooks
Create `src/hooks/shared/device-selector/` and extract:
- `useConditionTree`: Logic for adding/removing/grouping conditions.
- `useDeviceFilter`: Logic for handling field options, operators, and values.
- `useDevicePreview`: Logic for fetching and previewing devices.
- `useSavedInventories`: Logic for loading/saving inventory configurations.

### 3. Extract Components
Create `src/components/shared/device-selector/` components:
- `ConditionTreeBuilder`: The visual tree editor.
- `ConditionGroup`: Logic for rendering a group of conditions.
- `ConditionItem`: Logic for rendering a single condition row.
- `DeviceTable`: The table showing preview results.
- `SaveInventoryModal`: Modal for saving.
- `LoadInventoryModal`: Modal for loading.

## File Structure Changes
```text
src/
  components/
    shared/
      device-selector.tsx (Modify to use extracted parts)
      device-selector-components/ (New Directory)
          condition-tree-builder.tsx
          condition-group.tsx
          condition-item.tsx
          device-table.tsx
          save-inventory-modal.tsx
          load-inventory-modal.tsx
  hooks/
    shared/
      device-selector/  <-- NEW DIRECTORY
        use-condition-tree.ts
        use-device-filter.ts
        use-device-preview.ts
        use-saved-inventories.ts
  types/
    shared/
      device-selector.ts <-- NEW FILE
```
