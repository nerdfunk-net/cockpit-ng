# Refactor `live-update-page.tsx` - Plan

## Overview
The `live-update-page.tsx` component is a large monolithic file (~1900 lines) that handles CheckMK device synchronization, task tracking, filtering, pagination, and multiple modals. It should be refactored into a modular architecture following the pattern established in `hosts-inventory-page.tsx` to improve maintainability, readability, and reusability.

## Current Structure Analysis

### Component Responsibilities
1. **Device Management**: Loading, filtering, sorting, and paginating devices from Nautobot
2. **Task Tracking**: Managing Celery tasks for add/update/sync operations with real-time polling
3. **Device Operations**: Adding devices to CheckMK, syncing configurations, starting service discovery
4. **Diff Comparison**: Comparing device configurations between Nautobot and CheckMK
5. **Batch Operations**: Selecting and syncing multiple devices
6. **UI State Management**: Multiple filters, pagination, modals, and status messages

### Current Problems
- **Monolithic Structure**: Single file with 1900+ lines handling multiple concerns
- **State Complexity**: 25+ useState hooks managing different aspects
- **Callback Complexity**: 20+ useCallback hooks with interdependencies
- **Poor Separation of Concerns**: Business logic mixed with UI rendering
- **Difficult Testing**: Tightly coupled logic makes unit testing challenging
- **Hard to Extend**: Adding new features requires modifying a large file

## Refactoring Plan

### 1. Types Extraction (`src/types/features/checkmk/live-update.ts`)

Extract all type definitions to a shared types file:

```typescript
// Device types
export interface Device {
  id: string
  name: string
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
}

// Celery task types
export interface CeleryTaskResponse {
  task_id: string
  job_id?: string
  status: string
  message: string
}

export interface CeleryTaskStatus {
  task_id: string
  status: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED'
  result?: {
    success: boolean
    message: string
    device_id?: string
    hostname?: string
    [key: string]: unknown
  }
  error?: string
  progress?: {
    status?: string
    current?: number
    total?: number
    [key: string]: unknown
  }
}

export interface DeviceTask {
  taskId: string
  deviceId: string | string[]
  deviceName: string
  operation: 'add' | 'update' | 'sync'
  status: CeleryTaskStatus['status']
  message: string
  startedAt: Date
  batchProgress?: {
    current: number
    total: number
    success: number
    failed: number
  }
}

// Pagination types
export interface PaginationState {
  isBackendPaginated: boolean
  hasMore: boolean
  totalCount: number
  currentLimit: number | null
  currentOffset: number
  filterType: string | null
  filterValue: string | null
}

// Filter types
export interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  statuses: Set<string>
}

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

// Diff types
export interface DiffResult {
  device_id: string
  device_name: string
  differences: {
    result: 'equal' | 'diff' | 'host_not_found'
    diff: string
    normalized_config: {
      folder: string
      attributes: Record<string, unknown>
    }
    checkmk_config: {
      folder: string
      attributes: Record<string, unknown>
      effective_attributes: Record<string, unknown> | null
      is_cluster: boolean
      is_offline: boolean
      cluster_nodes: unknown[] | null
    } | null
    ignored_attributes: string[]
  }
  timestamp: string
}

export interface ConfigAttribute {
  key: string
  nautobotValue: unknown
  checkmkValue: unknown
  isDifferent: boolean
  nautobotMissing: boolean
  checkmkMissing: boolean
  isIgnored: boolean
}
```

### 2. Custom Hooks (`src/hooks/features/checkmk/live-update/`)

#### **`useDeviceLoader.ts`**
Manages device loading, reloading, and pagination state.

```typescript
export function useDeviceLoader() {
  return {
    devices: Device[]
    loading: boolean
    error: string | null
    paginationState: PaginationState
    loadDevices: (filters, pagination) => Promise<void>
    reloadDevices: () => Promise<void>
  }
}
```

**Responsibilities:**
- Fetch devices from API with filters and pagination
- Handle loading and error states
- Manage pagination metadata
- Force reload with fresh data

