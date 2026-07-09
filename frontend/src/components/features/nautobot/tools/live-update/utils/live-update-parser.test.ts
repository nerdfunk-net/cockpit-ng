import { describe, it, expect } from 'vitest'
import { buildDeviceUpdateJson } from './live-update-parser'
import type { LiveUpdateRow } from '../types'

function row(
  id: string,
  deviceName: string,
  fields: Record<string, string>
): LiveUpdateRow {
  return { id, deviceName, fields, hasIpAddress: Boolean(fields.interface_ip_address) }
}

describe('buildDeviceUpdateJson', () => {
  it('builds one device object per device name', () => {
    const rows = [
      row('r1', 'router-1', { name: 'router-1', status: 'active' }),
      row('r2', 'router-2', { name: 'router-2', status: 'planned' }),
    ]

    const result = buildDeviceUpdateJson(rows, {})

    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('router-1')
    expect(result[0]?.status).toBe('active')
    expect(result[1]?.name).toBe('router-2')
    expect(result[1]?.status).toBe('planned')
  })

  it('includes every interface row for a device, not just the primary', () => {
    const rows = [
      row('r1', 'router-1', {
        name: 'router-1',
        interface_name: 'Gi0/1',
        interface_ip_address: '10.0.0.1/24',
      }),
      row('r2', 'router-1', {
        name: 'router-1',
        interface_name: 'Gi0/2',
        interface_ip_address: '10.0.0.2/24',
      }),
    ]

    const [device] = buildDeviceUpdateJson(rows, { 'router-1': 'r1' })

    expect(device?.interfaces).toHaveLength(2)
    expect(device?.interfaces[0]).toMatchObject({
      name: 'Gi0/1',
      ip_address: '10.0.0.1/24',
      is_primary_ipv4: true,
    })
    expect(device?.interfaces[1]).toMatchObject({
      name: 'Gi0/2',
      ip_address: '10.0.0.2/24',
    })
    expect(device?.interfaces[1]?.is_primary_ipv4).toBeUndefined()
  })

  it('omits type/status/ip_address from an interface entry when not mapped', () => {
    const rows = [row('r1', 'router-1', { name: 'router-1', interface_name: 'Gi0/1' })]

    const [device] = buildDeviceUpdateJson(rows, {})

    expect(device?.interfaces).toEqual([{ name: 'Gi0/1' }])
  })

  it('does not create an interface entry for a row with no interface name', () => {
    const rows = [
      row('r1', 'router-1', { name: 'router-1', status: 'active' }),
      row('r2', 'router-1', { name: 'router-1', interface_ip_address: '10.0.0.1/24' }),
    ]

    const [device] = buildDeviceUpdateJson(rows, {})

    expect(device?.interfaces).toEqual([])
  })

  it('takes device-level fields from the first row that has a non-empty value', () => {
    const rows = [
      row('r1', 'router-1', { name: 'router-1', role: '' }),
      row('r2', 'router-1', { name: 'router-1', role: 'edge' }),
    ]

    const [device] = buildDeviceUpdateJson(rows, {})

    expect(device?.role).toBe('edge')
  })

  it('skips rows without a device name', () => {
    const rows = [row('r1', '', { name: '' })]

    const result = buildDeviceUpdateJson(rows, {})

    expect(result).toEqual([])
  })
})
