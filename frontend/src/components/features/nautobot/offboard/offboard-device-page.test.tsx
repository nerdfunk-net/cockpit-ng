import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OffboardDevicePage } from './offboard-device-page'

// Mock dependencies
const mockApiCall = vi.fn()
vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({ apiCall: mockApiCall })
}))

vi.mock('@/lib/auth-store', () => ({
    useAuthStore: () => ({ isAuthenticated: true, logout: vi.fn() })
}))

// Mock Alert
vi.mock('@/components/ui/alert', () => ({
    Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
    AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

describe('OffboardDevicePage', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock initial data loads
        mockApiCall.mockImplementation((url) => {
            if (url === 'nautobot/locations') return Promise.resolve([])
            if (url === 'nautobot/devices') return Promise.resolve({ devices: [] })
            return Promise.resolve(null)
        })
    })

    it('should render the offboard device page', async () => {
        render(<OffboardDevicePage />)

        // Initially should show loading
        expect(screen.getByText('Loading devices...')).toBeInTheDocument()

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('Loading devices...')).not.toBeInTheDocument()
        })

        // Now check for main content - use generic query or heading
        expect(screen.getByRole('heading', { name: 'Offboard Devices' })).toBeInTheDocument()
    })

    it('should show offboarding panel', async () => {
        render(<OffboardDevicePage />)
        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('Loading devices...')).not.toBeInTheDocument()
        })

        await waitFor(() => {
            expect(screen.getByText('Offboarding')).toBeInTheDocument()
            expect(screen.getByText('Remove Primary IP')).toBeInTheDocument()
        })
    })
})
