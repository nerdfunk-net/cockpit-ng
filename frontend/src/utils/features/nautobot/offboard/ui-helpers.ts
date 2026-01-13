export function getStatusBadgeClass(status: string): string {
  const statusLower = status.toLowerCase()
  if (statusLower.includes('active') || statusLower.includes('online')) return 'bg-blue-500'
  if (statusLower.includes('failed') || statusLower.includes('offline')) return 'bg-red-500'
  if (statusLower.includes('maintenance')) return 'bg-yellow-500'
  return 'bg-gray-500'
}

export const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 500]
