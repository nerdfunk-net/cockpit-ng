'use client'

import { StatusBadge } from '@/components/shared/status-badge'
import { isWildcardBindAddress } from '../utils/is-wildcard-bind-address'
import type { PortBinding } from '../types'

interface PortBindingBadgeProps {
  binding: PortBinding
}

export function PortBindingBadge({ binding }: PortBindingBadgeProps) {
  const isWildcard = isWildcardBindAddress(binding.address)
  return (
    <StatusBadge
      variant={isWildcard ? 'error' : 'success'}
      className="font-mono text-xs"
      title={
        isWildcard
          ? `Listens on all interfaces (${binding.address}) — reachable from the network`
          : `Listens on ${binding.address} only`
      }
    >
      {binding.port} @ {binding.address}
    </StatusBadge>
  )
}
