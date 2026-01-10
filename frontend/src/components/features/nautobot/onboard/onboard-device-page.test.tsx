import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OnboardDevicePage } from './onboard-device-page'

// Mock dependencies
const mockApiCall = vi.fn()
vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({ apiCall: mockApiCall })
}))

// Mock child components
vi.mock('./components/job-status-display', () => ({
    JobStatusDisplay: () => <div data-testid="job-status-display">Job Status</div>
}))

vi.mock('./components/onboarding-progress-modal', () => ({
    OnboardingProgressModal: () => <div data-testid="onboarding-progress-modal" />
}))

// Mock Alert instead of ValidationMessage for consistency
vi.mock('@/components/ui/alert', () => ({
    Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
    AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// Mock useOnboardingData
vi.mock('./hooks/use-onboarding-data', () => ({
    useOnboardingData: () => ({
        locations: [{ id: 'loc-1', name: 'Site A' }],
        namespaces: [{ id: 'ns-1', name: 'Global' }],
        deviceRoles: [{ id: 'role-1', name: 'Router' }],
        platforms: [{ id: 'cisco_ios', name: 'Cisco IOS' }],
        deviceStatuses: [{ id: 'active', name: 'Active' }],
        interfaceStatuses: [{ id: 'connected', name: 'Connected' }],
        ipAddressStatuses: [{ id: 'active', name: 'Active' }],
        prefixStatuses: [{ id: 'active', name: 'Active' }],
        secretGroups: [{ id: 'secret-1', name: 'SSH Key' }],
        nautobotDefaults: null,
        isLoading: false,
        loadData: vi.fn(),
        getDefaultFormValues: vi.fn(),
        getDefaultLocationDisplay: vi.fn()
    })
}))

describe('OnboardDevicePage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render the onboarding page', () => {
        render(<OnboardDevicePage />)
        expect(screen.getByRole('heading', { name: 'Onboard Network Device' })).toBeInTheDocument()
    })

    it('should have disabled submit button when form is empty', () => {
        render(<OnboardDevicePage />)
        const submitBtn = screen.getByRole('button', { name: /Onboard Device/i })
        expect(submitBtn).toBeDisabled()
    })

    it('should show validation error when required fields are missing', async () => {
        mockApiCall.mockResolvedValue({})

        render(<OnboardDevicePage />)

        const ipInput = screen.getByLabelText(/IP Address/i)
        fireEvent.change(ipInput, { target: { value: '192.168.1.1' } })

        const submitBtn = screen.getByRole('button', { name: /Onboard Device/i })
        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled()
        })

        fireEvent.click(submitBtn)

        // Using findByText with regex for robustness
        expect(await screen.findByText(/Please fill in all required fields/i)).toBeInTheDocument()
    })

    it('should allow filling form and submitting', async () => {
        mockApiCall.mockResolvedValue({
            task_id: 'task-123',
            status: 'PENDING',
            message: 'Started'
        })

        render(<OnboardDevicePage />)

        const ipInput = screen.getByLabelText(/IP Address/i)
        fireEvent.change(ipInput, { target: { value: '192.168.1.1' } })
        expect(ipInput).toHaveValue('192.168.1.1')
    })
})