#### **`useDeviceFilters.ts`**
Manages all filtering and sorting logic.

```typescript
export function useDeviceFilters(devices: Device[]) {
  return {
    filteredDevices: Device[]
    deviceNameFilter: string
    roleFilters: Record<string, boolean>
    selectedLocation: string
    statusFilter: string
    sortColumn: string
    sortOrder: 'asc' | 'desc' | 'none'
    filterOptions: FilterOptions
    activeFiltersCount: number
    setDeviceNameFilter: (value: string) => void
    setRoleFilters: (filters: Record<string, boolean>) => void
    setSelectedLocation: (location: string) => void
    setStatusFilter: (status: string) => void
    handleSort: (column: string) => void
    resetFilters: () => void
  }
}
```

**Responsibilities:**
- Apply client-side filters (name, role, location, status)
- Apply sorting by column
- Track filter options extracted from devices
- Reset all filters to default
- Calculate active filter count

#### **`useDeviceSelection.ts`**
Manages device selection for batch operations.

```typescript
export function useDeviceSelection() {
  return {
    selectedDevices: Set<string>
    handleSelectDevice: (deviceId: string, checked: boolean) => void
    handleSelectAll: (devices: Device[], checked: boolean) => void
    clearSelection: () => void
  }
}
```

**Responsibilities:**
- Track selected device IDs
- Handle individual device selection
- Handle "select all" on current page
- Clear selection

#### **`useTaskTracking.ts`**
Manages Celery task tracking with polling.

```typescript
export function useTaskTracking() {
  return {
    activeTasks: Map<string, DeviceTask>
    expandedErrorTasks: Set<string>
    trackTask: (taskId, deviceId, deviceName, operation) => void
    cancelTask: (taskId: string) => Promise<void>
    toggleErrorDetails: (taskId: string) => void
  }
}
```

**Responsibilities:**
- Poll Celery task status every 2 seconds
- Update task progress and status
- Handle task completion/failure
- Cancel running tasks
- Cleanup polling intervals on unmount
- Track error expansion state

#### **`useDeviceOperations.ts`**
Handles device operations (add, sync, discovery, activate).

```typescript
export function useDeviceOperations() {
  return {
    hasDevicesSynced: boolean
    isActivating: boolean
    handleAddDevice: (device: Device) => Promise<void>
    handleSync: (device: Device) => Promise<void>
    handleSyncSelected: (deviceIds: string[]) => Promise<void>
    handleStartDiscovery: (device: Device, mode: string) => Promise<void>
    handleActivate: () => Promise<void>
  }
}
```

**Responsibilities:**
- Add single device to CheckMK
- Sync single device configuration
- Sync multiple selected devices (batch)
- Start service discovery with various modes
- Activate pending changes in CheckMK

#### **`useDiffComparison.ts`**
Manages diff comparison between Nautobot and CheckMK.

```typescript
export function useDiffComparison() {
  return {
    diffResult: DiffResult | null
    loadingDiff: boolean
    deviceDiffResults: Record<string, 'equal' | 'diff' | 'host_not_found'>
    getDiff: (device: Device) => Promise<void>
    parseConfigComparison: (diffResult: DiffResult) => ConfigAttribute[]
  }
}
```

**Responsibilities:**
- Fetch diff for a specific device
- Parse and format diff results
- Track diff results for table row coloring
- Convert diff data to structured attributes

#### **`useStatusMessages.ts`**
Manages status messages and notifications.

```typescript
export function useStatusMessages() {
  return {
    statusMessage: StatusMessage | null
    showMessage: (text: string, type: 'success' | 'error' | 'info') => void
    clearMessage: () => void
  }
}
```

**Responsibilities:**
- Show status messages with auto-hide
- Prevent duplicate messages
- Clear messages manually

### 3. Utility Functions (`src/utils/features/checkmk/live-update/`)

#### **`diff-helpers.ts`**
Helper functions for diff comparison.

