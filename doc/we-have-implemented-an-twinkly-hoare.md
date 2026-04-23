# Inventory Builder: Group Field + File Browser Modals

## Context

The Inventory Builder stores device filter conditions in the `inventories` DB table. Currently inventories have no organization — they're a flat list. We're adding a `group_path` field (a slash-separated path, e.g. `"group_b/group_b_c"`) to let users organize inventories into a nested folder-like hierarchy.

All three inventory modals (Save, Load, Manage) are being redesigned from simple lists into a **file browser layout**:
- **Left panel**: collapsible group tree (like a directory tree)
- **Right panel**: inventories in the selected group (like files)
- **Bottom panel**: General section with description + "Show Tree" toggle

User decisions:
- New groups created by clicking "New Group" in the tree (inline text input, not typed path)
- "Show Tree" in Load/Manage shows the **selected** inventory's condition tree

---

## Backend Changes

### 1. SQLAlchemy model — add `group_path` column
**File:** `/backend/core/models/inventory.py`

Add to `Inventory` class:
```python
group_path = Column(String(1000), nullable=True, default=None)
```
Add to `__table_args__`:
```python
Index("idx_inventory_group_path", "group_path"),
```

### 2. Migration 030
**File:** `/backend/migrations/versions/030_add_inventory_group_path.py`

- Add `group_path VARCHAR(1000) DEFAULT NULL` column to `inventories` table
- Add index `idx_inventory_group_path` on `(group_path)`
- Idempotent: check `information_schema.columns` before ALTER TABLE
- Pattern: follow `029_add_sync_compare_options.py` exactly (raw SQL, conn.commit(), etc.)
- Include `downgrade()` to DROP COLUMN

### 3. Pydantic models
**File:** `/backend/models/inventory.py`

Add `group_path: Optional[str] = Field(None, ...)` to:
- `CreateInventoryRequest`
- `UpdateInventoryRequest`
- `InventoryResponse`

### 4. Persistence service — include `group_path` in dict conversion
**File:** `/backend/services/inventory/persistence_service.py`

Update `_model_to_dict()` to include `group_path` from the SQLAlchemy model. CRUD methods already use Pydantic `model_dump(exclude_unset=True)` so they will automatically include `group_path` when provided.

---

## Frontend Changes

### 5. Type definitions
**File:** `/frontend/src/types/shared/device-selector.ts`

Add `group_path?: string | null` to the inventory shape used in all three modal `savedInventories` props.

### 6. Shared utilities (NEW file)
**File:** `/frontend/src/components/shared/device-selector-components/group-utils.ts`

Export:
- `interface GroupTreeNode { name: string; path: string | null; children: GroupTreeNode[] }`
- `buildGroupTree(inventories: Array<{group_path?: string | null}>): GroupTreeNode` — builds a recursive tree from the flat `group_path` strings; root node has `path: null`
- `generateConditionTreeAscii(tree: ConditionTree): string` — extracted from `logical-tree-modal.tsx` to avoid duplication

Algorithm for `buildGroupTree`: collect all unique non-null group paths; for each path also add its parent prefixes; build recursive tree using `path.split('/')`.

### 7. GroupTreePanel component (NEW file)
**File:** `/frontend/src/components/shared/device-selector-components/group-tree-panel.tsx`

Props:
```typescript
interface GroupTreePanelProps {
  inventories: Array<{ group_path?: string | null }>
  selectedGroup: string | null     // null = root
  onSelectGroup: (path: string | null) => void
  allowCreate?: boolean            // enables "New Group" button
  onCreateGroup?: (parentPath: string | null, name: string) => void
}
```

Behavior:
- Derives group tree via `buildGroupTree(inventories)` (memoized)
- Renders "Root" as the top node, always visible
- Expand/collapse via `Set<string>` state
- Highlights the selected group with blue background
- When `allowCreate=true`: shows `[+ New Group]` button below the selected node; clicking shows inline `<Input>` with Enter/Escape handling
- New group names must not contain `/` (validated inline)
- Calls `onCreateGroup(currentSelectedGroup, newName)` — the parent computes the full path and updates `selectedGroup`

### 8. Redesigned SaveInventoryModal
**File:** `/frontend/src/components/shared/device-selector-components/save-inventory-modal.tsx`

**Dialog size:** `max-w-5xl max-h-[85vh] flex flex-col`

**New props added:**
```typescript
currentConditionTree: ConditionTree   // for Show Tree preview
```
**Group state added:**
```typescript
const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
```
The `onSave` callback gains `group_path?: string` parameter.

**Layout:**
```
DialogHeader: "Save Inventory Filter"
├── Main area (flex row, min-h-0, flex-1)
│   ├── Left  (w-56 shrink-0): GroupTreePanel (allowCreate=true)
│   └── Right (flex-1, overflow-y-auto): read-only file list of inventories in selectedGroup
└── General panel (border-t, p-4)
    ├── Row: Name input + Scope select
    ├── Row: Description textarea
    └── Row: [Show Tree ▼] → toggles ASCII tree from currentConditionTree
DialogFooter: Cancel | Save
```

