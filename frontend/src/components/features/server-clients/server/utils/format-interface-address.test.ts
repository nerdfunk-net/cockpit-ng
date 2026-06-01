import { describe, it, expect } from 'vitest'
import {
  formatInterfaceAddress,
  isPrimaryInterfaceAddress,
} from './format-interface-address'

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

describe('isPrimaryInterfaceAddress', () => {
  it('matches host portion ignoring prefix length', () => {
    expect(isPrimaryInterfaceAddress('10.0.0.1/24', '10.0.0.1')).toBe(true)
    expect(isPrimaryInterfaceAddress('10.0.0.2/24', '10.0.0.1')).toBe(false)
  })
})
