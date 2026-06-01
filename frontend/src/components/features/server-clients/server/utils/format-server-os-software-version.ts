import type { ServerResponse } from '../types'

/** Distribution segment from release + version (e.g. "noble / 24.04"). */
export function formatServerDistribution(server: ServerResponse): string {
  return [server.distribution_release, server.distribution_version].filter(Boolean).join(' / ')
}

/**
 * Combined OS label for Nautobot software version matching (e.g. "Debian noble / 24.04").
 */
export function formatServerOsSoftwareVersionLabel(server: ServerResponse): string | undefined {
  const family = server.os_family?.trim()
  const distribution = formatServerDistribution(server).trim()

  if (!family && !distribution) return undefined
  if (!family) return distribution
  if (!distribution) return family
  return `${family} ${distribution}`
}
