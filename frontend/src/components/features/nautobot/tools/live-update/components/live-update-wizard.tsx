'use client'

import { useCallback, useMemo, useState } from 'react'
import { Zap } from 'lucide-react'
import { useDeviceUpdatesMutations } from '@/hooks/queries/use-device-updates-mutations'
import { CsvProcessingStep } from '@/components/features/nautobot/tools/csv-updates/components/csv-processing-step'
import { CsvSummaryStep } from '@/components/features/nautobot/tools/csv-updates/components/csv-summary-step'
import { useLiveUpdateWizard } from '../hooks/use-live-update-wizard'
import { buildDeviceUpdateJson } from '../utils/live-update-parser'
import { INDICATOR_STEPS, STEP_LABELS } from '../constants'
import { DataSourceStep } from './data-source-step'
import { KeySelectionStep } from './key-selection-step'
import { MappingStep } from './mapping-step'
import { DataTableStep } from './data-table-step'
import type { LiveUpdateStep } from '../types'

export function LiveUpdateWizard() {
  const wizard = useLiveUpdateWizard()
  const { processDeviceUpdates } = useDeviceUpdatesMutations()

  const [taskId, setTaskId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const [completedStatus, setCompletedStatus] = useState('')
  const [completedResult, setCompletedResult] = useState<unknown>(null)
  const [completedError, setCompletedError] = useState<string | undefined>(undefined)

  const isProcessingOrSummary = wizard.step === 'processing' || wizard.step === 'summary'

  const visibleSteps = useMemo<LiveUpdateStep[]>(() => {
    const showKeys =
      wizard.dataSourceMode === 'agent' && Object.keys(wizard.agentKeys ?? {}).length > 1
    return INDICATOR_STEPS.filter(step => step !== 'keys' || showKeys)
  }, [wizard.dataSourceMode, wizard.agentKeys])

  const currentIndex = visibleSteps.indexOf(wizard.step)

  const handleUpdateDevices = useCallback(async () => {
    const selectedRows = wizard.rows.filter(row => wizard.isRowSelected(row.id))
    const devices = buildDeviceUpdateJson(selectedRows, wizard.primaryIpByDevice)

    try {
      const response = await processDeviceUpdates.mutateAsync({ devices, dryRun: false })
      setTaskId(response.task_id)
      if (response.job_id) setJobId(parseInt(response.job_id, 10))
      wizard.goToStep('processing')
    } catch {
      // Error handled by the mutation's onError toast
    }
  }, [processDeviceUpdates, wizard])

  const handleProcessingComplete = useCallback(
    (status: string, result: unknown, error: string | undefined) => {
      setCompletedStatus(status)
      setCompletedResult(result)
      setCompletedError(error)
      wizard.goToStep('summary')
    },
    [wizard]
  )

  const handleReset = useCallback(() => {
    wizard.reset()
    setTaskId(null)
    setJobId(null)
    setCompletedStatus('')
    setCompletedResult(null)
    setCompletedError(undefined)
  }, [wizard])

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        {!isProcessingOrSummary ? (
          <div className="flex items-center gap-4">
            {visibleSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${
                    index <= currentIndex
                      ? 'bg-card/30'
                      : 'bg-card/10 text-panel-header-muted'
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-xs ${
                    index === currentIndex ? 'font-medium' : 'text-panel-header-muted'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
                {index < visibleSteps.length - 1 && (
                  <span className="text-panel-header-muted">→</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm font-medium">{STEP_LABELS[wizard.step]}</span>
        )}
        <Zap className="h-4 w-4" />
      </div>

      <div className="p-6 panel-content">
        {wizard.step === 'source' && (
          <DataSourceStep
            onCsvParsed={wizard.startCsvUpload}
            onAgentDataReceived={wizard.startAgentData}
            useNewMapping={wizard.useNewMapping}
            onUseNewMappingChange={wizard.setUseNewMapping}
          />
        )}

        {wizard.step === 'keys' && wizard.agentKeys && (
          <KeySelectionStep
            agentKeys={wizard.agentKeys}
            selectedKeys={wizard.selectedKeys}
            onSelectedKeysChange={wizard.setSelectedKeys}
            onBack={wizard.goBack}
            onConfirm={wizard.confirmKeySelection}
          />
        )}

        {wizard.step === 'mapping' && wizard.csvSource && (
          <MappingStep
            headers={wizard.csvSource.headers}
            fieldMapping={wizard.fieldMapping}
            onFieldMappingChange={wizard.setFieldMapping}
            isMappingComplete={wizard.isMappingComplete}
            canGoBack={wizard.canGoBack}
            onBack={wizard.goBack}
            onConfirm={wizard.confirmMapping}
            saveMappingForLater={wizard.saveMappingForLater}
            onSaveMappingForLaterChange={wizard.setSaveMappingForLater}
          />
        )}

        {wizard.step === 'table' && (
          <DataTableStep
            rows={wizard.rows}
            filteredRows={wizard.filteredRows}
            deviceFilter={wizard.deviceFilter}
            onDeviceFilterChange={wizard.setDeviceFilter}
            fieldMapping={wizard.fieldMapping}
            selectedDeviceCount={wizard.selectedDeviceCount}
            isRowSelected={wizard.isRowSelected}
            toggleRowSelected={wizard.toggleRowSelected}
            toggleSelectAllVisible={wizard.toggleSelectAllVisible}
            primaryIpByDevice={wizard.primaryIpByDevice}
            setPrimaryIp={wizard.setPrimaryIp}
            canGoBack={wizard.canGoBack}
            onBack={wizard.goBack}
            onUpdateDevices={handleUpdateDevices}
            isSubmitting={processDeviceUpdates.isPending}
          />
        )}

        {wizard.step === 'processing' && taskId && (
          <CsvProcessingStep taskId={taskId} onComplete={handleProcessingComplete} />
        )}

        {wizard.step === 'summary' && (
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
    </div>
  )
}
