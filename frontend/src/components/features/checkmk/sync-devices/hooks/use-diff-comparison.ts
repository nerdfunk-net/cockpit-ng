import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type { Device, DiffResult } from '@/types/features/checkmk/live-update'
import { renderConfigComparison } from '@/utils/features/checkmk/live-update/diff-helpers'

interface UseDiffComparisonProps {
  showMessage: (text: string, type: 'success' | 'error' | 'info') => void
}

export function useDiffComparison({ showMessage }: UseDiffComparisonProps) {
  const { apiCall } = useApi()
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [deviceDiffResults, setDeviceDiffResults] = useState<Record<string, 'equal' | 'diff' | 'host_not_found'>>({})

  const getDiff = useCallback(async (device: Device) => {
    try {
      setLoadingDiff(true)

      const response = await apiCall<DiffResult['differences']>(`nb2cmk/device/${device.id}/compare`)

      if (response) {
        const diffData = {
          device_id: device.id,
          device_name: device.name,
          differences: response,
          timestamp: new Date().toISOString()
        }
        setDiffResult(diffData)

        // Store the result for table row coloring
        setDeviceDiffResults(prev => ({
          ...prev,
          [device.id]: response.result
        }))

        return diffData
      } else {
        showMessage(`No diff data available for ${device.name}`, 'info')
        return null
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get diff'
      showMessage(`Failed to get diff for ${device.name}: ${message}`, 'error')
      throw err
    } finally {
      setLoadingDiff(false)
    }
  }, [apiCall, showMessage])

  const parseConfigComparison = useCallback((diffResult: DiffResult) => {
    return renderConfigComparison(
      diffResult.differences.normalized_config,
      diffResult.differences.checkmk_config,
      diffResult.differences.ignored_attributes
    )
  }, [])

  return {
    diffResult,
    loadingDiff,
    deviceDiffResults,
    getDiff,
    parseConfigComparison,
    setDiffResult
  }
}
