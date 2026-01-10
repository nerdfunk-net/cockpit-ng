import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnboardingForm } from './use-onboarding-form'

// Mock dependencies
const mockApiCall = vi.fn()
vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({ apiCall: mockApiCall })
}))

describe('useOnboardingForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should initialize with default values', () => {
        const { result } = renderHook(() => useOnboardingForm())

        expect(result.current.formData).toEqual({
            ip_address: '',
            location_id: '',
            namespace_id: '',
            role_id: '',
            status_id: '',
            platform_id: 'detect',
            secret_groups_id: '',
            interface_status_id: '',
            ip_address_status_id: '',
            prefix_status_id: '',
            port: 22,
            timeout: 30,
            onboarding_timeout: 120,
            sync_options: ['cables', 'software', 'vlans', 'vrfs']
        })
        expect(result.current.ipValidation.isValid).toBe(false)
    })

    it('should update form data', () => {
        const { result } = renderHook(() => useOnboardingForm())

        act(() => {
            result.current.updateFormData({ location_id: 'loc-1', role_id: 'role-1' })
        })

        expect(result.current.formData.location_id).toBe('loc-1')
        expect(result.current.formData.role_id).toBe('role-1')
    })

    it('should validate IP address correctly', () => {
        const { result } = renderHook(() => useOnboardingForm())

        // Invalid IP
        act(() => {
            result.current.handleIPChange('invalid-ip')
        })
        expect(result.current.ipValidation.isValid).toBe(false)

        // Valid IP
        act(() => {
            result.current.handleIPChange('192.168.1.1')
        })
        expect(result.current.ipValidation.isValid).toBe(true)

        // Multiple Valid IPs
        act(() => {
            result.current.handleIPChange('192.168.1.1, 10.0.0.1')
        })
        expect(result.current.ipValidation.isValid).toBe(true)
        expect(result.current.ipValidation.message).toContain('2 valid IP addresses')
    })

    it('should fail form validation if required fields are missing', () => {
        const { result } = renderHook(() => useOnboardingForm())

        // Set valid IP so we pass that check
        act(() => {
            result.current.handleIPChange('192.168.1.1')
        })

        const validation = result.current.validateForm()
        expect(validation.isValid).toBe(false)
        expect(validation.message).toContain('Please fill in all required fields')
    })

    it('should pass form validation when all fields are filled', () => {
        const { result } = renderHook(() => useOnboardingForm())

        act(() => {
            result.current.handleIPChange('192.168.1.1')
            result.current.updateFormData({
                location_id: 'loc-1',
                namespace_id: 'ns-1',
                role_id: 'role-1',
                status_id: 'status-1',
                secret_groups_id: 'secret-1',
                interface_status_id: 'iface-1',
                ip_address_status_id: 'ip-status-1',
                prefix_status_id: 'prefix-1'
            })
        })

        const validation = result.current.validateForm()
        expect(validation.isValid).toBe(true)
    })

    it('should call checkIPInNautobot API', async () => {
        mockApiCall.mockResolvedValue({ exists: false })
        const { result } = renderHook(() => useOnboardingForm())

        act(() => {
            result.current.handleIPChange('192.168.1.1')
        })

        await act(async () => {
            await result.current.checkIPInNautobot('192.168.1.1')
        })

        expect(mockApiCall).toHaveBeenCalledWith('nautobot/check-ip', expect.objectContaining({
            method: 'POST',
            body: { ip_address: '192.168.1.1' }
        }))
    })

    it('should return error status if IP exists in Nautobot and assigned', async () => {
        mockApiCall.mockResolvedValue({
            exists: true,
            is_assigned_to_device: true,
            assigned_devices: [{ name: 'ExistingDevice' }]
        })
        const { result } = renderHook(() => useOnboardingForm())

        act(() => {
            result.current.handleIPChange('192.168.1.1')
        })

        let status
        await act(async () => {
            status = await result.current.checkIPInNautobot('192.168.1.1')
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((status as any).type).toBe('error')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((status as any).message).toContain('ExistingDevice')
    })
})