Right panel "files" show inventory name + badges (scope), no action buttons — purely for context to avoid name collisions.

Overwrite confirmation remains as the existing inline warning.

### 9. Redesigned LoadInventoryModal
**File:** `/frontend/src/components/shared/device-selector-components/load-inventory-modal.tsx`

**Dialog size:** `max-w-5xl max-h-[85vh] flex flex-col`

**State:**
```typescript
const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null)
const [showTree, setShowTree] = useState(false)
```

**Layout:**
```
DialogHeader: "Load Inventory"
├── Main area (flex row, flex-1, min-h-0)
│   ├── Left  (w-56 shrink-0): GroupTreePanel (allowCreate=false)
│   └── Right (flex-1, overflow-y-auto): inventory files in selectedGroup
│       Each file: 📄 name  [scope badge]  created_by
│       Click → setSelectedInventoryId; double-click → load
└── General panel (border-t, p-4, ~160px)
    ├── Description: of selected inventory (or "Select an inventory" placeholder)
    └── [Show Tree ▼] toggle → ASCII tree of selected inventory's ConditionTree
        (parsed from selectedInventory.conditions using version-2 tree format)
DialogFooter: Cancel | Load (disabled when nothing selected)
```

Tree parsing: inline `parseInventoryTree(conditions)` function that handles both v2 tree format and legacy flat format (same logic as `use-saved-inventories.ts:loadInventory`).

### 10. Redesigned ManageInventoryModal
**File:** `/frontend/src/components/shared/device-selector-components/manage-inventory-modal.tsx`

**Dialog size:** `max-w-5xl max-h-[85vh] flex flex-col`

**State:**
```typescript
const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
const [editingId, setEditingId] = useState<number | null>(null)
const [showTree, setShowTree] = useState(false)
const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null)
// ...existing: isDeleting, deleteConfirmId, isExporting, isImporting
```

**Edit form gains:** `editGroup` field (text input pre-filled with current `group_path`, allowing user to type a new path to move the inventory).

**Layout:**
```
DialogHeader: "Manage Inventories"
├── Main area (flex row, flex-1, min-h-0)
│   ├── Left  (w-56 shrink-0): GroupTreePanel (allowCreate=false for navigation)
│   └── Right (flex-1, overflow-y-auto): inventory files in selectedGroup
│       Each file in view mode:
│         📄 name  [scope]   created_by • date
│         Action buttons: [✏️ Edit] [⬇️ Export] [🗑️ Delete]
│       Each file in edit mode:
│         Inline form: Name | Description | Scope | Group (text)
│         [Cancel] [Save Changes]
│       Delete confirmation: inline "Sure?" pattern (unchanged)
└── General panel (border-t, p-4)
    ├── Description of selected inventory
    └── [Show Tree ▼] toggle → ASCII tree
DialogFooter: [Import ⬆️] ... [Close]
```

**`onUpdate` callback gains `group_path` parameter.**

### 11. Update `use-saved-inventories.ts`
**File:** `/frontend/src/hooks/shared/device-selector/use-saved-inventories.ts`

- `saveInventory(name, description, scope, conditionTree, isUpdate, existingId, group_path?)` — include `group_path` in `saveInventoryMutation` payload
- `updateInventoryDetails(id, name, description, scope, group_path?)` — include `group_path` in `updateInventoryMutation` payload
- `LoadedInventoryData` interface: add `group_path?: string | null`
- `loadInventory`: include `group_path` in returned object

### 12. Update `device-selector.tsx`
**File:** `/frontend/src/components/shared/device-selector.tsx`

- Pass `conditionTree` (from `useConditionTree`) to `SaveInventoryModal` as `currentConditionTree`
- Update `onSave` / `onUpdate` callbacks to pass `group_path` through to `useSavedInventories`
- Update `ManageInventoryModal`'s `onUpdate` to accept and forward `group_path`

---

## Verification

1. Restart backend → confirm migration 030 runs in logs: `✓ group_path column added`
2. `psql`: `\d inventories` → confirms `group_path VARCHAR(1000)` column exists
3. Open Inventory Builder → click Save → new file browser modal appears
4. Create a group "test_group" in the left panel → verify it appears in tree
5. Save an inventory to "test_group" → appears in right panel under that group
6. Create nested group "test_group/nested" → verify nesting in tree
7. Open Load modal → navigate to "test_group" → see the saved inventory → click it → General panel shows description → toggle Show Tree → confirm ASCII tree renders
8. Open Manage modal → navigate to group → edit an inventory's group field → verify it moves to the new group
9. Check backend API: `GET /api/inventory` → confirm `group_path` is present in response JSON
10. Import/Export: exported JSON should contain `group_path`; import restores it
