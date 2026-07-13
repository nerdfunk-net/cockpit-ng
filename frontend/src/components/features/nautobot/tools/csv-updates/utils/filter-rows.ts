import type { FilterRow, ParsedCSVData } from '../types'

/**
 * Builds one FilterRow per CSV line for non-device object types, used by the
 * Filter step's table. `displayName` is the raw value of the CSV column
 * chosen as the lookup/primary key.
 */
export function buildFilterRows(
  parsedData: ParsedCSVData,
  fieldMapping: Record<string, string | null>,
  primaryKeyColumn: string
): FilterRow[] {
  const mappedColumns = parsedData.headers
    .map((header, index) => ({ header, index, field: fieldMapping[header] }))
    .filter((entry): entry is { header: string; index: number; field: string } =>
      Boolean(entry.field)
    )

  const primaryKeyIndex = parsedData.headers.indexOf(primaryKeyColumn)

  return parsedData.rows.map((row, rowIndex) => {
    const fields: Record<string, string> = {}
    for (const { index, field } of mappedColumns) {
      fields[field] = row[index] ?? ''
    }

    const displayName = primaryKeyIndex >= 0 ? (row[primaryKeyIndex] ?? '') : ''

    return {
      id: `row-${rowIndex}`,
      displayName,
      fields,
    }
  })
}

/**
 * Sorts filter rows by display name (natural/numeric-aware, case-insensitive)
 * so devices/rows group predictably in the Filter step regardless of the
 * CSV's original row order — CSV exports are often unsorted or interleaved.
 */
export function sortFilterRowsByDisplayName(rows: FilterRow[]): FilterRow[] {
  return [...rows].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  )
}
