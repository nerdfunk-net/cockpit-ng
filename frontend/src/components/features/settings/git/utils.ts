// Git Repository Management Utility Functions

import type { GitCredential } from './types'

/**
 * Extract credential name from "id:name" format used by Select component
 */
export function extractCredentialName(credentialValue: string): string | null {
  if (credentialValue === '__none__') return null

  if (credentialValue.includes(':')) {
    const parts = credentialValue.split(':')
    return parts[1] || null
  }

  return credentialValue ? credentialValue : null
}

/**
 * Build credential value in "id:name" format for Select component
 */
export function buildCredentialValue(
  credentials: GitCredential[],
  credentialName: string | undefined,
  authType: string
): string {
  if (!credentialName) return '__none__'

  // Determine expected credential type based on auth_type
  let expectedType = 'token'
  if (authType === 'ssh_key') {
    expectedType = 'ssh_key'
  } else if (authType === 'generic') {
    expectedType = 'generic'
  }

  const matchingCred = credentials.find(
    cred => cred.name === credentialName && cred.type === expectedType
  )

  if (matchingCred?.id) {
    return `${matchingCred.id}:${matchingCred.name}`
  } else if (matchingCred) {
    // Fallback for credentials without ID
    return credentialName
  }

  return '__none__'
}

/**
 * Filter credentials by authentication type
 */
export function filterCredentialsByAuthType(
  credentials: GitCredential[],
  authType: string
): GitCredential[] {
  if (authType === 'ssh_key') {
    return credentials.filter(cred => cred.type === 'ssh_key')
  } else if (authType === 'generic') {
    return credentials.filter(cred => cred.type === 'generic')
  } else {
    return credentials.filter(cred => cred.type === 'token')
  }
}

/**
 * Get label for credential select dropdown
 */
export function getCredentialLabel(authType: string): string {
  if (authType === 'ssh_key') return 'SSH Key Credential'
  if (authType === 'generic') return 'Generic Credential'
  return 'Token Credential'
}

/**
 * Get placeholder for credential select dropdown
 */
export function getCredentialPlaceholder(authType: string): string {
  if (authType === 'ssh_key') return 'Select SSH key credential'
  if (authType === 'generic') return 'Select generic credential'
  return 'Select token credential'
}

/**
 * Get category badge color
 */
export function getCategoryBadgeColor(category: string): string {
  switch (category) {
    case 'device_configs': return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    case 'cockpit_configs': return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200'
    case 'templates': return 'bg-purple-100 text-purple-800 hover:bg-purple-200'
    case 'agent': return 'bg-orange-100 text-orange-800 hover:bg-orange-200'
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  }
}

/**
 * Get status badge color
 */
export function getStatusBadgeColor(isActive: boolean): string {
  return isActive
    ? 'bg-green-100 text-green-800 hover:bg-green-200'
    : 'bg-red-100 text-red-800 hover:bg-red-200'
}

/**
 * Format date string
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

/**
 * Truncate URL for display
 */
export function truncateUrl(url: string, maxLength = 50): string {
  return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url
}
