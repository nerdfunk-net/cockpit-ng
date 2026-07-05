import type { StatusVariant } from '@/components/shared/status-badge'
import type { Permission } from '../types'

/**
 * Group permissions by resource
 */
export function groupPermissionsByResource(
  permissions: Permission[]
): Record<string, Permission[]> {
  return permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = []
      }
      acc[perm.resource]!.push(perm)
      return acc
    },
    {} as Record<string, Permission[]>
  )
}

/**
 * Get status badge variant based on permission action
 */
export function getActionVariant(action: string): StatusVariant | null {
  switch (action) {
    case 'read':
      return 'success'
    case 'write':
      return 'info'
    case 'delete':
      return 'error'
    case 'execute':
      return 'warning'
    default:
      return null
  }
}

/**
 * Filter items by search term across multiple fields
 */
export function filterBySearchTerm<T>(
  items: T[],
  searchTerm: string,
  fields: (keyof T)[]
): T[] {
  if (!searchTerm) return items

  const lowerSearch = searchTerm.toLowerCase()
  return items.filter(item =>
    fields.some(field => {
      const value = item[field]
      return typeof value === 'string' && value.toLowerCase().includes(lowerSearch)
    })
  )
}
