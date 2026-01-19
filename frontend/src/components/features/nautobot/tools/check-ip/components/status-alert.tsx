import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import type { StatusMessage } from '../types'

interface StatusAlertProps {
  message: StatusMessage
}

export function StatusAlert({ message }: StatusAlertProps) {
  const getAlertClassName = () => {
    switch (message.type) {
      case 'error':
        return 'border-red-500 bg-red-50'
      case 'success':
        return 'border-green-500 bg-green-50'
      case 'warning':
        return 'border-yellow-500 bg-yellow-50'
      case 'info':
        return 'border-blue-500 bg-blue-50'
      default:
        return 'border-blue-500 bg-blue-50'
    }
  }

  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  return (
    <Alert className={getAlertClassName()}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
          {getIcon()}
        </div>
        <AlertDescription className="font-mono text-xs">
          {message.message}
        </AlertDescription>
      </div>
    </Alert>
  )
}
