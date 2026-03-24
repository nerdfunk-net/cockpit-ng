'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  Play,
  Search,
} from 'lucide-react'
import type { CSVParseResult, ImportSummary, NautobotDropdownsResponse } from '../types'
import type { DeviceValidationError } from '../types'
import type {
  CsvImportStep,
  CsvImportFormat,
  FormDefaults,
  PrefixConfig,
} from '../hooks/use-csv-import'
import { CSVFileUpload } from './csv-file-upload'
import { CsvImportMappingStep } from './csv-import-mapping-step'
import { CsvImportDefaultsStep } from './csv-import-defaults-step'
import { CsvImportPreviewStep } from './csv-import-preview-step'
import { CSVImportProgress } from './csv-import-progress'
import { CSVImportSummary } from './csv-import-summary'
import { CSVHelpDialog } from './csv-help-dialog'

const STEP_LABELS: Record<CsvImportStep, string> = {
  upload: 'Upload CSV',
  mapping: 'Column Mapping',
  defaults: 'Default Values',
  preview: 'Preview & Validate',
  importing: 'Importing...',
  summary: 'Results',
}

const STEP_ORDER: CsvImportStep[] = ['upload', 'mapping', 'defaults', 'preview']

interface CsvImportWizardProps {
  open: boolean
  onClose: () => void
  step: CsvImportStep

  // Upload
  csvFile: File | null
  isParsing: boolean
  parseError: string
  delimiter: string
  onDelimiterChange: (value: string) => void
  importFormat: CsvImportFormat
  onImportFormatChange: (format: CsvImportFormat) => void
  onFileSelect: (file: File) => void

  // Mapping
  headers: string[]
  columnMapping: Record<string, string | null>
  onMappingChange: (mapping: Record<string, string | null>) => void
  unmappedMandatoryFields: readonly string[]
  unmappedMandatoryInterfaceFields: readonly string[]

  // Defaults
  defaults: Record<string, string>
  onDefaultsChange: (defaults: Record<string, string>) => void
  formDefaults: FormDefaults
  dropdownData: NautobotDropdownsResponse
  prefixConfig: PrefixConfig
  onPrefixConfigChange: (config: PrefixConfig) => void
  applyFormTags: boolean
  onApplyFormTagsChange: (val: boolean) => void
  applyFormCustomFields: boolean
  onApplyFormCustomFieldsChange: (val: boolean) => void

  // Preview
  parseResult: CSVParseResult | null
  dryRunErrors: DeviceValidationError[]
  isDryRun: boolean
  dryRunCompleted: boolean
  onDryRun: () => void

  // Import
  importProgress: { current: number; total: number }
  importSummary: ImportSummary | null
  onImport: () => void

  // Navigation
  onGoToStep: (step: CsvImportStep) => void
  onReset: () => void
}

