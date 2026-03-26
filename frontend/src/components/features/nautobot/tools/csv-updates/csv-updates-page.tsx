'use client'

import { FileSpreadsheet } from 'lucide-react'
import { CsvUpdateWizard } from './components/csv-update-wizard'

export default function CsvUpdatesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CSV Updates</h1>
            <p className="text-gray-600 mt-1">Update Nautobot objects in bulk by uploading a CSV file</p>
          </div>
        </div>
      </div>

      {/* Wizard */}
      <CsvUpdateWizard />
    </div>
  )
}
