import { describe, it, expect } from 'vitest'
import {
  buildVmPayload,
  buildDevicePayload,
  resolveServerSoftwareVersionId,
  validateServerDefaultsForVm,
  validateServerDefaultsForDevice,
} from './build-nautobot-payload'
import type { DefaultsFields } from '@/components/features/settings/common/types/defaults-fields'
import type { ServerResponse } from '../types'

const FULL_DEFAULTS: DefaultsFields = {
  location: 'loc-1',
  platform: 'plat-1',
  interface_status: 'if-status-1',
  device_status: 'dev-status-1',
  ip_address_status: 'ip-st-1',
  ip_prefix_status: 'pfx-st-1',
  namespace: 'ns-global',
  device_role: 'role-1',
  secret_group: 'sec-1',
  csv_delimiter: ',',
  csv_quote_char: '"',
}

const EMPTY_SERVER_OVERRIDES: Partial<ServerResponse> = {}

function server(overrides: Partial<ServerResponse> = EMPTY_SERVER_OVERRIDES): ServerResponse {
  return {
    id: 1,
    hostname: 'web01',
    location: { id: 'loc-server', name: 'DC1' },
    cluster: null,
    primary_ipv4: null,
    primary_interface: null,
    os_family: 'Linux',
    processor_count: 8,
    memtotal_mb: 16384,
    disk_count: 2,
    architecture: 'x86_64',
    distribution_release: null,
    distribution_version: null,
    contact: null,
    nautobot_uuid: null,
    is_virtual: false,
    ansible_facts: {
      ansible_facts: {
        mounts: [{ mount: '/', device: '/dev/sda1', fstype: 'ext4', size_total: 1024 ** 3, size_available: 0 }],
      },
    },
    ansible_credentials: null,
    selected_interfaces: [{ name: 'eth0', address: '10.0.0.1', prefix: '24' }],
    open_ports: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

describe('resolveServerSoftwareVersionId', () => {
  it('resolves software version UUID from OS fields', () => {
    const id = resolveServerSoftwareVersionId(
      server({
        is_virtual: true,
        os_family: 'Debian',
        distribution_release: 'noble',
        distribution_version: '24.04',
      }),
      FULL_DEFAULTS,
      [{ id: 'sv-1', version: 'Debian noble / 24.04' }]
    )
    expect(id).toBe('sv-1')
  })
})

describe('buildVmPayload', () => {
  it('builds VM payload from server and defaults', () => {
    const payload = buildVmPayload(server({ is_virtual: true }), FULL_DEFAULTS, 'cluster-1')
    expect(payload).toMatchObject({
      name: 'web01',
      status: 'dev-status-1',
      cluster: 'cluster-1',
      role: 'role-1',
      platform: 'plat-1',
      vcpus: 8,
      memory: 16384,
      disk: 1,
    })
    expect(payload.interfaces).toHaveLength(1)
  })

  it('includes software version when provided', () => {
    const payload = buildVmPayload(
      server({ is_virtual: true }),
      FULL_DEFAULTS,
      'cluster-1',
      'sv-1'
    )
    expect(payload.softwareVersion).toBe('sv-1')
  })

  it('omits platform when set to detect', () => {
    const payload = buildVmPayload(
      server({ is_virtual: true }),
      { ...FULL_DEFAULTS, platform: 'detect' },
      'cluster-1'
    )
    expect(payload.platform).toBeUndefined()
  })
})

describe('buildDevicePayload', () => {
  it('includes software_version when provided', () => {
    const payload = buildDevicePayload(server(), FULL_DEFAULTS, 'dt-1', 'virtual', 'sv-1')
    expect(payload.software_version).toBe('sv-1')
  })

  it('prefers server location over defaults', () => {
    const payload = buildDevicePayload(server(), FULL_DEFAULTS, 'dt-1', 'virtual')
    expect(payload.location).toBe('loc-server')
    expect(payload.device_type).toBe('dt-1')
    expect(payload.interfaces[0]?.type).toBe('virtual')
    expect(payload.add_prefix).toBe(true)
  })

  it('falls back to defaults location', () => {
    const payload = buildDevicePayload(
      server({ location: null }),
      FULL_DEFAULTS,
      'dt-1',
      'virtual'
    )
    expect(payload.location).toBe('loc-1')
  })
})

describe('validateServerDefaultsForDevice', () => {
  it('accepts server location without defaults location', () => {
    expect(
      validateServerDefaultsForDevice(
        server({ location: { id: 'loc-x', name: 'X' } }),
        { ...FULL_DEFAULTS, location: '' }
      )
    ).toBeNull()
  })

  it('requires location when missing on server and defaults', () => {
    expect(
      validateServerDefaultsForDevice(server({ location: null }), { ...FULL_DEFAULTS, location: '' })
    ).toMatch(/Location/)
  })
})

describe('validateServerDefaultsForVm', () => {
  it('flags missing device status', () => {
    expect(validateServerDefaultsForVm({ ...FULL_DEFAULTS, device_status: '' })).toMatch(/status/)
  })
})
