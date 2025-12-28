import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface TestResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  testResult: string
}

export function TestResultDialog({ open, onOpenChange, testResult }: TestResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Template Test Result</DialogTitle>
          <DialogDescription>
            Rendered template output for the selected device
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rendered Commands</Label>
            <Textarea
              value={testResult}
              readOnly
              rows={20}
              className="font-mono text-sm border-2 border-slate-300 bg-gray-50 resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
