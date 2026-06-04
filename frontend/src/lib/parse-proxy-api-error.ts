/**
 * Extract a user-facing message from errors thrown by useApi() (`API Error <status>: <body>`).
 */
export function parseProxyApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error'
  }

  let errorMessage = error.message
  const jsonMatch = errorMessage.match(/API Error \d+: (.+)/s)
  if (!jsonMatch?.[1]) {
    return errorMessage
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]) as { detail?: unknown }
    const detail = parsed.detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      return (detail as { message: string }).message
    }
  } catch {
    // Body was not JSON — use raw tail if it is plain text
    const raw = jsonMatch[1].trim()
    if (raw && !raw.startsWith('{')) {
      return raw
    }
  }

  return errorMessage
}
