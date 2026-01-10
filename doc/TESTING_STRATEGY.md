# Frontend Testing Strategy

## 1. Do we need more tests?
**Yes.** Use tests to "lock in" behavior for critical features.
- **Critical Paths**: Features that modify data (like Bulk Edit) must have tests.
- **Complex Logic**: Any utility function with partial logic (like converting UI state to API payloads) serves as a unit test candidate.
- **Shared Components**: Components used in multiple places (like `EditableDeviceTable`) need tests to prevent regressions.

## 2. How Vitest covers the frontend
Vitest is a test runner (like Jest). In this project, it covers:
- **Unit Tests (`*.test.ts`)**: Pure logic functions. No React components involved. Fast and simple.
- **Component Tests (`*.test.tsx`)**: Renders React components using **React Testing Library (RTL)**. Simulates user interactions (clicks, typing) and asserts that the UI updates correctly or callbacks are fired.

---

## 3. Example: Testing "Bulk Edit"

We will tackle "Bulk Edit" by splitting testing into two parts: **Logic** and **UI**.

### Part A: Logic (Unit Test)
**File to Test**: `src/components/features/nautobot/tools/bulk-edit/utils/json-converter.ts`
**Why**: This function translates your frontend state (`modifiedDevices` Map) into the JSON payload the API expects. If this breaks, data corruption occurs.

**Proposed Test File**: `src/components/features/nautobot/tools/bulk-edit/utils/json-converter.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { convertModifiedDevicesToJSON } from './json-converter'
import type { DeviceInfo } from '@/types/shared/device-selector'

describe('convertModifiedDevicesToJSON', () => {
  it('should correctly format a simple field update', () => {
    const modifications = new Map()
    modifications.set('device-123', { status: 'active' })

    const result = convertModifiedDevicesToJSON(modifications)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'device-123',
      status: 'active'
    })
  })

  it('should include interface config when primary IP changes', () => {
    const modifications = new Map()
    modifications.set('device-123', { primary_ip4: '10.0.0.1/24' })

    const interfaceConfig = {
      name: 'Loopback0',
      type: 'virtual',
      status: 'active',
      createOnIpChange: true
    }

    const result = convertModifiedDevicesToJSON(
      modifications,
      interfaceConfig
    )

    expect(result[0]).toMatchObject({
      id: 'device-123',
      primary_ip4: '10.0.0.1/24',
      mgmt_interface_name: 'Loopback0',
      mgmt_interface_create_on_ip_change: true
    })
  })
})
```

### Part B: UI (Component Test)
**File to Test**: `src/components/features/nautobot/tools/bulk-edit/components/editable-device-table.tsx`
**Why**: Ensures that clicking a cell turns it into an input, and blurring sends the correct data back.

**Proposed Test File**: `src/components/features/nautobot/tools/bulk-edit/components/editable-device-table.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, userEvent } from '@testing-library/react'
import { EditableDeviceTable } from './editable-device-table'

// Mock dependencies
vi.mock('@/hooks/use-api', () => ({
  useApi: () => ({ apiCall: vi.fn() })
}))
// Mock Query hooks to return empty data by default
vi.mock('@/hooks/queries/use-nautobot-graphql-queries', () => ({
  useNautobotDeviceTypesQuery: () => ({ data: { data: { device_types: [] } } })
}))
vi.mock('@/hooks/queries/use-nautobot-rest-queries', () => ({
  useNautobotLocationsRestQuery: () => ({ data: [] })
}))

const mockDevices = [
  { id: '1', name: 'router-01', status: 'active', tags: [] }
]

const mockColumns = [
  { id: 'name', field: 'name', label: 'Name', editable: true },
  { id: 'status', field: 'status', label: 'Status', editable: true }
]

describe('EditableDeviceTable', () => {
  it('should render device data', () => {
    render(
      <EditableDeviceTable
        devices={mockDevices}
        columns={mockColumns}
        modifiedDevices={new Map()}
        onDeviceModified={vi.fn()}
      />
    )
    expect(screen.getByText('router-01')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('should switch to edit mode on click and fire callback on save', () => {
    const onModifySpy = vi.fn()
    render(
      <EditableDeviceTable
        devices={mockDevices}
        columns={mockColumns}
        modifiedDevices={new Map()}
        onDeviceModified={onModifySpy}
      />
    )

    // 1. Click the name cell
    fireEvent.click(screen.getByText('router-01'))

    // 2. Check input appears
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('router-01')

    // 3. Type new value
    fireEvent.change(input, { target: { value: 'router-99' } })

    // 4. Blur to save
    fireEvent.blur(input)

    // 5. Assert callback
    expect(onModifySpy).toHaveBeenCalledWith('1', { name: 'router-99' })
  })
})
```

## Summary
To "add more tests" effectively:
1.  **Identify Pure Logic**: Write unit tests (`.test.ts`) for utils and hooks.
2.  **Identify Interactive UI**: Write component tests (`.test.tsx`) for tables, forms, and complex widgets.
3.  **Prioritize**: Start with the most fragile or critical parts (like Bulk Edit data conversion).
