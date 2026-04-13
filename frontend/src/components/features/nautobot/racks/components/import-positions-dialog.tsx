'use client'

import { useCallback } from 'react'
import { Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useImportPositions } from '../hooks/use-import-positions'
import { ImportPositionsStepUpload } from './import-positions-step-upload'
import { ImportPositionsStepMapping } from './import-positions-step-mapping'
import { ImportPositionsStepProperties } from './import-positions-step-properties'
import { ImportPositionsStepResolve } from './import-positions-step-resolve'
import type { RackMetadata, RackFaceAssignments, RackDevice, RackImportApplyPayload, MatchingStrategy, NameTransform } from '../types'
import type { LocationItem } from '../../add-device/types'

const STEPS = ['Upload', 'Map Columns', 'Properties', 'Confirm'] as const
type StepLabel = typeof STEPS[number]

const STEP_ORDER: Record<string, number> = { upload: 0, mapping: 1, properties: 2, resolve: 3 }

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((label: StepLabel, idx) => {
        const isActive = idx === currentStep
        const isDone = idx < currentStep
        return (
          <div key={label} className="flex items-center gap-1">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border-2 transition-colors ${
                isActive
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isDone
                    ? 'bg-blue-100 border-blue-400 text-blue-700'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
              }`}
            >
              {idx + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                isActive ? 'text-blue-700' : isDone ? 'text-blue-500' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-gray-300 mx-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface ImportPositionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLocationId: string
  rackMetadata: RackMetadata | null
  locations: LocationItem[]
  localFront: RackFaceAssignments
  localRear: RackFaceAssignments
  localUnpositioned: RackDevice[]
  matchingStrategy: MatchingStrategy
  onMatchingStrategyChange: (s: MatchingStrategy) => void
  nameTransform: NameTransform | null
  onNameTransformChange: (t: NameTransform | null) => void
  onApply: (payload: RackImportApplyPayload) => void
}

export function ImportPositionsDialog({
  open,
  onOpenChange,
  selectedLocationId,
  rackMetadata,
  locations,
  localFront,
  localRear,
  localUnpositioned,
  matchingStrategy,
  onMatchingStrategyChange,
  nameTransform,
  onNameTransformChange,
  onApply,
}: ImportPositionsDialogProps) {
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange])

  const wizard = useImportPositions({
    selectedLocationId,
    rackMetadata,
    locations,
    localFront,
    localRear,
    localUnpositioned,
    matchingStrategy,
    onMatchingStrategyChange,
    nameTransform,
    onNameTransformChange,
    onApply,
    onClose: handleClose,
  })

  const stepIndex = STEP_ORDER[wizard.step] ?? 0

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) wizard.reset()
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Positions from CSV</DialogTitle>
        </DialogHeader>

        <StepIndicator currentStep={stepIndex} />

        {wizard.step === 'upload' && (
          <ImportPositionsStepUpload
            csvFile={wizard.csvFile}
            csvConfig={wizard.csvConfig}
            parsedData={wizard.parsedData}
            isParsing={wizard.isParsing}
            onFileChange={wizard.handleFileChange}
            onConfigChange={wizard.handleConfigChange}
            onParseCSV={wizard.handleParseCSV}
            onClear={wizard.handleClear}
          />
        )}

        {wizard.step === 'mapping' && (
          <ImportPositionsStepMapping
            headers={wizard.parsedData.headers}
            deviceNameColumn={wizard.deviceNameColumn}
            onDeviceNameColumnChange={wizard.setDeviceNameColumn}
            fieldMapping={wizard.fieldMapping}
            onFieldMappingChange={wizard.setFieldMapping}
          />
        )}

        {wizard.step === 'properties' && (
          <ImportPositionsStepProperties
            clearRackBeforeImport={wizard.clearRackBeforeImport}
            onClearRackBeforeImportChange={wizard.setClearRackBeforeImport}
            matchingStrategy={wizard.matchingStrategy}
            onMatchingStrategyChange={wizard.onMatchingStrategyChange}
            nameTransform={wizard.nameTransform}
            onNameTransformChange={wizard.onNameTransformChange}
            csvNameValues={wizard.csvNameValues}
          />
        )}

        {wizard.step === 'resolve' && (
          <ImportPositionsStepResolve
            headers={wizard.parsedData.headers}
            locationColumn={wizard.locationColumn}
            onLocationColumnChange={wizard.setLocationColumn}
            previewMatchCount={wizard.previewMatchCount}
            rackName={wizard.rackName}
            locationName={wizard.selectedLocationName}
            isResolving={wizard.isResolving}
          />
        )}

        <DialogFooter className="flex items-center justify-between gap-2 mt-4 pt-4 border-t">
          <div>
            {wizard.step !== 'upload' && (
              <Button
                variant="outline"
                onClick={wizard.goBack}
                disabled={wizard.isResolving}
              >
                Back
              </Button>
            )}
          </div>
          <div>
            {wizard.step !== 'resolve' ? (
              <Button onClick={wizard.goNext} disabled={!wizard.canGoNext}>
                Next
              </Button>
            ) : (

              <Button
                onClick={wizard.handleFinish}
                disabled={!wizard.canFinish || wizard.isResolving}
                className="gap-2"
              >
                {wizard.isResolving && <Loader2 className="h-4 w-4 animate-spin" />}
                Import
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
