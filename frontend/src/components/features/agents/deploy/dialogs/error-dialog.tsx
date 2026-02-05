import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle } from 'lucide-react'

interface ErrorDialogProps {
  show: boolean
  onClose: () => void
  title: string
  message: string
  details?: string[]
}

export function ErrorDialog({
  show,
  onClose,
  title,
  message,
  details
}: ErrorDialogProps) {
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {title}
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        {details && details.length > 0 && (
          <ScrollArea className="max-h-[400px] rounded-md border p-4">
            <ul className="space-y-2 list-none">
              {details.map((detail) => (
                <li key={detail} className="text-sm">
                  {detail}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
