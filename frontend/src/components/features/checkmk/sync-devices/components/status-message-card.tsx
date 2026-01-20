import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { StatusMessage } from '@/types/features/checkmk/live-update'

interface StatusMessageCardProps {
  message: StatusMessage
  onDismiss: () => void
}

export function StatusMessageCard({ message, onDismiss }: StatusMessageCardProps) {
  // Don't show messages that include task indicators (handled by ActiveTasksPanel)
  if (message.text.includes('✓') || message.text.includes('✗')) {
    return null
  }

  return (
    <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <Card className={`min-w-[400px] max-w-[600px] shadow-lg ${
        message.type === 'error' ? 'border-red-500 bg-red-50' :
        'border-blue-500 bg-blue-50'
      }`}>
        <CardContent className="p-4">
          <div className={`flex items-start gap-3 ${
            message.type === 'error' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            <div className="flex-shrink-0 mt-0.5">
              {message.type === 'error' && <X className="h-5 w-5" />}
              {message.type === 'info' && <span className="text-lg">ℹ</span>}
            </div>
            <span className="flex-1 text-sm font-medium break-words">{message.text}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="ml-2 h-6 w-6 p-0 flex-shrink-0 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