```typescript
export function renderConfigComparison(
  nautobot: { attributes?: Record<string, unknown> } | null,
  checkmk: { attributes?: Record<string, unknown> } | null,
  ignoredAttributes: string[] = []
): ConfigAttribute[]

export function formatValue(value: unknown): string

export function getRowColorClass(deviceId: string, diffResults: Record<string, string>): string
```

#### **`ui-helpers.ts`**
Helper functions for UI rendering.

```typescript
export function getStatusBadgeVariant(status: string): string
export function formatTaskDuration(startedAt: Date): string
export function formatProgressPercentage(current: number, total: number): number
```

### 4. Component Extraction (`src/components/features/checkmk/live-update/`)

#### **`LiveUpdateHeader.tsx`**
Header section with title and action buttons.

**Props:**
```typescript
interface LiveUpdateHeaderProps {
  deviceCount: number
  activeFiltersCount: number
  hasDevicesSynced: boolean
  isActivating: boolean
  onReloadDevices: () => void
  onActivate: () => void
}
```

**Content:**
- Title with device count
- Reload devices button
- Activate changes button (only when devices synced)

#### **`StatusMessageCard.tsx`**
Displays status messages at the top right.

**Props:**
```typescript
interface StatusMessageCardProps {
  message: StatusMessage
  onDismiss: () => void
}
```

**Content:**
- Card with color based on message type
- Message text with icon
- Dismiss button

#### **`ActiveTasksPanel.tsx`**
Displays all active Celery tasks with progress.

**Props:**
```typescript
interface ActiveTasksPanelProps {
  activeTasks: Map<string, DeviceTask>
  expandedErrorTasks: Set<string>
  onCancelTask: (taskId: string) => void
  onToggleErrorDetails: (taskId: string) => void
}
```

**Content:**
- List of task cards
- Progress bars for running tasks
- Success/failure indicators
- Batch operation progress details
- Error expansion for failed tasks
- Cancel button for running tasks

#### **`DeviceFilters.tsx`**
All filter controls in one component.

**Props:**
```typescript
interface DeviceFiltersProps {
  deviceNameFilter: string
  roleFilters: Record<string, boolean>
  selectedLocation: string
  statusFilter: string
  filterOptions: FilterOptions
  activeFiltersCount: number
  onDeviceNameFilterChange: (value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onLocationChange: (location: string) => void
  onStatusFilterChange: (status: string) => void
  onResetFilters: () => void
}
```

**Content:**
- Device name search input
- Role multi-select dropdown
- Location searchable dropdown
- Status filter dropdown
- Reset filters button (when filters are active)

#### **`DeviceTableHeader.tsx`**
Table header with selection and sorting.

**Props:**
```typescript
interface DeviceTableHeaderProps {
  hasSelectedDevices: boolean
  allSelected: boolean
  sortColumn: string
  sortOrder: 'asc' | 'desc' | 'none'
  onSelectAll: (checked: boolean) => void
  onSort: (column: string) => void
}
```

**Content:**
- Select all checkbox
- Column headers with sort indicators
- Sort functionality

#### **`DeviceTableRow.tsx`**
Single device row with actions.

**Props:**
```typescript
interface DeviceTableRowProps {
  device: Device
  isSelected: boolean
  diffResult?: 'equal' | 'diff' | 'host_not_found'
  onSelect: (deviceId: string, checked: boolean) => void
  onGetDiff: (device: Device) => void
  onSync: (device: Device) => void
  onStartDiscovery: (device: Device, mode: string) => void
}
```

**Content:**
- Selection checkbox
- Device information (name, IP, role, location, type, status)
- Action buttons (Get Diff, Sync, Discovery)
- Row coloring based on diff result

#### **`DeviceTable.tsx`**
Main table component combining header and rows.

**Props:**
```typescript
interface DeviceTableProps {
  devices: Device[]
  selectedDevices: Set<string>
  diffResults: Record<string, 'equal' | 'diff' | 'host_not_found'>
  sortColumn: string
  sortOrder: 'asc' | 'desc' | 'none'
  currentPage: number
  pageSize: number
  totalPages: number
  onSelectDevice: (deviceId: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onGetDiff: (device: Device) => void
  onSync: (device: Device) => void
  onStartDiscovery: (device: Device, mode: string) => void
  onSort: (column: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}
```

