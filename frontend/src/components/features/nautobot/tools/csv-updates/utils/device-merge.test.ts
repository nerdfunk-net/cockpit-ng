import { describe, it, expect } from 'vitest'
import { applyDeviceDefaults } from './device-merge'
import type { DefaultProperty, DeviceUpdatePayload } from '../types'

const PROFILE_DEFAULTS: DefaultProperty[] = [
  { field: 'status', value: 'profile-status', rowKey: 'device_status' },
  { field: 'role', value: 'profile-role', rowKey: 'device_role' },
  { field: 'location', value: 'profile-location', rowKey: 'location' },
  { field: 'device_type', value: 'profile-device-type', rowKey: 'device_type' },
  { field: 'platform', value: 'profile-platform', rowKey: 'platform' },
  { field: 'interface_status', value: 'profile-if-status', rowKey: 'interface_status' },
  { field: 'interface_type', value: 'profile-if-type', rowKey: 'interface_type' },
]

const EMPTY_OVERRIDES: Partial<DeviceUpdatePayload> = {}

function payload(overrides: Partial<DeviceUpdatePayload> = EMPTY_OVERRIDES): DeviceUpdatePayload {
  return { name: 'device-1', interfaces: [], ...overrides }
}

describe('applyDeviceDefaults', () => {
  it('returns the payload unchanged when there are no defaults', () => {
    const p = payload({ status: 'Active' })
    expect(applyDeviceDefaults(p, [])).toEqual(p)
  })

  it('backfills missing device-level fields from the profile', () => {
    const result = applyDeviceDefaults(payload(), PROFILE_DEFAULTS)

    expect(result.status).toBe('profile-status')
    expect(result.role).toBe('profile-role')
    expect(result.location).toBe('profile-location')
    expect(result.device_type).toBe('profile-device-type')
    expect(result.platform).toBe('profile-platform')
  })

  it('never overwrites a device-level field the CSV already supplied', () => {
    const result = applyDeviceDefaults(
      payload({
        status: 'csv-status',
        role: 'csv-role',
        location: 'csv-location',
        device_type: 'csv-device-type',
        platform: 'csv-platform',
      }),
      PROFILE_DEFAULTS
    )

    expect(result.status).toBe('csv-status')
    expect(result.role).toBe('csv-role')
    expect(result.location).toBe('csv-location')
    expect(result.device_type).toBe('csv-device-type')
    expect(result.platform).toBe('csv-platform')
  })

  it('backfills interface status/type only for interfaces missing them, per interface', () => {
    const result = applyDeviceDefaults(
      payload({
        interfaces: [
          { name: 'eth0' },
          { name: 'eth1', status: 'csv-if-status', type: 'csv-if-type' },
        ],
      }),
      PROFILE_DEFAULTS
    )

    expect(result.interfaces[0]).toMatchObject({
      name: 'eth0',
      status: 'profile-if-status',
      type: 'profile-if-type',
    })
    expect(result.interfaces[1]).toMatchObject({
      name: 'eth1',
      status: 'csv-if-status',
      type: 'csv-if-type',
    })
  })

  it('leaves fields absent when the profile has no value for them', () => {
    const result = applyDeviceDefaults(payload(), [
      { field: 'status', value: 'profile-status', rowKey: 'device_status' },
    ])

    expect(result.status).toBe('profile-status')
    expect(result.role).toBeUndefined()
    expect(result.location).toBeUndefined()
  })
})
