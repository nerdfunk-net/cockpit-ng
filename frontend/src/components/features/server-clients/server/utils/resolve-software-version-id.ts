import type { SoftwareVersion } from '@/components/features/nautobot/add-device/types'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Resolve a Nautobot software version UUID from a display label and catalog list.
 */
export function resolveSoftwareVersionId(
  label: string,
  versions: SoftwareVersion[],
  platformId?: string
): string | undefined {
  const target = normalize(label)
  if (!target || versions.length === 0) return undefined

  const pool = platformId
    ? versions.filter(v => v.platform?.id === platformId)
    : versions
  const candidates = pool.length > 0 ? pool : versions

  const exact = candidates.find(
    v => normalize(v.version) === target || (v.alias && normalize(v.alias) === target)
  )
  if (exact) return exact.id

  const contains = candidates.find(
    v =>
      normalize(v.version).includes(target) ||
      target.includes(normalize(v.version))
  )
  return contains?.id
}
