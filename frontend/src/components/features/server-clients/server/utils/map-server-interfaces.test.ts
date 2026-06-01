import { describe, it, expect } from 'vitest'
import {
  mapServerInterfaces,
  mapServerInterfacesForDevice,
  resolveServerInterfaceSources,
} from './map-server-interfaces'
import type { DefaultsFields } from '@/components/features/settings/common/types/defaults-fields'
import type { ServerResponse } from '../types'

const DEFAULTS: DefaultsFields = {
  location: 'loc-1',
  platform: 'plat-1',
  interface_status: 'if-status-1',
  device_status: 'dev-status-1',
  ip_address_status: '',
  ip_prefix_status: '',
  namespace: 'ns-global',
  device_role: 'role-1',
  secret_group: '',
  csv_delimiter: ',',
  csv_quote_char: '"',
}

const EMPTY_SERVER_OVERRIDES: Partial<ServerResponse> = {}

function baseServer(overrides: Partial<ServerResponse> = EMPTY_SERVER_OVERRIDES): ServerResponse {
  return {
    id: 1,
    hostname: 'srv01.example.com',
    location: null,
    primary_ipv4: '192.168.1.10',
    primary_interface: 'eth0',
    os_family: 'Linux',
    processor_count: 4,
    memtotal_mb: 8192,
    disk_count: 1,
    architecture: 'x86_64',
    distribution_release: 'Ubuntu',
    distribution_version: '22.04',
    contact: null,
    nautobot_uuid: null,
    is_virtual: true,
    ansible_facts: null,
    selected_interfaces: [
      { name: 'eth0', address: '192.168.1.10', prefix: '24' },
      { name: 'eth1', address: '10.0.0.5' },
    ],
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

describe('resolveServerInterfaceSources', () => {
  it('adds primary interface when selected_interfaces is empty', () => {
    const server = baseServer({
      selected_interfaces: null,
      primary_interface: 'eth0',
      primary_ipv4: '45.136.30.143',
    })
    expect(resolveServerInterfaceSources(server)).toEqual([
      { name: 'eth0', address: '45.136.30.143' },
    ])
  })

  it('merges primary IPv4 into existing selected interface by name', () => {
    const server = baseServer({
      selected_interfaces: [{ name: 'eth0' }],
      primary_interface: 'eth0',
      primary_ipv4: '45.136.30.143',
    })
    expect(resolveServerInterfaceSources(server)[0]?.address).toBe('45.136.30.143')
  })
})

describe('mapServerInterfaces', () => {
  it('maps primary interface with is_primary when only primary fields are set', () => {
    const server = baseServer({
      selected_interfaces: null,
      primary_interface: 'eth0',
      primary_ipv4: '45.136.30.143',
    })
    const result = mapServerInterfaces({ server, defaults: DEFAULTS })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'eth0',
      ip_addresses: [
        expect.objectContaining({
          address: '45.136.30.143/32',
          is_primary: true,
        }),
      ],
    })
  })
  it('maps interfaces with namespace, status, and primary IP flag', () => {
    const result = mapServerInterfaces({ server: baseServer(), defaults: DEFAULTS })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      name: 'eth0',
      status: 'if-status-1',
      ip_addresses: [
        expect.objectContaining({
          address: '192.168.1.10/24',
          namespace: 'ns-global',
          is_primary: true,
        }),
      ],
    })
    expect(result[1]?.ip_addresses[0]).toMatchObject({
      address: '10.0.0.5/32',
      is_primary: false,
    })
  })

  it('skips interfaces without a name', () => {
    const server = baseServer({
      selected_interfaces: [{ name: '', address: '1.2.3.4' }, { name: 'eth0', address: '1.2.3.4' }],
    })
    expect(mapServerInterfaces({ server, defaults: DEFAULTS })).toHaveLength(1)
  })
})

describe('mapServerInterfacesForDevice', () => {
  it('includes virtual interface type on each interface', () => {
    const result = mapServerInterfacesForDevice({
      server: baseServer({ is_virtual: false }),
      defaults: DEFAULTS,
      interfaceType: 'virtual',
    })
    expect(result[0]?.type).toBe('virtual')
  })
})
