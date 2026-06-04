import { describe, it, expect } from 'vitest'
import {
  formatInterfaceAddress,
  formatServerPrimaryIpv4Display,
  isPrimaryInterfaceAddress,
} from './format-interface-address'
import type { ServerResponse } from '../types'

describe('formatInterfaceAddress', () => {
  it('returns undefined when address is missing', () => {
    expect(formatInterfaceAddress({ name: 'eth0' })).toBeUndefined()
  })

  it('preserves CIDR when already present', () => {
    expect(formatInterfaceAddress({ name: 'eth0', address: '10.0.0.1/24' })).toBe('10.0.0.1/24')
  })

  it('uses prefix field when provided', () => {
    expect(
      formatInterfaceAddress({ name: 'eth0', address: '10.0.0.1', prefix: '24' })
    ).toBe('10.0.0.1/24')
  })

  it('derives CIDR from netmask', () => {
    expect(
      formatInterfaceAddress({
        name: 'eth0',
        address: '10.0.0.1',
        netmask: '255.255.255.0',
      })
    ).toBe('10.0.0.1/24')
  })

  it('defaults to /32 when only address is set', () => {
    expect(formatInterfaceAddress({ name: 'eth0', address: '10.0.0.1' })).toBe('10.0.0.1/32')
  })
})

describe('formatServerPrimaryIpv4Display', () => {
  it('shows CIDR from ansible_default_ipv4 netmask', () => {
    const server: ServerResponse = {
      id: 1,
      hostname: 'srv',
      location: null,
      cluster: null,
      primary_ipv4: '192.168.178.240',
      primary_interface: 'eth0',
      os_family: null,
      processor_count: null,
      memtotal_mb: null,
      disk_count: null,
      architecture: null,
      distribution_release: null,
      distribution_version: null,
      contact: null,
      nautobot_uuid: null,
      is_virtual: true,
      ansible_facts: {
        ansible_default_ipv4: {
          address: '192.168.178.240',
          interface: 'eth0',
          netmask: '255.255.255.0',
        },
      },
      ansible_credentials: null,
      selected_interfaces: null,
      created_at: null,
      updated_at: null,
    }
    expect(formatServerPrimaryIpv4Display(server)).toBe('192.168.178.240/24')
  })
})

describe('isPrimaryInterfaceAddress', () => {
  it('matches host portion ignoring prefix length', () => {
    expect(isPrimaryInterfaceAddress('10.0.0.1/24', '10.0.0.1')).toBe(true)
    expect(isPrimaryInterfaceAddress('10.0.0.2/24', '10.0.0.1')).toBe(false)
  })
})
