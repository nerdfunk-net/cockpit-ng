'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { isWildcardBindAddress } from '../utils/is-wildcard-bind-address'
import type { PortBinding } from '../types'

interface PortBindingBadgeProps {
  binding: PortBinding
}

export function PortBindingBadge({ binding }: PortBindingBadgeProps) {
  const isWildcard = isWildcardBindAddress(binding.address)
  return (
    <Badge
      variant="outline"
      title={
        isWildcard
          ? `Listens on all interfaces (${binding.address}) — reachable from the network`
          : `Listens on ${binding.address} only`
      }
      className={cn(
        'font-mono text-xs',
        isWildcard
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-green-300 bg-green-50 text-green-700'
      )}
    >
      {binding.port} @ {binding.address}
    </Badge>
  )
}
