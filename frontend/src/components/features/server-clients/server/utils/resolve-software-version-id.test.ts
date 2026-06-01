import { describe, it, expect } from 'vitest'
import { resolveSoftwareVersionId } from './resolve-software-version-id'
import type { SoftwareVersion } from '@/components/features/nautobot/add-device/types'

const VERSIONS: SoftwareVersion[] = [
  {
    id: 'sv-1',
    version: 'Debian noble / 24.04',
    platform: { id: 'plat-debian', name: 'Debian' },
  },
  {
    id: 'sv-2',
    version: 'Ubuntu 22.04',
    platform: { id: 'plat-ubuntu', name: 'Ubuntu' },
  },
]

describe('resolveSoftwareVersionId', () => {
  it('matches version string exactly (case-insensitive)', () => {
    expect(resolveSoftwareVersionId('debian noble / 24.04', VERSIONS)).toBe('sv-1')
  })

  it('prefers versions for the given platform', () => {
    expect(resolveSoftwareVersionId('Debian noble / 24.04', VERSIONS, 'plat-debian')).toBe('sv-1')
  })

  it('returns undefined when no match', () => {
    expect(resolveSoftwareVersionId('Windows Server 2022', VERSIONS)).toBeUndefined()
  })
})
