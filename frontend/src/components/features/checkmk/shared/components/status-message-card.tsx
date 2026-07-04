import { StatusAlert } from '@/components/shared/status-alert'
import type { StatusMessage } from '../types'

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
      <StatusAlert
        variant={message.type}
        onDismiss={onDismiss}
        className="min-w-[400px] max-w-[600px] shadow-lg"
      >
        {message.text}
      </StatusAlert>
    </div>
  )
}
