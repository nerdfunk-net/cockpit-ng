import { describe, it, expect } from 'vitest'
import { resolveVirtualInterfaceType } from './resolve-virtual-interface-type'

describe('resolveVirtualInterfaceType', () => {
  it('returns value when virtual type exists', () => {
    expect(
      resolveVirtualInterfaceType([
        { value: '1000base-t', display_name: '1G' },
        { value: 'virtual', display_name: 'Virtual' },
      ])
    ).toBe('virtual')
  })

  it('matches display name case-insensitively', () => {
    expect(resolveVirtualInterfaceType([{ value: 'other', display_name: 'Virtual' }])).toBe(
      'other'
    )
  })

  it('returns undefined when not found', () => {
    expect(resolveVirtualInterfaceType([{ value: 'lag', display_name: 'LAG' }])).toBeUndefined()
  })
})
