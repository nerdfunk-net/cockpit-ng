/**
 * Format a unix timestamp as relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/**
 * Format uptime from a unix timestamp to a human-readable duration
 */
export function formatUptime(startedAt: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - startedAt

  if (diff < 60) return `${diff}s`
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins}m`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    const mins = Math.floor((diff % 3600) / 60)
    return `${hours}h ${mins}m`
  }
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  return `${days}d ${hours}h`
}

/**
 * Parse comma-separated capabilities string into array
 */
export function parseCapabilities(capabilities: string): string[] {
  if (!capabilities) return []
  return capabilities
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
}

/**
 * Format execution time in ms to readable string
 */
export function formatExecutionTime(ms: number | null): string {
  if (ms === null || ms === undefined) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
