import { describe, it, expect } from 'vitest'
import {
  getDefaultIpv4FromFacts,
  getIpv4FromFacts,
  mergeInterfaceWithFacts,
} from './get-ipv4-from-facts'
import type { ServerResponse } from '../types'

function serverWithFacts(ansible_facts: Record<string, unknown>): ServerResponse {
  return {
    id: 1,
    hostname: 'srv01',
    location: null,
    cluster: null,
    primary_ipv4: '192.168.178.240',
    primary_interface: 'eth0',
    os_family: 'Linux',
    processor_count: 4,
    memtotal_mb: 8192,
    disk_count: 1,
    architecture: 'x86_64',
    distribution_release: null,
    distribution_version: null,
    contact: null,
    nautobot_uuid: null,
    is_virtual: true,
    ansible_facts,
    ansible_credentials: null,
    selected_interfaces: null,
    created_at: null,
    updated_at: null,
  }
}

describe('getIpv4FromFacts', () => {
  it('reads per-interface IPv4 from hostvars ansible_* keys', () => {
    const server = serverWithFacts({
      ansible_eth0: {
        ipv4: {
          address: '192.168.178.240',
          netmask: '255.255.255.0',
        },
      },
    })
    expect(getIpv4FromFacts(server, 'eth0')).toMatchObject({
      address: '192.168.178.240',
      netmask: '255.255.255.0',
    })
  })

  it('reads per-interface IPv4 from nested ansible_facts', () => {
    const server = serverWithFacts({
      ansible_facts: {
        eth0: {
          ipv4: { address: '10.0.0.1', prefix: '24' },
        },
      },
    })
    expect(getIpv4FromFacts(server, 'eth0')).toMatchObject({
      address: '10.0.0.1',
      prefix: '24',
    })
  })

  it('reads per-interface IPv4 from legacy wrapped facts', () => {
    const server = serverWithFacts({
      facts: {
        ansible_eth1: {
          ipv4: { address: '10.0.0.5', netmask: '255.255.255.0' },
        },
      },
    })
    expect(getIpv4FromFacts(server, 'eth1')).toMatchObject({
      address: '10.0.0.5',
      netmask: '255.255.255.0',
    })
  })
})

describe('getDefaultIpv4FromFacts', () => {
  it('reads default IPv4 from hostvars ansible_default_ipv4', () => {
    const server = serverWithFacts({
      ansible_default_ipv4: {
        address: '192.168.178.240',
        interface: 'eth0',
        netmask: '255.255.255.0',
      },
    })
    expect(getDefaultIpv4FromFacts(server)).toMatchObject({
      address: '192.168.178.240',
      netmask: '255.255.255.0',
    })
  })
})

describe('mergeInterfaceWithFacts', () => {
  it('applies default_ipv4 netmask to primary interface when per-iface facts lack mask', () => {
    const server = serverWithFacts({
      ansible_default_ipv4: {
        address: '192.168.178.240',
        interface: 'eth0',
        netmask: '255.255.255.0',
      },
    })
    expect(
      mergeInterfaceWithFacts(server, { name: 'eth0', address: '192.168.178.240' })
    ).toMatchObject({
      netmask: '255.255.255.0',
    })
  })
})