export function CsvImportWizard({
  open,
  onClose,
  step,
  csvFile,
  isParsing,
  parseError,
  delimiter,
  onDelimiterChange,
  importFormat,
  onImportFormatChange,
  onFileSelect,
  headers,
  columnMapping,
  onMappingChange,
  unmappedMandatoryFields,
  unmappedMandatoryInterfaceFields,
  defaults,
  onDefaultsChange,
  formDefaults,
  dropdownData,
  prefixConfig,
  onPrefixConfigChange,
  applyFormTags,
  onApplyFormTagsChange,
  applyFormCustomFields,
  onApplyFormCustomFieldsChange,
  parseResult,
  dryRunErrors,
  isDryRun,
  dryRunCompleted,
  onDryRun,
  importProgress,
  importSummary,
  onImport,
  onGoToStep,
  onReset,
}: CsvImportWizardProps) {
  const [showHelp, setShowHelp] = useState(false)

  const currentStepIndex = STEP_ORDER.indexOf(step)
  const canGoBack = currentStepIndex > 0 && step !== 'importing' && step !== 'summary'
  const canGoNext =
    currentStepIndex >= 0 &&
    currentStepIndex < STEP_ORDER.length - 1 &&
    step !== 'importing' &&
    step !== 'summary'

  const errorCount =
    parseResult?.validationErrors.filter(e => e.severity === 'error').length || 0

  const handleBack = () => {
    if (canGoBack) {
      onGoToStep(STEP_ORDER[currentStepIndex - 1]!)
    }
  }

  const handleNext = () => {
    if (canGoNext) {
      onGoToStep(STEP_ORDER[currentStepIndex + 1]!)
    }
  }

  // Determine if "Next" should be enabled
  const isNextEnabled = (() => {
    switch (step) {
      case 'upload':
        return headers.length > 0 && !isParsing
      case 'mapping': {
        // Must have at least a "name" column mapped
        const hasName = Object.values(columnMapping).some(v => v === 'name')
        return hasName
      }
      case 'defaults':
        return true // Defaults are optional (will be validated in preview)
      default:
        return false
    }
  })()

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="max-w-[900px] sm:!max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Devices from CSV
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(true)}
              className="h-8 w-8 p-0"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Upload a CSV file, configure column mapping, set defaults for missing
            fields, then import.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        {step !== 'importing' && step !== 'summary' && (
          <div className="flex items-center gap-1 px-1">
            {STEP_ORDER.map((s, i) => {
              const isActive = s === step
              const isPast = i < currentStepIndex
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isPast
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={`text-xs truncate ${
                      isActive ? 'text-blue-600 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                  {i < STEP_ORDER.length - 1 && (
                    <div
                      className={`flex-1 h-px ${isPast ? 'bg-blue-200' : 'bg-gray-200'}`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Step Content */}
        <div className="py-2 min-h-[200px]">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-4">
              <CSVFileUpload
                csvFile={csvFile}
                isParsing={isParsing}
                isImporting={false}
                parseError={parseError}
                onFileSelect={onFileSelect}
              />
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">
                    Import Format
                  </Label>
                  <Select
                    value={importFormat}
                    onValueChange={v => onImportFormatChange(v as CsvImportFormat)}
                  >
                    <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generic">Generic</SelectItem>
                      <SelectItem value="nautobot">Nautobot Export</SelectItem>
                      <SelectItem value="cockpit">Cockpit Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Delimiter</Label>
                  <Input
                    className="h-8 text-sm bg-white border-gray-300 shadow-sm w-20"
                    value={delimiter}
                    onChange={e => onDelimiterChange(e.target.value)}
                    placeholder=","
                    maxLength={5}
                  />
                </div>
                {headers.length > 0 && (
                  <div className="mt-5">
                    <Badge variant="secondary" className="text-xs">
                      {headers.length} columns detected
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <CsvImportMappingStep
              headers={headers}
              columnMapping={columnMapping}
              onMappingChange={onMappingChange}
            />
          )}

          {/* Defaults Step */}
          {step === 'defaults' && (
            <CsvImportDefaultsStep
              unmappedFields={unmappedMandatoryFields}
              unmappedInterfaceFields={unmappedMandatoryInterfaceFields}
              defaults={defaults}
              onDefaultsChange={onDefaultsChange}
              formDefaults={formDefaults}
              dropdownData={dropdownData}
              prefixConfig={prefixConfig}
              onPrefixConfigChange={onPrefixConfigChange}
              applyFormTags={applyFormTags}
              onApplyFormTagsChange={onApplyFormTagsChange}
              applyFormCustomFields={applyFormCustomFields}
              onApplyFormCustomFieldsChange={onApplyFormCustomFieldsChange}
            />
          )}

          {/* Preview Step */}
          {step === 'preview' && parseResult && (
            <CsvImportPreviewStep
              parseResult={parseResult}
              dryRunErrors={dryRunErrors}
              isDryRun={isDryRun}
              dryRunCompleted={dryRunCompleted}
              dropdownData={dropdownData}
            />
          )}

          {/* Importing */}
          {step === 'importing' && (
            <CSVImportProgress
              current={importProgress.current}
              total={importProgress.total}
            />
          )}

          {/* Summary */}
          {step === 'summary' && importSummary && (
            <CSVImportSummary importSummary={importSummary} />
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2">
          {step === 'summary' ? (
            <>
              <Button variant="outline" onClick={onReset}>
                Import Another File
              </Button>
              <Button onClick={onClose}>Close</Button>
            </>
          ) : step === 'importing' ? (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>

              {canGoBack && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}

              {step === 'preview' ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onDryRun} disabled={isDryRun}>
                    <Search className="h-4 w-4 mr-1" />
                    {isDryRun ? 'Validating...' : 'Dry Run'}
                  </Button>
                  <Button
                    onClick={onImport}
                    disabled={
                      errorCount > 0 || !parseResult || parseResult.devices.length === 0
                    }
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Import {parseResult?.devices.length || 0} Device(s)
                  </Button>
                </div>
              ) : (
                <Button onClick={handleNext} disabled={!isNextEnabled}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <CSVHelpDialog open={showHelp} onClose={() => setShowHelp(false)} />
    </Dialog>
  )
}
