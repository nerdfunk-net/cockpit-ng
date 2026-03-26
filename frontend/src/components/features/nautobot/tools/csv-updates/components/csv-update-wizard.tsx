'use client'

import { useState, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Search, Play, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCsvWizard, WIZARD_STEP_ORDER } from '../hooks/use-csv-wizard'
import type { WizardStep } from '../hooks/use-csv-wizard'
import { useCsvUpdatesMutations } from '@/hooks/queries/use-csv-updates-mutations'
import { CsvUploadStep } from './csv-upload-step'
import { CsvConfigureStep } from './csv-configure-step'
import { CsvPreviewStep } from './csv-preview-step'
import { CsvProcessingStep } from './csv-processing-step'
import { CsvSummaryStep } from './csv-summary-step'

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload CSV',
  configure: 'Configure',
  preview: 'Preview & Validate',
  processing: 'Processing',
  summary: 'Results',
}

const INDICATOR_STEPS: WizardStep[] = ['upload', 'configure', 'preview']

export function CsvUpdateWizard() {
  const wizard = useCsvWizard()
  const { processUpdates } = useCsvUpdatesMutations()

  const [completedStatus, setCompletedStatus] = useState<string>('')
  const [completedResult, setCompletedResult] = useState<unknown>(null)
  const [completedError, setCompletedError] = useState<string | undefined>(undefined)

  const {
    step,
    goNext,
    goBack,
    goToStep,
    reset,
    csvUpload,
    objectType,
    handleObjectTypeChange,
    fieldMapping,
    setFieldMapping,
    primaryKeyColumn,
    setPrimaryKeyColumn,
    tagsMode,
    setTagsMode,
    selectedColumns,
    columnMappingForBackend,
    taskId,
    setTaskId,
    dryRunTaskId,
    setDryRunTaskId,
  } = wizard

  const { parsedData, validationResults, validationSummary, csvConfig } = csvUpload

  const handleDryRun = useCallback(async () => {
    try {
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: parsedData.headers, rows: parsedData.rows },
        csvOptions: csvConfig,
        dryRun: true,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
        primaryKeyColumn,
      })
      setDryRunTaskId(response.task_id)
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    processUpdates, objectType, parsedData, csvConfig,
    tagsMode, columnMappingForBackend, selectedColumns, primaryKeyColumn, setDryRunTaskId,
  ])

  const handleSubmit = useCallback(async () => {
    try {
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: parsedData.headers, rows: parsedData.rows },
        csvOptions: csvConfig,
        dryRun: false,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
        primaryKeyColumn,
      })
      setTaskId(response.task_id)
      goToStep('processing')
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    processUpdates, objectType, parsedData, csvConfig,
    tagsMode, columnMappingForBackend, selectedColumns, primaryKeyColumn, setTaskId, goToStep,
  ])

  const handleProcessingComplete = useCallback(
    (status: string, result: unknown, error: string | undefined) => {
      setCompletedStatus(status)
      setCompletedResult(result)
      setCompletedError(error)
      goToStep('summary')
    },
    [goToStep]
  )

  const handleReset = useCallback(() => {
    reset()
    setCompletedStatus('')
    setCompletedResult(null)
    setCompletedError(undefined)
  }, [reset])

  const currentStepIndex = WIZARD_STEP_ORDER.indexOf(step)
  const isProcessingOrSummary = step === 'processing' || step === 'summary'

  const isNextEnabled = (() => {
    switch (step) {
      case 'upload':    return parsedData.rowCount > 0 && !csvUpload.isParsing
      case 'configure': return primaryKeyColumn.length > 0
      case 'preview':   return false
      default:          return false
    }
  })()

  const canGoBack =
    !isProcessingOrSummary &&
    currentStepIndex > 0 &&
    currentStepIndex <= INDICATOR_STEPS.length - 1

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5" />
          Update Objects from CSV
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step Indicator */}
        {!isProcessingOrSummary && (
          <div className="flex items-center gap-1">
            {INDICATOR_STEPS.map((s, i) => {
              const isActive = s === step
              const isPast = INDICATOR_STEPS.indexOf(step) > i
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0 ${
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
                  {i < INDICATOR_STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${isPast ? 'bg-blue-200' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[300px]">
          {step === 'upload' && (
            <CsvUploadStep
              objectType={objectType}
              onObjectTypeChange={handleObjectTypeChange}
              csvConfig={csvConfig}
              onConfigChange={csvUpload.updateConfig}
              csvFile={csvUpload.csvFile}
              parsedData={parsedData}
              validationResults={validationResults}
              validationSummary={validationSummary}
              isParsing={csvUpload.isParsing}
              onFileChange={csvUpload.handleFileChange}
              onParseCSV={csvUpload.handleParseCSV}
              onClear={csvUpload.clearData}
            />
          )}

          {step === 'configure' && (
            <CsvConfigureStep
              objectType={objectType}
              headers={parsedData.headers}
              primaryKeyColumn={primaryKeyColumn}
              onPrimaryKeyColumnChange={setPrimaryKeyColumn}
              fieldMapping={fieldMapping}
              onFieldMappingChange={setFieldMapping}
              tagsMode={tagsMode}
              onTagsModeChange={setTagsMode}
            />
          )}

          {step === 'preview' && (
            <CsvPreviewStep
              parsedData={parsedData}
              validationResults={validationResults}
              validationSummary={validationSummary}
              dryRunTaskId={dryRunTaskId}
            />
          )}

          {step === 'processing' && taskId && (
            <CsvProcessingStep taskId={taskId} onComplete={handleProcessingComplete} />
          )}

          {step === 'summary' && (
            <CsvSummaryStep
              taskStatus={completedStatus}
              taskResult={completedResult}
              taskError={completedError}
              taskId={taskId}
              onReset={handleReset}
            />
          )}
        </div>

        {/* Navigation Footer */}
        {!isProcessingOrSummary && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              {canGoBack && (
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 'preview' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDryRun}
                    disabled={processUpdates.isPending || validationSummary.errorCount > 0}
                  >
                    <Search className="h-4 w-4 mr-1" />
                    {processUpdates.isPending && !taskId ? 'Running…' : 'Dry Run'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={
                      processUpdates.isPending ||
                      validationSummary.errorCount > 0 ||
                      parsedData.rowCount === 0
                    }
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Submit {parsedData.rowCount > 0 ? `(${parsedData.rowCount} rows)` : ''}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={goNext} disabled={!isNextEnabled}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
