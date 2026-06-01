import type { MountEntry } from './extract-server-mounts'

const BYTES_PER_GB = 1024 ** 3

/** Sum mount size_total (bytes) and return disk size in whole GB (rounded up). */
export function computeDiskGbFromMounts(mounts: MountEntry[]): number | undefined {
  const totalBytes = mounts.reduce((sum, m) => sum + (m.size_total ?? 0), 0)
  if (totalBytes <= 0) return undefined
  return Math.ceil(totalBytes / BYTES_PER_GB)
}
