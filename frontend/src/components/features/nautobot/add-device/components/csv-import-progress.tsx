'use client'

import { Loader2 } from 'lucide-react'

interface CSVImportProgressProps {
  current: number
  total: number
}

export function CSVImportProgress({ current, total }: CSVImportProgressProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          Importing devices... ({current}/{total})
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
