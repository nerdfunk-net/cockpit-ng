'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Play,
  Zap,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCsvWizard } from '../hooks/use-csv-wizard'
import type { WizardStep } from '../hooks/use-csv-wizard'
import { useCsvUpdatesMutations } from '@/hooks/queries/use-csv-updates-mutations'
import { useDeviceUpdatesMutations } from '@/hooks/queries/use-device-updates-mutations'
import { buildDeviceUpdatePayloads, applyDeviceDefaults } from '../utils/device-merge'
import { EMPTY_PARSED_DATA } from '../constants'
import { CsvSourceStep } from './csv-source-step'
import { CsvConfigureStep } from './csv-configure-step'
import { CsvPropertiesStep } from './csv-properties-step'
import { CsvFilterStep } from './csv-filter-step'
import { CheckDevicesDialog } from './check-devices-dialog'
import { CsvPreviewStep } from './csv-preview-step'
import { CsvProcessingStep } from './csv-processing-step'
import { CsvSummaryStep } from './csv-summary-step'
import type { ParsedCSVData, ValidationResult } from '../types'

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'CSV Source',
  configure: 'Configure',
  properties: 'Properties',
  filter: 'Filter',
  preview: 'Preview & Validate',
  processing: 'Processing',
  summary: 'Results',
}

const BASE_INDICATOR_STEPS: WizardStep[] = [
  'upload',
  'configure',
  'properties',
  'filter',
  'preview',
]

const EMPTY_VALIDATION_RESULTS: ValidationResult[] = []
const VALID_SUMMARY = {
  errorCount: 0,
  warningCount: 0,
  successCount: 0,
  hasErrors: false,
  isValid: true,
}

