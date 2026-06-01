import { describe, it, expect } from 'vitest'
import {
  formatServerDistribution,
  formatServerOsSoftwareVersionLabel,
} from './format-server-os-software-version'
import type { ServerResponse } from '../types'

const EMPTY_OVERRIDES: Partial<ServerResponse> = {}

function server(overrides: Partial<ServerResponse> = EMPTY_OVERRIDES): ServerResponse {
  return {
    id: 1,
    hostname: 'srv01',
    location: null,
    cluster: null,
    primary_ipv4: null,
    primary_interface: null,
    os_family: 'Debian',
    processor_count: null,
    memtotal_mb: null,
    disk_count: null,
    architecture: null,
    distribution_release: 'noble',
    distribution_version: '24.04',
    contact: null,
    nautobot_uuid: null,
    is_virtual: true,
    ansible_facts: null,
    ansible_credentials: null,
    selected_interfaces: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

describe('formatServerDistribution', () => {
  it('joins release and version with slash', () => {
    expect(formatServerDistribution(server())).toBe('noble / 24.04')
  })
})

describe('formatServerOsSoftwareVersionLabel', () => {
  it('combines OS family and distribution', () => {
    expect(formatServerOsSoftwareVersionLabel(server())).toBe('Debian noble / 24.04')
  })

  it('returns only family when distribution is missing', () => {
    expect(
      formatServerOsSoftwareVersionLabel(
        server({ distribution_release: null, distribution_version: null })
      )
    ).toBe('Debian')
  })

  it('returns undefined when both are missing', () => {
    expect(
      formatServerOsSoftwareVersionLabel(
        server({ os_family: null, distribution_release: null, distribution_version: null })
      )
    ).toBeUndefined()
  })
})