**Content:**
- DeviceTableHeader
- List of DeviceTableRow components
- Pagination controls
- Page size selector
- Empty state when no devices

#### **`BatchActionsBar.tsx`**
Action bar for selected devices.

**Props:**
```typescript
interface BatchActionsBarProps {
  selectedCount: number
  isSyncing: boolean
  onSyncSelected: () => void
  onClearSelection: () => void
}
```

**Content:**
- Selected device count
- Sync selected button
- Clear selection button

#### **`DiffModal.tsx`**
Modal for showing device configuration differences.

**Props:**
```typescript
interface DiffModalProps {
  isOpen: boolean
  device: Device | null
  diffResult: DiffResult | null
  loading: boolean
  onClose: () => void
}
```

**Content:**
- Device information
- Diff result summary (equal/diff/not found)
- Raw diff text display
- Configuration comparison table
- Folder comparison
- Close button

#### **`AddDeviceModal.tsx`**
Confirmation modal for adding device to CheckMK.

**Props:**
```typescript
interface AddDeviceModalProps {
  isOpen: boolean
  device: Device | null
  isAdding: boolean
  onConfirm: (device: Device) => void
  onCancel: () => void
}
```

**Content:**
- Device information
- Warning message
- Confirm/Cancel buttons
- Loading state

### 5. Main Component Update (`src/components/features/checkmk/live-update/live-update-page.tsx`)

The main component will be refactored to be a high-level orchestrator:

```typescript
export default function LiveUpdatePage() {
  // Custom hooks
  const { statusMessage, showMessage, clearMessage } = useStatusMessages()
  const { devices, loading, error, reloadDevices } = useDeviceLoader()
  const { 
    filteredDevices, 
    deviceNameFilter,
    roleFilters,
    selectedLocation,
    statusFilter,
    filterOptions,
    activeFiltersCount,
    ...filterHandlers 
  } = useDeviceFilters(devices)
  const { selectedDevices, ...selectionHandlers } = useDeviceSelection()
  const { activeTasks, expandedErrorTasks, ...taskHandlers } = useTaskTracking()
  const { diffResult, loadingDiff, deviceDiffResults, getDiff } = useDiffComparison()
  const { hasDevicesSynced, isActivating, ...operationHandlers } = useDeviceOperations()

  // Modal state
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [deviceToAdd, setDeviceToAdd] = useState<Device | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  // ... minimal orchestration logic

  return (
    <div className="space-y-6">
      <LiveUpdateHeader
        deviceCount={devices.length}
        activeFiltersCount={activeFiltersCount}
        hasDevicesSynced={hasDevicesSynced}
        isActivating={isActivating}
        onReloadDevices={reloadDevices}
        onActivate={operationHandlers.handleActivate}
      />

      {statusMessage && (
        <StatusMessageCard 
          message={statusMessage} 
          onDismiss={clearMessage} 
        />
      )}

      {activeTasks.size > 0 && (
        <ActiveTasksPanel
          activeTasks={activeTasks}
          expandedErrorTasks={expandedErrorTasks}
          onCancelTask={taskHandlers.cancelTask}
          onToggleErrorDetails={taskHandlers.toggleErrorDetails}
        />
      )}

      <DeviceFilters {...filterProps} />

      {selectedDevices.size > 0 && (
        <BatchActionsBar {...batchProps} />
      )}

      <DeviceTable {...tableProps} />

      <DiffModal {...diffModalProps} />
      <AddDeviceModal {...addDeviceModalProps} />
    </div>
  )
}
```

## Implementation Steps

### Phase 1: Preparation
1. ✅ Create refactoring plan document
2. ⬜ Create directory structure for new files
3. ⬜ Run existing tests to establish baseline

### Phase 2: Types and Utils
4. ⬜ Extract all types to `live-update.ts`
5. ⬜ Create `diff-helpers.ts` with helper functions
6. ⬜ Create `ui-helpers.ts` with UI helper functions
7. ⬜ Update imports in main component

