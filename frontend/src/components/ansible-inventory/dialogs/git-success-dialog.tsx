/**
 * Git Success Dialog Component
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GitBranch, CheckCircle2 } from 'lucide-react'
import type { GitPushResult } from '../types'

interface GitSuccessDialogProps {
  show: boolean
  onClose: () => void
  result: GitPushResult | null
}

export function GitSuccessDialog({ show, onClose, result }: GitSuccessDialogProps) {
  if (!result) return null

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            Successfully Pushed to Git
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              <span className="font-medium">Repository:</span>
              <span>{result.repository}</span>
            </div>
            <div className="text-sm text-gray-600">
              <div>Branch: {result.branch}</div>
              <div>File: {result.file}</div>
              <div>Devices: {result.device_count}</div>
              <div>Commit: {result.commit_message}</div>
            </div>
          </div>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
