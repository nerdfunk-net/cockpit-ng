'use client'

import { RefreshCw, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SyncFormFooterProps {
  isSyncing: boolean
  onCancel: () => void
  onValidate: () => void
}

export function SyncFormFooter({ isSyncing, onCancel, onValidate }: SyncFormFooterProps) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSyncing}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={onValidate}
        className="min-w-[120px] hover:bg-blue-100 hover:border-blue-400 active:scale-95 transition-all cursor-pointer"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        Validate
      </Button>
      <Button
        type="submit"
        disabled={isSyncing}
        className="min-w-[140px]"
      >
        {isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync to Nautobot
          </>
        )}
      </Button>
    </div>
  )
}
