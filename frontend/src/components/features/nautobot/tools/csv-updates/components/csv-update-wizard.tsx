'use client'

import { useState, useCallback, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Search, Play, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCsvWizard, WIZARD_STEP_ORDER } from '../hooks/use-csv-wizard'
import type { WizardStep } from '../hooks/use-csv-wizard'
import { useCsvUpdatesMutations } from '@/hooks/queries/use-csv-updates-mutations'
import { CsvUploadStep } from './csv-upload-step'
import { CsvConfigureStep } from './csv-configure-step'
import { CsvPropertiesStep } from './csv-properties-step'
import { CsvPreviewStep } from './csv-preview-step'
import { CsvProcessingStep } from './csv-processing-step'
import { CsvSummaryStep } from './csv-summary-step'

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload CSV',
  configure: 'Configure',
  properties: 'Properties',
  preview: 'Preview & Validate',
  processing: 'Processing',
  summary: 'Results',
}

const INDICATOR_STEPS: WizardStep[] = ['upload', 'configure', 'properties', 'preview']

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
    matchingStrategy,
    setMatchingStrategy,
    defaultProperties,
    setDefaultProperties,
    nameTransform,
    setNameTransform,
    rackLocationColumn,
    setRackLocationColumn,
    selectedColumns,
    columnMappingForBackend,
    taskId,
    setTaskId,
    jobId,
    setJobId,
    dryRunTaskId,
    setDryRunTaskId,
  } = wizard

  const { parsedData, validationResults, validationSummary, csvConfig } = csvUpload

  /** True when the 'rack' Nautobot field is mapped to any CSV column. */
  const isRackMapped = useMemo(
    () => Object.values(fieldMapping).includes('rack'),
    [fieldMapping]
  )

  /** Values from the primary-key column — fed into the name transform try-out preview. */
  const csvNameValues = useMemo(() => {
    const idx = parsedData.headers.indexOf(primaryKeyColumn)
    if (idx === -1) return []
    return parsedData.rows.map(row => row[idx] ?? '').filter(Boolean)
  }, [parsedData, primaryKeyColumn])

  /**
   * Enrich parsed CSV data with default properties:
   * For each default property whose field is NOT already a CSV column,
   * inject a synthetic column with the constant value into every row.
   */
  const enrichedCsvData = useMemo(() => {
    const validDefaults = defaultProperties.filter(dp => dp.field && dp.value)
    if (validDefaults.length === 0) return parsedData

    const existingHeaders = new Set(parsedData.headers)
    const toInject = validDefaults.filter(dp => !existingHeaders.has(dp.field))
    if (toInject.length === 0) return parsedData

    return {
      headers: [...parsedData.headers, ...toInject.map(dp => dp.field)],
      rows: parsedData.rows.map(row => [...row, ...toInject.map(dp => dp.value)]),
      rowCount: parsedData.rowCount,
    }
  }, [parsedData, defaultProperties])

  /** Extend column mapping with injected default columns. */
  const enrichedColumnMapping = useMemo(() => {
    const base = { ...columnMappingForBackend }
    const existingHeaders = new Set(parsedData.headers)
    for (const dp of defaultProperties) {
      if (dp.field && dp.value && !existingHeaders.has(dp.field)) {
        base[dp.field] = dp.field
      }
    }
    return base
  }, [columnMappingForBackend, defaultProperties, parsedData.headers])

  /** Extend selected columns with injected default columns. */
  const enrichedSelectedColumns = useMemo(() => {
    const base = [...selectedColumns]
    const existingHeaders = new Set(parsedData.headers)
    for (const dp of defaultProperties) {
      if (
        dp.field &&
        dp.value &&
        !existingHeaders.has(dp.field) &&
        !base.includes(dp.field)
      ) {
        base.push(dp.field)
      }
    }
    return base
  }, [selectedColumns, defaultProperties, parsedData.headers])

  const handleDryRun = useCallback(async () => {
    try {
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: enrichedCsvData.headers, rows: enrichedCsvData.rows },
        csvOptions: csvConfig,
        dryRun: true,
        tagsMode,
        columnMapping: enrichedColumnMapping,
        selectedColumns: enrichedSelectedColumns,
        primaryKeyColumn,
        matchingStrategy,
        nameTransform,
        rackLocationColumn,
      })
      setDryRunTaskId(response.task_id)
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    processUpdates,
    objectType,
    enrichedCsvData,
    csvConfig,
    tagsMode,
    enrichedColumnMapping,
    enrichedSelectedColumns,
    primaryKeyColumn,
    matchingStrategy,
    nameTransform,
    rackLocationColumn,
    setDryRunTaskId,
  ])

  const handleSubmit = useCallback(async () => {
    try {
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: enrichedCsvData.headers, rows: enrichedCsvData.rows },
        csvOptions: csvConfig,
        dryRun: false,
        tagsMode,
        columnMapping: enrichedColumnMapping,
        selectedColumns: enrichedSelectedColumns,
        primaryKeyColumn,
        matchingStrategy,
        nameTransform,
        rackLocationColumn,
      })
      setTaskId(response.task_id)
      if (response.job_id) setJobId(parseInt(response.job_id, 10))
      goToStep('processing')
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    processUpdates,
    objectType,
    enrichedCsvData,
    csvConfig,
    tagsMode,
    enrichedColumnMapping,
    enrichedSelectedColumns,
    primaryKeyColumn,
    matchingStrategy,
    nameTransform,
    rackLocationColumn,
    setTaskId,
    setJobId,
    goToStep,
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
      case 'upload':
        return parsedData.rowCount > 0 && !csvUpload.isParsing
      case 'configure':
        return primaryKeyColumn.length > 0
      case 'properties':
        return true
      case 'preview':
        return false
      default:
        return false
    }
  })()

  const canGoBack =
    !isProcessingOrSummary &&
    currentStepIndex > 0 &&
    currentStepIndex <= INDICATOR_STEPS.length - 1

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <span className="text-sm font-medium">CSV Update Wizard</span>
        </div>
        <div className="text-xs text-blue-100">
          Follow the steps to configure and submit your CSV update
        </div>
      </div>

      {/* Content */}
      <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
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

          {step === 'properties' && (
            <CsvPropertiesStep
              objectType={objectType}
              primaryKeyColumn={primaryKeyColumn}
              matchingStrategy={matchingStrategy}
              onMatchingStrategyChange={setMatchingStrategy}
              defaultProperties={defaultProperties}
              onDefaultPropertiesChange={setDefaultProperties}
              nameTransform={nameTransform}
              onNameTransformChange={setNameTransform}
              csvNameValues={csvNameValues}
              isRackMapped={isRackMapped}
              csvHeaders={parsedData.headers}
              rackLocationColumn={rackLocationColumn}
              onRackLocationColumnChange={setRackLocationColumn}
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
              jobId={jobId}
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
                    disabled={
                      processUpdates.isPending || validationSummary.errorCount > 0
                    }
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
                    Submit{' '}
                    {parsedData.rowCount > 0 ? `(${parsedData.rowCount} rows)` : ''}
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
      </div>
    </div>
  )
}
