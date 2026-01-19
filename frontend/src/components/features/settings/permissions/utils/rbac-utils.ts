import type { Permission } from '../types'

/**
 * Group permissions by resource
 */
export function groupPermissionsByResource(
  permissions: Permission[]
): Record<string, Permission[]> {
  return permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = []
    }
    acc[perm.resource]!.push(perm)
    return acc
  }, {} as Record<string, Permission[]>)
}

/**
 * Get action badge color based on permission action
 */
export function getActionColor(action: string): string {
  switch (action) {
    case 'read':
      return 'bg-green-100 text-green-800'
    case 'write':
      return 'bg-blue-100 text-blue-800'
    case 'delete':
      return 'bg-red-100 text-red-800'
    case 'execute':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-slate-100 text-slate-800'
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
