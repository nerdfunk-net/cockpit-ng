import { describe, it, expect } from 'vitest'
import { computeDiskGbFromMounts } from './compute-disk-gb-from-mounts'
import type { MountEntry } from './extract-server-mounts'

function mount(size_total: number): MountEntry {
  return {
    mount: '/',
    device: '/dev/sda1',
    fstype: 'ext4',
    size_total,
    size_available: 0,
  }
}

describe('computeDiskGbFromMounts', () => {
  it('returns undefined when no mount bytes', () => {
    expect(computeDiskGbFromMounts([])).toBeUndefined()
    expect(computeDiskGbFromMounts([mount(0)])).toBeUndefined()
  })

  it('sums mount totals and rounds up to whole GB', () => {
    const oneGb = 1024 ** 3
    const halfGb = oneGb / 2
    expect(computeDiskGbFromMounts([mount(oneGb)])).toBe(1)
    expect(computeDiskGbFromMounts([mount(halfGb), mount(halfGb)])).toBe(1)
    expect(computeDiskGbFromMounts([mount(oneGb), mount(oneGb)])).toBe(2)
    expect(computeDiskGbFromMounts([mount(oneGb + 1)])).toBe(2)
  })
})
