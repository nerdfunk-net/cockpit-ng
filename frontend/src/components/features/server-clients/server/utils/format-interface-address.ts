import type { SelectedInterface } from '../types'

function netmaskToCidr(netmask: string): number | undefined {
  const parts = netmask.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) {
    return undefined
  }
  const val = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
  if (val === 0) return undefined
  let cidr = 0
  let v = val
  while (v & 0x80000000) {
    cidr++
    v = (v << 1) >>> 0
  }
  return cidr > 0 ? cidr : undefined
}

/** Build CIDR notation for a selected server interface. */
export function formatInterfaceAddress(iface: SelectedInterface): string | undefined {
  const raw = iface.address?.trim()
  if (!raw) return undefined
  if (raw.includes('/')) return raw

  if (iface.prefix) {
    const prefix = iface.prefix.replace(/^\//, '').trim()
    if (prefix) return `${raw}/${prefix}`
  }

  if (iface.netmask) {
    const cidr = netmaskToCidr(iface.netmask)
    if (cidr !== undefined) return `${raw}/${cidr}`
  }

  return `${raw}/32`
}

function normalizeIpForCompare(value: string): string {
  return value.split('/')[0]?.trim() ?? value.trim()
}

export function isPrimaryInterfaceAddress(
  address: string,
  primaryIpv4: string | null | undefined
): boolean {
  if (!primaryIpv4?.trim()) return false
  return normalizeIpForCompare(address) === normalizeIpForCompare(primaryIpv4)
}
