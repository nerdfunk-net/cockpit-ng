import { StatusAlert } from '@/components/shared/status-alert'
import type { StatusMessage } from '@/types/features/nautobot/offboard'

interface StatusMessageCardProps {
  message: StatusMessage
  onDismiss: () => void
}

export function StatusMessageCard({ message, onDismiss }: StatusMessageCardProps) {
  return (
    <StatusAlert variant={message.type} onDismiss={onDismiss}>
      {message.message}
    </StatusAlert>
  )
}
