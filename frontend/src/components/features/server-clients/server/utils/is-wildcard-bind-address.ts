const WILDCARD_ADDRESSES = new Set(['0.0.0.0', '::', '*', '::0', '0000:0000:0000:0000:0000:0000:0000:0000'])

/**
 * True when a bind address means "reachable on every interface" (0.0.0.0, ::, *),
 * as opposed to a loopback or single-interface address.
 */
export function isWildcardBindAddress(address: string): boolean {
  return WILDCARD_ADDRESSES.has(address)
}
