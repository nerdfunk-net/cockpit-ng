import { describe, it, expect } from 'vitest'
import { convertModifiedDevicesToJSON, validateModifiedDevices } from './json-converter'
import type { DeviceInfo } from '@/components/shared/device-selector'

describe('json-converter', () => {
    describe('convertModifiedDevicesToJSON', () => {
        it('should correctly format a simple field update', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            modifications.set('device-123', { status: 'active' })

            const result = convertModifiedDevicesToJSON(modifications)

            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                id: 'device-123',
                status: 'active'
            })
        })

        it('should include interface config when primary IP changes', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
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
                mgmt_interface_type: 'virtual',
                mgmt_interface_status: 'active',
                mgmt_interface_create_on_ip_change: true
            })
        })

        it('should include namespace when provided and primary IP changes', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            modifications.set('device-123', { primary_ip4: '10.0.0.1/24' })

            const result = convertModifiedDevicesToJSON(
                modifications,
                undefined,
                'namespace-uuid'
            )

            expect(result[0]).toMatchObject({
                id: 'device-123',
                primary_ip4: '10.0.0.1/24',
                namespace: 'namespace-uuid'
            })
        })

        it('should NOT include interface config if primary IP does not change', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            modifications.set('device-123', { status: 'active' }) // Not changing IP

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

            expect(result[0]).toEqual({
                id: 'device-123',
                status: 'active'
            })
            expect(result[0]).not.toHaveProperty('mgmt_interface_name')
        })

        it('should extract ID from object fields that have an ID property', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            // @ts-expect-error - testing generic object handling that might come from runtime state
            modifications.set('device-123', { role: { id: 'role-uuid', name: 'Core Switch' } })

            const result = convertModifiedDevicesToJSON(modifications)

            expect(result[0]).toEqual({
                id: 'device-123',
                role: 'role-uuid'
            })
        })

        it('should stringify unknown object types', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            // @ts-expect-error - testing generic object handling
            modifications.set('device-123', { custom_field: { foo: 'bar' } })

            const result = convertModifiedDevicesToJSON(modifications)

            expect(result[0]).toEqual({
                id: 'device-123',
                custom_field: '{"foo":"bar"}'
            })
        })

        it('should throw error if no devices modified', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            expect(() => convertModifiedDevicesToJSON(modifications)).toThrow('No modified devices to save')
        })
    })

    describe('validateModifiedDevices', () => {
        it('should throw error if map is empty', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            expect(() => validateModifiedDevices(modifications)).toThrow('No devices have been modified')
        })

        it('should throw error if a device has no changes', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            modifications.set('device-123', {})
            expect(() => validateModifiedDevices(modifications)).toThrow('Device device-123 has no modified fields')
        })

        it('should pass if data is valid', () => {
            const modifications = new Map<string, Partial<DeviceInfo>>()
            modifications.set('device-123', { name: 'New Name' })
            expect(() => validateModifiedDevices(modifications)).not.toThrow()
        })
    })
})
