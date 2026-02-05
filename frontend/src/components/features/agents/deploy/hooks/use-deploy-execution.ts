import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { DryRunResult, DeployResult, DeployExecutionSummary, DeployConfig } from '../types'

const EMPTY_DRY_RUN_RESULTS: DryRunResult[] = []
const EMPTY_DEPLOY_RESULTS: DeployResult[] = []

export function useDeployExecution() {
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  const [dryRunResults, setDryRunResults] = useState<DryRunResult[]>(EMPTY_DRY_RUN_RESULTS)
  const [deployResults, setDeployResults] = useState<DeployResult[]>(EMPTY_DEPLOY_RESULTS)
  const [showDryRunDialog, setShowDryRunDialog] = useState(false)
  const [showDeployResults, setShowDeployResults] = useState(false)

  const { apiCall } = useApi()

  const executeDryRun = useCallback(async (config: DeployConfig) => {
    setIsDryRunning(true)
    try {
      // API call: POST /agents/deploy/dry-run
      const response = await apiCall<{ results: DryRunResult[] }>(
        'agents/deploy/dry-run',
        {
          method: 'POST',
          body: JSON.stringify(config)
        }
      )
      setDryRunResults(response.results)
      setShowDryRunDialog(true)
    } catch (error) {
      console.error('Dry run failed:', error)
      throw error
    } finally {
      setIsDryRunning(false)
    }
  }, [apiCall])

  const executeDeployToGit = useCallback(async (config: DeployConfig) => {
    setIsDeploying(true)
    try {
      // API call: POST /agents/deploy/to-git
      const response = await apiCall<{ results: DeployResult[] }>(
        'agents/deploy/to-git',
        {
          method: 'POST',
          body: JSON.stringify(config)
        }
      )
      setDeployResults(response.results)
      setShowDeployResults(true)
    } catch (error) {
      console.error('Deploy to git failed:', error)
      throw error
    } finally {
      setIsDeploying(false)
    }
  }, [apiCall])

  const executeActivate = useCallback(async (config: DeployConfig) => {
    setIsActivating(true)
    try {
      // API call: POST /agents/deploy/activate
      const response = await apiCall<{ results: DeployResult[] }>(
        'agents/deploy/activate',
        {
          method: 'POST',
          body: JSON.stringify(config)
        }
      )
      setDeployResults(response.results)
      setShowDeployResults(true)
    } catch (error) {
      console.error('Activation failed:', error)
      throw error
    } finally {
      setIsActivating(false)
    }
  }, [apiCall])

  const resetResults = useCallback(() => {
    setDryRunResults(EMPTY_DRY_RUN_RESULTS)
    setDeployResults(EMPTY_DEPLOY_RESULTS)
    setShowDryRunDialog(false)
    setShowDeployResults(false)
  }, [])

  const deploymentSummary = useMemo<DeployExecutionSummary>(() => {
    const results = deployResults.length > 0 ? deployResults : dryRunResults
    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  }, [dryRunResults, deployResults])

  return useMemo(() => ({
    isDryRunning,
    isDeploying,
    isActivating,
    dryRunResults,
    deployResults,
    showDryRunDialog,
    showDeployResults,
    deploymentSummary,
    setShowDryRunDialog,
    setShowDeployResults,
    executeDryRun,
    executeDeployToGit,
    executeActivate,
    resetResults
  }), [
    isDryRunning,
    isDeploying,
    isActivating,
    dryRunResults,
    deployResults,
    showDryRunDialog,
    showDeployResults,
    deploymentSummary,
    executeDryRun,
    executeDeployToGit,
    executeActivate,
    resetResults
  ])
}