### Phase 3: Custom Hooks (Independent)
8. ⬜ Create `useStatusMessages.ts`
9. ⬜ Create `useDeviceSelection.ts`
10. ⬜ Create `useDeviceFilters.ts`
11. ⬜ Create `useDeviceLoader.ts`

### Phase 4: Custom Hooks (Dependent)
12. ⬜ Create `useTaskTracking.ts` (depends on useStatusMessages)
13. ⬜ Create `useDiffComparison.ts` (depends on useStatusMessages)
14. ⬜ Create `useDeviceOperations.ts` (depends on useStatusMessages, useTaskTracking)

### Phase 5: Component Extraction (Bottom-Up)
15. ⬜ Create `StatusMessageCard.tsx`
16. ⬜ Create `DeviceTableRow.tsx`
17. ⬜ Create `DeviceTableHeader.tsx`
18. ⬜ Create `DeviceTable.tsx`
19. ⬜ Create `DeviceFilters.tsx`
20. ⬜ Create `BatchActionsBar.tsx`
21. ⬜ Create `LiveUpdateHeader.tsx`
22. ⬜ Create `ActiveTasksPanel.tsx`
23. ⬜ Create `DiffModal.tsx`
24. ⬜ Create `AddDeviceModal.tsx`

### Phase 6: Main Component Refactoring
25. ⬜ Update `live-update-page.tsx` to use new hooks
26. ⬜ Update `live-update-page.tsx` to use new components
27. ⬜ Remove old code from main component
28. ⬜ Verify all imports and exports

### Phase 7: Testing and Validation
29. ⬜ Run TypeScript type checking (`npm run type-check`)
30. ⬜ Run linter (`npm run lint`)
31. ⬜ Run build (`npm run build`)
32. ⬜ Manual testing of all features:
    - Device loading and reload
    - Filtering (name, role, location, status)
    - Sorting by columns
    - Device selection (single and select all)
    - Batch sync operation
    - Get diff functionality
    - Add device to CheckMK
    - Sync device
    - Service discovery
    - Activate changes
    - Task tracking and cancellation
    - Status messages
    - Pagination
33. ⬜ Update documentation if needed

## Benefits

### Maintainability
- **Separation of Concerns**: Each hook and component has a single, well-defined responsibility
- **Smaller Files**: Easier to navigate and understand individual pieces
- **Clear Dependencies**: Explicit data flow between hooks and components

### Reusability
- **Shared Hooks**: Device operations hooks can be reused in other CheckMK-related features
- **Generic Components**: Filter components, tables, and modals can be adapted for other pages
- **Type Safety**: Shared types prevent inconsistencies across components

### Testability
- **Unit Testing**: Each hook can be tested independently with React Testing Library
- **Component Testing**: UI components can be tested with mock props
- **Integration Testing**: Main component tests verify hook composition

### Extensibility
- **Easy to Add Features**: New operations or filters can be added to specific hooks
- **Plugin Architecture**: New task types or operations don't require touching entire file
- **Type-Safe Extensions**: TypeScript ensures new features maintain type safety

## Migration Notes

### Backward Compatibility
- All existing functionality will be preserved
- No changes to external API or props (if any)
- URL parameters and routing remain unchanged

### Breaking Changes
- None expected for external consumers
- Internal file structure changes only

### Performance Considerations
- Task polling uses cleanup in useEffect to prevent memory leaks
- Filtered devices are memoized to prevent unnecessary re-renders
- Pagination reduces rendered devices count
- Batch operations use single API call for efficiency

## Next Steps After Refactoring

1. **Add Unit Tests**: Create tests for each custom hook
2. **Add Component Tests**: Test individual components with React Testing Library
3. **Performance Optimization**: Profile and optimize re-renders if needed
4. **Documentation**: Add JSDoc comments to hooks and components
5. **Storybook**: Create stories for reusable components
6. **Error Boundaries**: Add error boundaries around major sections
7. **Accessibility**: Audit and improve keyboard navigation and screen reader support
8. **Mobile Responsive**: Ensure all components work well on mobile devices
