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
    <Alert className={
      message.type === 'error' ? 'status-error' :
      message.type === 'success' ? 'status-success' :
      message.type === 'warning' ? 'status-warning' :
      'status-info'
    }>
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
