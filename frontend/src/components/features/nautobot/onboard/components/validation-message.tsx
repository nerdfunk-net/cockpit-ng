'use client'

import { StatusAlert } from '@/components/shared/status-alert'
import type { StatusMessage } from '../types'

interface ValidationMessageProps {
  message: StatusMessage
  className?: string
  onDismiss?: () => void
}

export function ValidationMessage({
  message,
  className,
  onDismiss,
}: ValidationMessageProps) {
  return (
    <StatusAlert variant={message.type} className={className} onDismiss={onDismiss}>
      {message.message}
    </StatusAlert>
  )
}
