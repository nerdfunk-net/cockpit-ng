'use client'

import { FileSpreadsheet } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { CsvUpdateWizard } from './components/csv-update-wizard'

export default function CsvUpdatesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip variant="success">
            <FileSpreadsheet className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">CSV Updates</h1>
            <p className="text-muted-foreground mt-1">
              Update Nautobot objects in bulk by uploading a CSV file
            </p>
          </div>
        </div>
      </div>

      {/* Wizard */}
      <CsvUpdateWizard />
    </div>
  )
}
