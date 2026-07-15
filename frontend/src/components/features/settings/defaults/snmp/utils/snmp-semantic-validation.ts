import { load as yamlLoad } from 'js-yaml'
import type { SnmpEntryError } from '../types'

const V3_AUTH_PRIVACY_KEYS = [
  'version',
  'type',
  'username',
  'group',
  'auth_protocol_long',
  'auth_protocol',
  'auth_password',
  'privacy_protocol_long',
  'privacy_protocol',
  'privacy_password',
  'privacy_option',
] as const

const V3_AUTH_NO_PRIVACY_KEYS = [
  'version',
  'type',
  'username',
  'group',
  'auth_protocol_long',
  'auth_protocol',
  'auth_password',
] as const

function isV3Version(v: unknown): boolean {
  return v === 3 || v === '3' || v === 'v3'
}

function isV2Version(v: unknown): boolean {
  return v === 2 || v === '2' || v === 'v2'
}

function validateEntry(entry: Record<string, unknown>): string[] {
  const errors: string[] = []
  const { type, version } = entry

  if (type === 'v3_auth_privacy') {
    if (!isV3Version(version)) {
      errors.push(
        `"version" must be 3 or "v3" for type v3_auth_privacy (got "${version}")`
      )
    }
    for (const k of V3_AUTH_PRIVACY_KEYS) {
      if (!(k in entry) || entry[k] == null || entry[k] === '') {
        errors.push(`missing required key: "${k}"`)
      }
    }
  } else if (type === 'v3_auth_no_privacy') {
    if (!isV3Version(version)) {
      errors.push(
        `"version" must be 3 or "v3" for type v3_auth_no_privacy (got "${version}")`
      )
    }
    for (const k of V3_AUTH_NO_PRIVACY_KEYS) {
      if (!(k in entry) || entry[k] == null || entry[k] === '') {
        errors.push(`missing required key: "${k}"`)
      }
    }
  } else if (isV2Version(version)) {
    if (!entry.community) {
      errors.push(`missing required key: "community" for SNMPv2`)
    }
  }

  return errors
}

export function validateSnmpSemantics(content: string): SnmpEntryError[] {
  let parsed: unknown
  try {
    parsed = yamlLoad(content)
  } catch {
    return []
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return []
  }

  const results: SnmpEntryError[] = []
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const errors = validateEntry(value as Record<string, unknown>)
    if (errors.length > 0) {
      results.push({ entryKey: key, errors })
    }
  }
  return results
}
