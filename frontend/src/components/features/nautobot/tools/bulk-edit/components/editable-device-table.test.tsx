import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditableDeviceTable } from './editable-device-table'
import type { DeviceInfo } from '@/components/shared/device-selector'
import type { ColumnDefinition } from '../tabs/bulk-edit-tab'

// Mock dependencies
vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({
        apiCall: vi.fn().mockResolvedValue({ values: [] })
    })
}))

// Mock Query hooks
vi.mock('@/hooks/queries/use-nautobot-graphql-queries', () => ({
    useNautobotDeviceTypesQuery: () => ({
        data: {
            data: {
                device_types: [
                    { model: 'DarioRouter', manufacturer: { name: 'DarioCorp' } }
                ]
            }
        }
    })
}))

vi.mock('@/hooks/queries/use-nautobot-rest-queries', () => ({
    useNautobotLocationsRestQuery: () => ({
        data: [
            { id: 'site-1', name: 'Site A' },
            { id: 'site-2', name: 'Site B' }
        ]
    })
}))

// Mock scrollIntoView since it's not implemented in JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn()

const mockDevices: DeviceInfo[] = [
    {
        id: '1',
        name: 'router-01',
        status: 'active',
        device_type: 'DarioRouter',
        manufacturer: 'DarioCorp',
        role: 'Router',
        location: 'Site A',
        tags: []
    },
    {
        id: '2',
        name: 'switch-01',
        status: 'offline',
        device_type: 'Switch',
        manufacturer: 'Cisco',
        role: 'Switch',
        location: 'Site B',
        tags: ['core']
    }
]

const mockColumns: ColumnDefinition[] = [
    { id: 'name', field: 'name', label: 'Name', editable: true, width: '200px' },
    { id: 'status', field: 'status', label: 'Status', editable: true, width: '150px' },
    { id: 'device_type', field: 'device_type', label: 'Type', editable: true, width: '150px' },
    { id: 'location', field: 'location', label: 'Location', editable: true, width: '150px' }
]

describe('EditableDeviceTable', () => {
    // Clear mocks before each test
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render device data correctly', async () => {
        render(
            <EditableDeviceTable
                devices={mockDevices}
                columns={mockColumns}
                modifiedDevices={new Map()}
                onDeviceModified={vi.fn()}
            />
        )

        // Wait for device data to render and effect to settle
        await waitFor(() => {
            expect(screen.getByText('router-01')).toBeInTheDocument()
        })
        expect(screen.getByText('active')).toBeInTheDocument()
        expect(screen.getByText('switch-01')).toBeInTheDocument()
        // Check for Site A
        expect(screen.getByText('Site A')).toBeInTheDocument()
    })

    it('should switch to edit mode on click for text fields', async () => {
        const onModifySpy = vi.fn()
        render(
            <EditableDeviceTable
                devices={mockDevices}
                columns={mockColumns}
                modifiedDevices={new Map()}
                onDeviceModified={onModifySpy}
            />
        )

        await waitFor(() => expect(screen.getByText('router-01')).toBeInTheDocument())

        // 1. Click the name cell of first device
        fireEvent.click(screen.getByText('router-01'))

        // 2. Check input appears with current value
        const input = screen.getByDisplayValue('router-01')
        expect(input).toBeInTheDocument()
        expect(input.tagName).toBe('INPUT')

        // 3. Type new value
        fireEvent.change(input, { target: { value: 'router-99' } })

        // 4. Blur to save (simulate clicking away)
        fireEvent.blur(input)

        // 5. Assert callback was fired with correct ID and change
        expect(onModifySpy).toHaveBeenCalledWith('1', { name: 'router-99' })
    })

    it('should switch to dropdown for select fields (status)', async () => {
        // Note: handling select/radix-ui in tests can be tricky, we'll test the interaction logic
        // We already know from code logic that it renders a Select component
        const onModifySpy = vi.fn()
        render(
            <EditableDeviceTable
                devices={mockDevices}
                columns={mockColumns}
                modifiedDevices={new Map()}
                onDeviceModified={onModifySpy}
            />
        )

        await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument())

        // 1. Click status cell
        fireEvent.click(screen.getByText('active'))

        // 2. We should see a combobox or listbox trigger
        const trigger = screen.getByRole('combobox')
        expect(trigger).toBeInTheDocument()

        // 3. Status text inside trigger
        expect(trigger).toHaveTextContent('Active')
    })

    it('should highlight modified cells', async () => {
        const modifications = new Map()
        modifications.set('1', { name: 'MODIFIED_NAME' })

        render(
            <EditableDeviceTable
                devices={mockDevices}
                columns={mockColumns}
                modifiedDevices={modifications}
                onDeviceModified={vi.fn()}
            />
        )

        await waitFor(() => expect(screen.getByText('MODIFIED_NAME')).toBeInTheDocument())

        // Verify the modified value is shown instead of original
        expect(screen.getByText('MODIFIED_NAME')).toBeInTheDocument()
        expect(screen.queryByText('router-01')).not.toBeInTheDocument()

        // Verify row has modified class (we can check for bg-color or class name)
        // The implementation adds 'bg-red-50' to the row
        const modifiedCell = screen.getByText('MODIFIED_NAME').closest('tr')
        expect(modifiedCell).toHaveClass('bg-red-50')
    })

    it('should support mixed case for Name field interactions', async () => {
        // This tests the unique name field behavior (rendering 'router-01' but allowing edits)
        const onModifySpy = vi.fn()
        render(
            <EditableDeviceTable
                devices={mockDevices}
                columns={mockColumns}
                modifiedDevices={new Map()}
                onDeviceModified={onModifySpy}
            />
        )

        await waitFor(() => expect(screen.getByText('router-01')).toBeInTheDocument())

        // Click Name cell
        fireEvent.click(screen.getByText('router-01'))
        const input = screen.getByDisplayValue('router-01')

        // Change to uppercase
        fireEvent.change(input, { target: { value: 'ROUTER-01' } })
        fireEvent.blur(input)

        expect(onModifySpy).toHaveBeenCalledWith('1', { name: 'ROUTER-01' })
    })
})