export function CsvUpdateWizard() {
  const wizard = useCsvWizard()
  const { processUpdates } = useCsvUpdatesMutations()
  const { processDeviceUpdates } = useDeviceUpdatesMutations()

  const [completedStatus, setCompletedStatus] = useState<string>('')
  const [completedResult, setCompletedResult] = useState<unknown>(null)
  const [completedError, setCompletedError] = useState<string | undefined>(undefined)
  const [checkDevicesOpen, setCheckDevicesOpen] = useState(false)

  const {
    step,
    canGoBack,
    goBack,
    goToStep,
    advanceFromUpload,
    confirmConfigure,
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
    effectiveDefaultProperties,
    nameTransform,
    setNameTransform,
    rackLocationColumn,
    setRackLocationColumn,
    selectedColumns,
    columnMappingForBackend,
    useNewMapping,
    setUseNewMapping,
    useDefaultProperties,
    setUseDefaultProperties,
    primaryIpEnabled,
    setPrimaryIpEnabled,
    configureSkippable,
    profiles,
    selectedProfileId,
    setSelectedProfileId,
    selectedDeviceRows,
    filteredRows,
    paginatedRows,
    filterPagination,
    handleFilterPageChange,
    handleFilterPageSizeChange,
    rowFilter,
    setRowFilter,
    isRowSelected,
    toggleRowSelected,
    toggleSelectAllVisible,
    selectedCount,
    primaryIpByDevice,
    setPrimaryIp,
    selectedParsedData,
    taskId,
    setTaskId,
    jobId,
    setJobId,
    dryRunTaskId,
    setDryRunTaskId,
  } = wizard

  const { parsedData, validationResults, validationSummary, csvConfig } = csvUpload
  const isDevices = objectType === 'devices'

  /** Unique device names among the currently selected rows, for the "Check Devices" dialog. */
  const uniqueSelectedDeviceNames = useMemo(
    () => Array.from(new Set(selectedDeviceRows.map(r => r.deviceName).filter(Boolean))),
    [selectedDeviceRows]
  )

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

  /** Synthetic preview table for the devices JSON submission path. */
  const devicePreviewData = useMemo<ParsedCSVData>(() => {
    if (!isDevices) return EMPTY_PARSED_DATA
    const payloads = buildDeviceUpdatePayloads(selectedDeviceRows, primaryIpByDevice).map(
      p => applyDeviceDefaults(p, effectiveDefaultProperties)
    )
    const headerSet = new Set<string>(['name'])
    for (const payload of payloads) {
      for (const key of Object.keys(payload)) {
        if (key === 'interfaces') continue
        headerSet.add(key)
      }
    }
    const headers = Array.from(headerSet)
    const rows = payloads.map(payload => [
      ...headers.map(h => String(payload[h] ?? '')),
      `${payload.interfaces.length} interface(s)`,
    ])
    return { headers: [...headers, 'interfaces'], rows, rowCount: rows.length }
  }, [isDevices, selectedDeviceRows, primaryIpByDevice, effectiveDefaultProperties])

  const handleDryRun = useCallback(async () => {
    try {
      if (isDevices) {
        const payloads = buildDeviceUpdatePayloads(
          selectedDeviceRows,
          primaryIpByDevice
        ).map(p => applyDeviceDefaults(p, effectiveDefaultProperties))
        const response = await processDeviceUpdates.mutateAsync({
          devices: payloads,
          dryRun: true,
        })
        setDryRunTaskId(response.task_id)
        return
      }

      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: selectedParsedData.headers, rows: selectedParsedData.rows },
        csvOptions: csvConfig,
        dryRun: true,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
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
    isDevices,
    selectedDeviceRows,
    primaryIpByDevice,
    effectiveDefaultProperties,
    processDeviceUpdates,
    processUpdates,
    objectType,
    selectedParsedData,
    csvConfig,
    tagsMode,
    columnMappingForBackend,
    selectedColumns,
    primaryKeyColumn,
    matchingStrategy,
    nameTransform,
    rackLocationColumn,
    setDryRunTaskId,
  ])

  const handleSubmit = useCallback(async () => {
    try {
      if (isDevices) {
        const payloads = buildDeviceUpdatePayloads(
          selectedDeviceRows,
          primaryIpByDevice
        ).map(p => applyDeviceDefaults(p, effectiveDefaultProperties))
        const response = await processDeviceUpdates.mutateAsync({
          devices: payloads,
          dryRun: false,
        })
        setTaskId(response.task_id)
        if (response.job_id) setJobId(parseInt(response.job_id, 10))
        goToStep('processing')
        return
      }

      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: selectedParsedData.headers, rows: selectedParsedData.rows },
        csvOptions: csvConfig,
        dryRun: false,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
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
    isDevices,
    selectedDeviceRows,
    primaryIpByDevice,
    effectiveDefaultProperties,
    processDeviceUpdates,
    processUpdates,
    objectType,
    selectedParsedData,
    csvConfig,
    tagsMode,
    columnMappingForBackend,
    selectedColumns,
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

  const isProcessingOrSummary = step === 'processing' || step === 'summary'

  const visibleIndicatorSteps = useMemo(
    () =>
      BASE_INDICATOR_STEPS.filter(s => {
        if (s === 'configure' && configureSkippable) return false
        if (s === 'properties' && useDefaultProperties) return false
        return true
      }),
    [configureSkippable, useDefaultProperties]
  )

  const handleNext = useCallback(() => {
    switch (step) {
      case 'upload':
        advanceFromUpload()
        break
      case 'configure':
        confirmConfigure()
        break
      case 'properties':
        goToStep('filter')
        break
      case 'filter':
        goToStep('preview')
        break
      default:
        break
    }
  }, [step, advanceFromUpload, confirmConfigure, goToStep])

  const isNextEnabled = (() => {
    switch (step) {
      case 'upload':
        return parsedData.rowCount > 0 && !csvUpload.isParsing
      case 'configure':
        return primaryKeyColumn.length > 0
      case 'properties':
        return true
      case 'filter':
        return selectedCount > 0
      case 'preview':
        return false
      default:
        return false
    }
  })()

  const submitDisabled = isDevices
    ? processDeviceUpdates.isPending || selectedDeviceRows.length === 0
    : processUpdates.isPending ||
      validationSummary.errorCount > 0 ||
      selectedParsedData.rowCount === 0

  const dryRunDisabled = isDevices
    ? processDeviceUpdates.isPending || selectedDeviceRows.length === 0
    : processUpdates.isPending || validationSummary.errorCount > 0

  const isSubmitPending = isDevices ? processDeviceUpdates.isPending : processUpdates.isPending

  const submitCountLabel = isDevices
    ? selectedDeviceRows.length > 0
      ? `(${selectedCount} devices)`
      : ''
    : selectedParsedData.rowCount > 0
      ? `(${selectedParsedData.rowCount} rows)`
      : ''

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      {/* Gradient header */}
      <div className="panel-header py-2 px-4 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <span className="text-sm font-medium">CSV Update Wizard</span>
        </div>
        <div className="text-xs text-panel-header-muted">
          Follow the steps to configure and submit your CSV update
        </div>
      </div>

      {/* Content */}
      <div className="p-6 panel-content space-y-6">
        {/* Step Indicator */}
        {!isProcessingOrSummary && (
          <div className="flex items-center gap-1">
            {visibleIndicatorSteps.map((s, i) => {
              const isActive = s === step
              const isPast = visibleIndicatorSteps.indexOf(step) > i
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0 ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isPast
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={`text-xs truncate ${
                      isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                  {i < visibleIndicatorSteps.length - 1 && (
                    <div
                      className={`flex-1 h-px ${isPast ? 'bg-success' : 'bg-border'}`}
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
            <CsvSourceStep
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
              onAgentDataParsed={csvUpload.handleAgentDataParsed}
              useNewMapping={useNewMapping}
              onUseNewMappingChange={setUseNewMapping}
              useDefaultProperties={useDefaultProperties}
              onUseDefaultPropertiesChange={setUseDefaultProperties}
              primaryIpEnabled={primaryIpEnabled}
              onPrimaryIpEnabledChange={setPrimaryIpEnabled}
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onProfileChange={setSelectedProfileId}
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

          {step === 'filter' && (
            <CsvFilterStep
              objectType={objectType}
              fieldMapping={fieldMapping}
              primaryKeyColumn={primaryKeyColumn}
              filteredRows={filteredRows}
              paginatedRows={paginatedRows}
              pagination={filterPagination}
              onPageChange={handleFilterPageChange}
              onPageSizeChange={handleFilterPageSizeChange}
              rowFilter={rowFilter}
              onRowFilterChange={setRowFilter}
              isRowSelected={isRowSelected}
              toggleRowSelected={toggleRowSelected}
              toggleSelectAllVisible={toggleSelectAllVisible}
              primaryIpEnabled={primaryIpEnabled}
              primaryIpByDevice={primaryIpByDevice}
              onSetPrimaryIp={setPrimaryIp}
            />
          )}

          {step === 'preview' && (
            <CsvPreviewStep
              parsedData={isDevices ? devicePreviewData : selectedParsedData}
              validationResults={isDevices ? EMPTY_VALIDATION_RESULTS : validationResults}
              validationSummary={isDevices ? VALID_SUMMARY : validationSummary}
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
                    disabled={dryRunDisabled}
                  >
                    <Search className="h-4 w-4 mr-1" />
                    {isSubmitPending && !taskId ? 'Running…' : 'Dry Run'}
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={submitDisabled}>
                    <Play className="h-4 w-4 mr-1" />
                    Submit {submitCountLabel}
                  </Button>
                </>
              ) : step === 'filter' ? (
                <>
                  {isDevices && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCheckDevicesOpen(true)}
                      disabled={selectedDeviceRows.length === 0}
                    >
                      <ShieldCheck className="h-4 w-4 mr-1" />
                      Check Devices
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={submitDisabled}
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Submit Now {submitCountLabel}
                  </Button>
                  <Button size="sm" onClick={handleNext} disabled={!isNextEnabled}>
                    Review First
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={handleNext} disabled={!isNextEnabled}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <CheckDevicesDialog
        open={checkDevicesOpen}
        onOpenChange={setCheckDevicesOpen}
        deviceNames={uniqueSelectedDeviceNames}
        selectedDeviceRows={selectedDeviceRows}
        primaryIpByDevice={primaryIpByDevice}
        profileId={selectedProfileId}
      />
    </div>
  )
}
