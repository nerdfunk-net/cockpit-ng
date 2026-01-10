import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddDevicePage } from './add-device-page'

// Mock dependencies
const mockApiCall = vi.fn()
vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({ apiCall: mockApiCall })
}))

vi.mock('@/lib/auth-store', () => ({
    useAuthStore: () => ({ isAuthenticated: true })
}))

vi.mock('./hooks/use-csv-upload', () => ({
    useCSVUpload: () => ({
        showModal: false,
        openModal: vi.fn(),
        closeModal: vi.fn(),
        csvFile: null,
        parsedData: [],
        isParsing: false,
        isSubmitting: false
    })
}))

// Mock child modals
vi.mock('./components/csv-upload-modal', () => ({
    CSVUploadModal: () => <div data-testid="csv-upload-modal" />
}))

// Mock UI components
vi.mock('@/components/ui/alert', () => ({
    Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
    AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

describe('AddDevicePage', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default API mocks for dropdowns
        mockApiCall.mockImplementation((url) => {
            // Return empty arrays/objects to simulate successful "no data" load or basic data
            // This allows Promise.all to resolve and loading state to clear
            if (url === 'nautobot/roles/devices') return Promise.resolve([{ id: 'role-1', name: 'Router' }])
            if (url === 'settings/nautobot/defaults') return Promise.resolve({ success: true, data: {} })
            if (typeof url === 'string') return Promise.resolve([])
            return Promise.resolve([])
        })
    })

    it('should render the add device page', async () => {
        render(<AddDevicePage />)

        // Wait for data load to complete
        await waitFor(() => {
            expect(screen.queryByText(/Loading form data.../i)).not.toBeInTheDocument()
        })

        expect(screen.getByText('Add Device to Nautobot')).toBeInTheDocument()
    })

    it('should validate form on submission', async () => {
        render(<AddDevicePage />)

        // Wait for initial data load
        await waitFor(() => expect(screen.queryByText(/Loading form data.../i)).not.toBeInTheDocument())

        const submitBtn = screen.getByText('Add Device')
        fireEvent.click(submitBtn)

        // Should show validation error (Device name is required)
        // We use findByText which waits automatically (default 1000ms)
        // Using loose regex matching for robustness
        expect(await screen.findByText(/Device name is required/i)).toBeInTheDocument()
    })
})
