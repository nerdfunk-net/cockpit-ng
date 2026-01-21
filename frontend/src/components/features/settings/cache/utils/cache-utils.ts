/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

/**
 * Convert MB to bytes
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024
}

/**
 * Check if cache entry is about to expire (within 10% of TTL)
 */
export function isExpiringSoon(entry: { ttl_seconds: number; age_seconds: number }): boolean {
  return entry.age_seconds > entry.ttl_seconds * 0.9
}
