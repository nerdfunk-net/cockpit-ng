'use client'

import { Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface ImportPositionsStepPropertiesProps {
  clearRackBeforeImport: boolean
  onClearRackBeforeImportChange: (value: boolean) => void
}

export function ImportPositionsStepProperties({
  clearRackBeforeImport,
  onClearRackBeforeImportChange,
}: ImportPositionsStepPropertiesProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="clear-rack"
            checked={clearRackBeforeImport}
            onCheckedChange={checked => onClearRackBeforeImportChange(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label
              htmlFor="clear-rack"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4 text-gray-500" />
              Clear rack before import
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, all devices are removed from the rack before the CSV data is
              applied. When disabled, CSV assignments are overlaid on top of the existing
              rack layout.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
