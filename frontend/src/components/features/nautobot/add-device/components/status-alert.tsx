'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { StatusMessage } from '../types'

interface StatusAlertProps {
  statusMessage: StatusMessage | null
}

export function StatusAlert({ statusMessage }: StatusAlertProps) {
  if (!statusMessage || statusMessage.type === 'error') return null

  return (
    <Alert className={statusMessage.type === 'success' ? 'border-green-500' : 'border-blue-500'}>
      <AlertDescription>{statusMessage.message}</AlertDescription>
    </Alert>
  )
}
