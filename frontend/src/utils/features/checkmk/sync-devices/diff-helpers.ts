import type { ConfigAttribute } from '@/types/features/checkmk/sync-devices'

const EMPTY_IGNORED_ATTRIBUTES: string[] = []

// Helper function to render config comparison
export function renderConfigComparison(
  nautobot: { attributes?: Record<string, unknown> } | null,
  checkmk: { attributes?: Record<string, unknown> } | null,
  ignoredAttributes: string[] = EMPTY_IGNORED_ATTRIBUTES
): ConfigAttribute[] {
  const allKeys = new Set([
    ...Object.keys(nautobot?.attributes || {}),
    ...Object.keys(checkmk?.attributes || {})
  ])

  return Array.from(allKeys).map(key => {
    const nautobotValue = nautobot?.attributes?.[key]
    const checkmkValue = checkmk?.attributes?.[key]
    const isDifferent = JSON.stringify(nautobotValue) !== JSON.stringify(checkmkValue)
    const nautobotMissing = nautobotValue === undefined
    const checkmkMissing = checkmkValue === undefined
    const isIgnored = ignoredAttributes.includes(key)

    return {
      key,
      nautobotValue,
      checkmkValue,
      isDifferent,
      nautobotMissing,
      checkmkMissing,
      isIgnored
    }
  })
}

// Helper to format value for display
export function formatValue(value: unknown): string {
  if (value === undefined) return '(missing)'
  if (value === null) return '(null)'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// Helper function to get row color based on diff results
export function getRowColorClass(deviceId: string, diffResults: Record<string, 'equal' | 'diff' | 'host_not_found'>): string {
  const result = diffResults[deviceId]
  if (!result) return '' // No test performed yet

  switch (result) {
    case 'equal':
      return 'bg-green-50 hover:bg-green-100 border-green-200'
    case 'diff':
    case 'host_not_found':
      return 'bg-red-50 hover:bg-red-100 border-red-200'
    default:
      return ''
  }
}
