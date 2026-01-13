# Refactor `offboard-device-page.tsx` - Plan

## Status: ✅ COMPLETED
**Plan Created:** January 13, 2026  
**Completed:** January 13, 2026

## Overview
The `offboard-device-page.tsx` component was a monolithic file (~1260 lines) that handled device offboarding from Nautobot and CheckMK. It has been successfully refactored into a modular architecture following the pattern established in `live-update-page.tsx` to improve maintainability, readability, and reusability.

## Refactoring Summary

### Before (Monolithic)
- **Total Lines:** 1260
- **useState Hooks:** 18+
- **useCallback Hooks:** 10+
- **useEffect Hooks:** 5+
- **Single File:** All logic in one component

### After (Modular)
- **Main Component:** ~230 lines (orchestrator only)
- **Custom Hooks:** 8 separate files (logic extraction)
- **UI Components:** 10 separate files (presentation layer)
- **Utilities:** 2 files (reusable functions)
- **Types:** 1 file (type definitions)
- **Total Files:** 23 (1 main + 8 hooks + 10 components + 2 utils + 1 types + 1 plan doc)

## Implementation Results

### 1. Types Extraction (`src/types/features/nautobot/offboard.ts`)

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

// Offboarding types
export interface OffboardProperties {
  removePrimaryIp: boolean
  removeInterfaceIps: boolean
  removeFromCheckMK: boolean
## Implementation Results

### ✅ Phase 1: Types and Utils (Completed)
**Files Created:**
- `src/types/features/nautobot/offboard.ts` - All type definitions
- `src/utils/features/nautobot/offboard/location-helpers.ts` - Location hierarchy logic
- `src/utils/features/nautobot/offboard/ui-helpers.ts` - UI utility functions

### ✅ Phase 2: Custom Hooks (Completed)
**8 Hooks Created:**
1. `hooks/use-status-messages.ts` - Status message management
2. `hooks/use-device-selection.ts` - Device selection logic
3. `hooks/use-url-params.ts` - URL parameter sync
4. `hooks/use-pagination.ts` - Pagination state
5. `hooks/use-device-loader.ts` - Device loading from API
6. `hooks/use-device-filters.ts` - All filtering logic
7. `hooks/use-location-filter.ts` - Hierarchical location filtering
8. `hooks/use-offboard-operations.ts` - Offboard operations logic

### ✅ Phase 3: UI Components (Completed)
**10 Components Created:**
1. `components/offboard-header.tsx` - Page header
2. `components/status-message-card.tsx` - Status messages
3. `components/offboard-panel.tsx` - Left settings panel
4. `components/device-table-row.tsx` - Single device row
5. `components/device-table-header.tsx` - Table header with select-all
6. `components/pagination-controls.tsx` - Pagination UI
7. `components/device-filters.tsx` - All filter controls
8. `components/device-table.tsx` - Main table orchestrator
9. `components/confirmation-modal.tsx` - Offboard confirmation
10. `components/results-modal.tsx` - Results display

### ✅ Phase 4: Main Component (Completed)
**Main Component Refactored:**
- `offboard-device-page.tsx` - Reduced from 1260 lines to ~230 lines
- Acts as orchestrator only
- Uses all 8 custom hooks
- Renders all 10 UI components
- Clean props passing
- No business logic in component

### ✅ Validation Results
**Type Check:** ✅ Passed  
**Lint Check:** ✅ Passed (only console.log warnings, unrelated to refactoring)  
**Build Check:** ✅ Passed (production build successful)  

## Benefits Achieved

### Code Quality
- **Reduced Complexity**: Main component from 1260 to ~230 lines (82% reduction)
- **Better Separation**: Business logic in hooks, UI in components
- **Improved Testability**: Each hook and component can be tested independently
- **Enhanced Readability**: Clear file structure with single responsibilities
- **Easier Maintenance**: Changes isolated to specific files

### Reusability
- Hooks can be reused in other device management features
- Components can be composed differently for similar features
- Utilities shared across offboard and other nautobot features

### Developer Experience
- Easier to locate specific functionality
- Clear dependencies between modules
- Better IDE navigation and code completion
- Follows established patterns from live-update refactoring

## Architecture Pattern

This refactoring follows the established pattern:

```
feature/
├── hooks/              # Business logic and state management
│   ├── use-*.ts       # Individual concerns (8 hooks)
├── components/         # Presentation layer
│   ├── *-header.tsx   # UI components (10 components)
│   ├── *-modal.tsx
│   └── ...
├── utils/             # Pure utility functions
├── types.ts           # Type definitions
└── main-page.tsx      # Orchestrator (~230 lines)
```

### Hook Layer (Business Logic)
- Self-contained state management
- Pure functions and callbacks
- Minimal dependencies
- Can be tested independently
- Return well-defined interfaces

### Component Layer (Presentation)
- Receive props from orchestrator
- No direct API calls
- No complex state logic
- Focus on rendering UI
- Compose smaller components

### Orchestrator (Main Component)
- Imports all hooks and components
- Wires dependencies together
- Passes props down
- Minimal local state
- Clean and readable

## Original Plan Reference

The original refactoring plan (below) has been successfully executed. All phases completed:
1. ✅ Types extraction
2. ✅ Utils extraction
3. ✅ Independent hooks creation
4. ✅ Dependent hooks creation
5. ✅ Component extraction
6. ✅ Main component refactoring
7. ✅ Testing and validation

---

## Original Plan Details
    locationSearch: string
    showLocationDropdown: boolean
    selectedLocationId: string
    locationContainerRef: RefObject<HTMLDivElement>
    setLocationSearch: (search: string) => void
    setShowLocationDropdown: (show: boolean) => void
    handleLocationSelect: (location: LocationItem) => void
    loadLocations: () => Promise<void>
  }
}
```

**Responsibilities:**
- Load locations from API
- Build hierarchical paths
- Handle location search/filtering
- Manage dropdown visibility
- Handle click outside to close dropdown

#### **`useDeviceSelection.ts`** (Reusable from live-update)
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

#### **`usePagination.ts`**
Manages pagination state and page changes.

```typescript
export function usePagination(totalItems: number, initialPageSize: number = 50) {
  return {
    pagination: PaginationState
    currentPageItems: <T>(items: T[]) => T[]
    handlePageChange: (newPage: number) => void
    handlePageSizeChange: (newPageSize: number) => void
  }
}
```

**Responsibilities:**
- Track current page and page size
- Calculate total pages
- Get items for current page
- Handle page navigation

#### **`useUrlParams.ts`**
Manages URL parameter synchronization.

```typescript
export function useUrlParams() {
  return {
    ipFilter: string | null
    syncFiltersWithUrl: (filters: TableFilters) => void
  }
}
```

**Responsibilities:**
- Read URL query parameters (especially ip_filter)
- Sync filters with URL on mount
- Support deep linking to filtered views

#### **`useOffboardOperations.ts`**
Handles device offboarding operations.

```typescript
export function useOffboardOperations() {
  return {
    isSubmitting: boolean
    offboardProperties: OffboardProperties
    nautobotIntegrationMode: NautobotIntegrationMode
    setOffboardProperties: (props: OffboardProperties) => void
    setNautobotIntegrationMode: (mode: NautobotIntegrationMode) => void
    handleOffboardDevices: (deviceIds: string[], devices: Device[]) => Promise<OffboardSummary>
  }
}
```

**Responsibilities:**
- Manage offboarding settings
- Process batch device offboarding
- Handle API calls for each device
- Collect and format results
- Show progress during operations

### 4. Component Extraction (`src/components/features/nautobot/offboard/components/`)

#### **`OffboardHeader.tsx`**
Header section with title and description.

**Props:**
```typescript
interface OffboardHeaderProps {
  // No props needed - static content
}
```

**Content:**
- Icon and title
- Description text

#### **`StatusMessageCard.tsx`** (Reusable from live-update)
Displays status messages.

**Props:**
```typescript
interface StatusMessageCardProps {
  message: StatusMessage
  onDismiss: () => void
}
```

#### **`OffboardPanel.tsx`**
Left panel with offboarding settings and action button.

**Props:**
```typescript
interface OffboardPanelProps {
  selectedCount: number
  isSubmitting: boolean
  offboardProperties: OffboardProperties
  nautobotIntegrationMode: NautobotIntegrationMode
  onOffboardPropertiesChange: (props: Partial<OffboardProperties>) => void
  onNautobotIntegrationModeChange: (mode: NautobotIntegrationMode) => void
  onOffboard: () => void
  isFormValid: boolean
}
```

**Content:**
- Nautobot integration mode selector
- IP removal checkboxes
- CheckMK removal checkbox
- Offboard button with selected count

#### **`DeviceFilters.tsx`**
All filter controls in one component.

**Props:**
```typescript
interface DeviceFiltersProps {
  filters: TableFilters
  roleFilters: Record<string, boolean>
  dropdownOptions: {
    roles: DropdownOption[]
    locations: DropdownOption[]
    statuses: DropdownOption[]
  }
  locationSearch: string
  locationFiltered: LocationItem[]
  showLocationDropdown: boolean
  locationContainerRef: RefObject<HTMLDivElement>
  onFilterChange: (field: keyof TableFilters, value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onLocationSearchChange: (search: string) => void
  onLocationSelect: (location: LocationItem) => void
  onLocationDropdownToggle: (show: boolean) => void
  onClearFilters: () => void
  onReloadDevices: () => void
}
```

**Content:**
- Device name filter input
- IP address filter input
- Role multi-select dropdown
- Hierarchical location searchable dropdown
- Status filter dropdown
- Clear filters button
- Reload devices button

#### **`DeviceTableHeader.tsx`**
Table header with selection checkbox.

**Props:**
```typescript
interface DeviceTableHeaderProps {
  hasSelectedDevices: boolean
  allSelected: boolean
  onSelectAll: (checked: boolean) => void
}
```

**Content:**
- Select all checkbox
- Column headers (Device Name, IP Address, Role, Location, Status)

#### **`DeviceTableRow.tsx`**
Single device row.

**Props:**
```typescript
interface DeviceTableRowProps {
  device: Device
  isSelected: boolean
  index: number
  onSelect: (deviceId: string, checked: boolean) => void
}
```

**Content:**
- Selection checkbox
- Device information cells
- Status badge with color coding

#### **`DeviceTable.tsx`**
Main table component with filters and pagination.

**Props:**
```typescript
interface DeviceTableProps {
  devices: Device[]
  selectedDevices: Set<string>
  filters: TableFilters
  roleFilters: Record<string, boolean>
  dropdownOptions: {
    roles: DropdownOption[]
    locations: DropdownOption[]
    statuses: DropdownOption[]
  }
  pagination: PaginationState
  isLoading: boolean
  locationSearch: string
  locationFiltered: LocationItem[]
  showLocationDropdown: boolean
  locationContainerRef: RefObject<HTMLDivElement>
  onSelectDevice: (deviceId: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onFilterChange: (field: keyof TableFilters, value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onLocationSearchChange: (search: string) => void
  onLocationSelect: (location: LocationItem) => void
  onLocationDropdownToggle: (show: boolean) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onClearFilters: () => void
  onReloadDevices: () => void
}
```

**Content:**
- Header with title and buttons
- DeviceFilters component
- DeviceTableHeader
- List of DeviceTableRow components
- Pagination controls
- Page size selector

#### **`PaginationControls.tsx`**
Pagination controls component.

**Props:**
```typescript
interface PaginationControlsProps {
  pagination: PaginationState
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}
```

**Content:**
- Page info display
- Page size selector
- Navigation buttons (first, prev, page numbers, next, last)

#### **`ConfirmationModal.tsx`**
Confirmation dialog for offboarding.

**Props:**
```typescript
interface ConfirmationModalProps {
  isOpen: boolean
  selectedCount: number
  onConfirm: () => void
  onCancel: () => void
}
```

**Content:**
- Confirmation message
- Device count
- Warning text
- Confirm/Cancel buttons

#### **`ResultsModal.tsx`**
Modal showing offboarding results.

**Props:**
```typescript
interface ResultsModalProps {
  isOpen: boolean
  summary: OffboardSummary | null
  onClose: () => void
}
```

**Content:**
- Summary statistics cards
- Detailed results per device
- Success/failure indicators
- Removed/skipped items lists
- Error messages
- Close button

### 5. Main Component Update (`src/components/features/nautobot/offboard/offboard-device-page.tsx`)

The main component will be refactored to be a high-level orchestrator:

```typescript
export function OffboardDevicePage() {
  // Custom hooks
  const { statusMessage, showMessage, clearMessage } = useStatusMessages()
  const { devices, isLoading, loadDevices, reloadDevices } = useDeviceLoader()
  const { 
    filteredDevices,
    filters,
    roleFilters,
    dropdownOptions,
    ...filterHandlers 
  } = useDeviceFilters(devices)
  const {
    locationsList,
    locationFiltered,
    locationSearch,
    showLocationDropdown,
    locationContainerRef,
    ...locationHandlers
  } = useLocationFilter()
  const { selectedDevices, ...selectionHandlers } = useDeviceSelection()
  const { pagination, currentPageItems, ...paginationHandlers } = usePagination(filteredDevices.length)
  const {
    isSubmitting,
    offboardProperties,
    nautobotIntegrationMode,
    ...offboardHandlers
  } = useOffboardOperations()
  
  // URL params
  useUrlParams()

  // Modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [offboardSummary, setOffboardSummary] = useState<OffboardSummary | null>(null)

  // ... minimal orchestration logic

  return (
    <div className="space-y-6">
      <OffboardHeader />
      
      {statusMessage && (
        <StatusMessageCard 
          message={statusMessage} 
          onDismiss={clearMessage} 
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <OffboardPanel {...offboardPanelProps} />
        </div>

        <div className="lg:col-span-3">
          <DeviceTable {...deviceTableProps} />
        </div>
      </div>

      <ConfirmationModal {...confirmationModalProps} />
      <ResultsModal {...resultsModalProps} />
    </div>
  )
}
```

## Implementation Steps

### Phase 1: Preparation
1. ⬜ Create refactoring plan document
2. ⬜ Create directory structure for new files
3. ⬜ Run existing tests to establish baseline

### Phase 2: Types and Utils
4. ⬜ Extract all types to `offboard.ts`
5. ⬜ Create `location-helpers.ts` with helper functions
6. ⬜ Create `ui-helpers.ts` with UI helper functions
7. ⬜ Update imports in main component

### Phase 3: Custom Hooks (Independent)
8. ⬜ Create `useStatusMessages.ts` (or reuse from live-update)
9. ⬜ Create `useDeviceSelection.ts` (or reuse from live-update)
10. ⬜ Create `useUrlParams.ts`
11. ⬜ Create `usePagination.ts`

### Phase 4: Custom Hooks (Dependent)
12. ⬜ Create `useDeviceLoader.ts`
13. ⬜ Create `useDeviceFilters.ts`
14. ⬜ Create `useLocationFilter.ts`
15. ⬜ Create `useOffboardOperations.ts`

### Phase 5: Component Extraction (Bottom-Up)
16. ⬜ Create `OffboardHeader.tsx`
17. ⬜ Create `StatusMessageCard.tsx` (or reuse from live-update)
18. ⬜ Create `DeviceTableRow.tsx`
19. ⬜ Create `DeviceTableHeader.tsx`
20. ⬜ Create `PaginationControls.tsx`
21. ⬜ Create `DeviceFilters.tsx`
22. ⬜ Create `DeviceTable.tsx`
23. ⬜ Create `OffboardPanel.tsx`
24. ⬜ Create `ConfirmationModal.tsx`
25. ⬜ Create `ResultsModal.tsx`

### Phase 6: Main Component Refactoring
26. ⬜ Update `offboard-device-page.tsx` to use new hooks
27. ⬜ Update `offboard-device-page.tsx` to use new components
28. ⬜ Remove old code from main component
29. ⬜ Verify all imports and exports

### Phase 7: Testing and Validation
30. ⬜ Run TypeScript type checking (`npm run type-check`)
31. ⬜ Run linter (`npm run lint`)
32. ⬜ Run build (`npm run build`)
33. ⬜ Manual testing of all features:
    - Device loading and reload
    - Filtering (name, role, location, IP, status)
    - Hierarchical location search
    - Multi-select role filtering
    - Device selection (single and select all)
    - Pagination
    - URL parameter support (ip_filter)
    - Offboarding confirmation
    - Batch offboarding operation
    - Results modal display
    - Status messages
34. ⬜ Update documentation if needed

## Benefits

### Maintainability
- **Separation of Concerns**: Each hook and component has a single responsibility
- **Smaller Files**: Easier to navigate (1260 lines → ~150 lines main + multiple focused modules)
- **Clear Dependencies**: Explicit data flow between hooks and components

### Reusability
- **Shared Hooks**: Many hooks can be reused in other device management features
- **Generic Components**: Filter components, tables, and modals can be adapted for other pages
- **Type Safety**: Shared types prevent inconsistencies across components

### Testability
- **Unit Testing**: Each hook can be tested independently
- **Component Testing**: UI components can be tested with mock props
- **Integration Testing**: Main component tests verify hook composition

### Extensibility
- **Easy to Add Features**: New filters or operations can be added to specific hooks
- **Plugin Architecture**: New offboarding modes don't require touching entire file
- **Type-Safe Extensions**: TypeScript ensures new features maintain type safety

## Code Reuse Opportunities

Several hooks and components from the refactored `live-update-page` can be reused:

1. **`useStatusMessages`** - Identical functionality
2. **`useDeviceSelection`** - Same selection logic
3. **`StatusMessageCard`** - Same UI component

This will further reduce code duplication and maintain consistency across features.

## Migration Notes

### Backward Compatibility
- All existing functionality will be preserved
- No changes to external API or routing
- URL parameters remain unchanged

### Breaking Changes
- None expected for external consumers
- Internal file structure changes only

### Performance Considerations
- Client-side filtering is memoized to prevent unnecessary re-renders
- Pagination reduces rendered device count
- Location hierarchy built once and cached
- Batch operations show progress feedback

## Next Steps After Refactoring

1. **Add Unit Tests**: Create tests for each custom hook
2. **Add Component Tests**: Test individual components with React Testing Library
3. **Performance Optimization**: Profile and optimize re-renders if needed
4. **Documentation**: Add JSDoc comments to hooks and components
5. **Storybook**: Create stories for reusable components
6. **Error Boundaries**: Add error boundaries around major sections
7. **Accessibility**: Audit and improve keyboard navigation and screen reader support
8. **Mobile Responsive**: Ensure all components work well on mobile devices
9. **Consider Backend Pagination**: If device list grows large, implement server-side pagination
