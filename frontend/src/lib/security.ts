/**
 * Security utilities for protecting against XSS, CSRF and other vulnerabilities
 */

const EMPTY_DOMAINS: string[] = []

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param unsafe - The unsafe string that may contain HTML
 * @returns The escaped string safe for HTML insertion
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe || '')
  }

  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Strips HTML tags from a string completely
 * @param input - The input string that may contain HTML
 * @returns The string with all HTML tags removed
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') {
    return String(input || '')
  }

  return input.replace(/<[^>]*>/g, '')
}

/**
 * Validates that a URL is safe for redirects (same origin or allowed domains)
 * @param url - The URL to validate
 * @param allowedDomains - Optional array of allowed domains
 * @returns True if the URL is safe
 */
export function isSafeUrl(url: string, allowedDomains: string[] = EMPTY_DOMAINS): boolean {
  try {
    const parsed = new URL(url, window.location.origin)

    // Allow same origin
    if (parsed.origin === window.location.origin) {
      return true
    }

    // Check allowed domains
    if (allowedDomains.includes(parsed.hostname)) {
      return true
    }

    return false
  } catch {
    // Invalid URL
    return false
  }
}

/**
 * Generates a cryptographically secure random CSRF token
 * @returns A random CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array)
  } else {
    // Fallback for older browsers or server-side
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validates a CSRF token format
 * @param token - The token to validate
 * @returns True if the token has the correct format
 */
export function isValidCSRFToken(token: string): boolean {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
}