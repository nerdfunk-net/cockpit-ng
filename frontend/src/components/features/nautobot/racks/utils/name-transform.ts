import type { NameTransform } from '../types'

/**
 * Apply a NameTransform to a device name and return the lookup string.
 * - regex mode: runs RegExp.exec; returns captured group(1) if present, else full match. Returns
 *   original name when there is no match or the pattern is empty.
 * - replace mode: replaces all matches globally. Empty replacement deletes the matched portion.
 * Returns the original name unchanged on regex errors.
 */
export function applyNameTransform(name: string, transform: NameTransform | null): string {
  if (!transform || !transform.pattern.trim()) return name
  try {
    if (transform.mode === 'regex') {
      const rx = new RegExp(transform.pattern.trim())
      const m = rx.exec(name)
      if (m) return m[1] !== undefined ? m[1] : m[0]
      return name
    }
    return name.replace(new RegExp(transform.pattern.trim(), 'g'), transform.replacement)
  } catch {
    return name
  }
}
