import type { ServerResponse } from '../types'

const TRACKED_FIELDS: Array<{
  key: keyof ServerResponse
  label: string
  format?: (value: unknown, server: ServerResponse) => string
}> = [
  { key: 'hostname', label: 'Hostname' },
  { key: 'os_family', label: 'OS family' },
  { key: 'architecture', label: 'Architecture' },
  {
    key: 'distribution_release',
    label: 'Distribution',
    format: (_v, s) =>
      [s.distribution_release, s.distribution_version].filter(Boolean).join(' / ') || '—',
  },
  { key: 'processor_count', label: 'CPUs', format: (v) => (v == null ? '—' : String(v)) },
  { key: 'memtotal_mb', label: 'RAM', format: (v) => (v == null ? '—' : `${v} MB`) },
  { key: 'disk_count', label: 'Disks', format: (v) => (v == null ? '—' : String(v)) },
  { key: 'primary_ipv4', label: 'Primary IPv4' },
  { key: 'primary_interface', label: 'Interface' },
  {
    key: 'is_virtual',
    label: 'Virtual machine',
    format: (v) => (v ? 'Yes' : 'No'),
  },
]

function displayValue(
  server: ServerResponse,
  field: (typeof TRACKED_FIELDS)[number]
): string {
  if (field.format) {
    return field.format(server[field.key], server)
  }
  const v = server[field.key]
  return v == null || v === '' ? '—' : String(v)
}

/** Returns human-readable lines for fields that changed after a facts refresh. */
export function describeServerFactsChanges(
  before: ServerResponse,
  after: ServerResponse
): string[] {
  const lines: string[] = []

  for (const field of TRACKED_FIELDS) {
    const prev = displayValue(before, field)
    const next = displayValue(after, field)
    if (prev !== next) {
      lines.push(`${field.label}: ${prev} → ${next}`)
    }
  }

  const beforeFacts = JSON.stringify(before.ansible_facts ?? null)
  const afterFacts = JSON.stringify(after.ansible_facts ?? null)
  if (beforeFacts !== afterFacts) {
    lines.push('Ansible facts data was updated')
  }

  return lines
}
