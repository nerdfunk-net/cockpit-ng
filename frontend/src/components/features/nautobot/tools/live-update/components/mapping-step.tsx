'use client'

import { Button } from '@/components/ui/button'
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
}

export function MappingStep({
  headers,
  fieldMapping,
  onFieldMappingChange,
  isMappingComplete,
  canGoBack,
  onBack,
  onConfirm,
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
