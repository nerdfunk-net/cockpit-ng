'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { StatusAlert } from '@/components/shared/status-alert'
import { CsvFieldMappingPanel } from '@/components/features/nautobot/shared/csv/components/csv-field-mapping-panel'
import { LIVE_UPDATE_FIELDS } from '../constants'

interface MappingStepProps {
  headers: string[]
  fieldMapping: Record<string, string | null>
  onFieldMappingChange: (mapping: Record<string, string | null>) => void
  isMappingComplete: boolean
  canGoBack: boolean
  onBack: () => void
  onConfirm: () => void
  saveMappingForLater: boolean
  onSaveMappingForLaterChange: (value: boolean) => void
}

export function MappingStep({
  headers,
  fieldMapping,
  onFieldMappingChange,
  isMappingComplete,
  canGoBack,
  onBack,
  onConfirm,
  saveMappingForLater,
  onSaveMappingForLaterChange,
}: MappingStepProps) {
  return (
    <div className="space-y-4">
      <CsvFieldMappingPanel
        fields={LIVE_UPDATE_FIELDS}
        headers={headers}
        fieldMapping={fieldMapping}
        onFieldMappingChange={onFieldMappingChange}
      />

      {!isMappingComplete && (
        <StatusAlert variant="info">
          Map at least one column to <strong>Device Name</strong> to continue — it&apos;s
          used to filter devices and group interfaces per device.
        </StatusAlert>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="save-mapping-for-later"
          checked={saveMappingForLater}
          onCheckedChange={value => onSaveMappingForLaterChange(value === true)}
        />
        <Label htmlFor="save-mapping-for-later" className="text-sm text-muted-foreground">
          Save mapping for later use
        </Label>
      </div>

      <div className="flex items-center gap-2">
        {canGoBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={onConfirm} disabled={!isMappingComplete}>
          Continue
        </Button>
      </div>
    </div>
  )
}
