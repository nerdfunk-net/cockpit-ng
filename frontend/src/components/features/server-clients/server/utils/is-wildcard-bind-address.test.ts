import { describe, it, expect } from 'vitest'
import { isWildcardBindAddress } from './is-wildcard-bind-address'

describe('isWildcardBindAddress', () => {
  it('flags IPv4 wildcard', () => {
    expect(isWildcardBindAddress('0.0.0.0')).toBe(true)
  })

  it('flags IPv6 wildcard', () => {
    expect(isWildcardBindAddress('::')).toBe(true)
  })

  it('flags the ss "*" wildcard shorthand', () => {
    expect(isWildcardBindAddress('*')).toBe(true)
  })

  it('does not flag IPv4 loopback', () => {
    expect(isWildcardBindAddress('127.0.0.1')).toBe(false)
  })

  it('does not flag IPv6 loopback', () => {
    expect(isWildcardBindAddress('::1')).toBe(false)
  })

  it('does not flag a specific interface address', () => {
    expect(isWildcardBindAddress('192.168.1.10')).toBe(false)
  })
})
