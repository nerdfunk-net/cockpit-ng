import type { CheckResult } from '../types'

/**
 * Escapes a CSV field value by wrapping in quotes if it contains special characters
 */
function escapeCsvField(value: string): string {
  if (!value) return '""'

  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return `"${value}"`
}

/**
 * Export check results to CSV file
 */
export function exportToCSV(
  data: CheckResult[],
  filename: string = `check-ip-results-${new Date().toISOString().split('T')[0]}.csv`
): void {
  if (data.length === 0) {
    console.warn('No data to export')
    return
  }

  const headers = ['IP Address', 'Device Name', 'Status', 'Nautobot Device Name', 'Error']

  const rows = data.map(result => [
    escapeCsvField(result.ip_address),
    escapeCsvField(result.device_name),
    escapeCsvField(result.status),
    escapeCsvField(result.nautobot_device_name || ''),
    escapeCsvField(result.error || '')
  ])

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
