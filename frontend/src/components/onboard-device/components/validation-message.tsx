'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react'
import type { StatusMessage } from '../types'

interface ValidationMessageProps {
  message: StatusMessage
  className?: string
  onDismiss?: () => void
}

export function ValidationMessage({ message, className = '', onDismiss }: ValidationMessageProps) {
  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getAlertClass = () => {
    switch (message.type) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800'
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800'
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800'
    }
  }

  return (
    <Alert className={`${getAlertClass()} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
          <AlertDescription className="flex-1">{message.message}</AlertDescription>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 hover:bg-black/10 text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  )
}
