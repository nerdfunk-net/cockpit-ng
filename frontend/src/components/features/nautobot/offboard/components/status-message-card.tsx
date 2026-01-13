import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import type { StatusMessage } from '@/types/features/nautobot/offboard'

interface StatusMessageCardProps {
  message: StatusMessage
  onDismiss: () => void
}

export function StatusMessageCard({ message, onDismiss }: StatusMessageCardProps) {
  return (
    <Alert className={`${message.type === 'error' ? 'border-red-500 bg-red-50' :
      message.type === 'success' ? 'border-green-500 bg-green-50' :
        message.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
          'border-blue-500 bg-blue-50'
      }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          {message.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
          {message.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />}
          {message.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />}
          {message.type === 'info' && <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
          <AlertDescription className="text-sm">
            {message.message}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  )
}
