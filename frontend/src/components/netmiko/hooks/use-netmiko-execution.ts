import { useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { 
  CommandResult, 
  ExecutionSummary,
  TemplateVariable,
  Template
} from '../types'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { 
  prepareVariablesObject, 
  buildCredentialRequestBody, 
  formatExecutionResults 
} from '../utils/netmiko-utils'

export function useNetmikoExecution() {
  const { apiCall } = useApi()
  const [isExecuting, setIsExecuting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [executionResults, setExecutionResults] = useState<CommandResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null)

  const executeCommands = async (params: {
    selectedDevices: DeviceInfo[]
    commands: string
    enableMode: boolean
    writeConfig: boolean
    selectedCredentialId: string
    username: string
    password: string
  }) => {
    const { 
      selectedDevices, 
      commands, 
      enableMode, 
      writeConfig,
      selectedCredentialId,
      username,
      password
    } = params

    const sessionId = crypto.randomUUID()
    setCurrentSessionId(sessionId)
    setIsExecuting(true)
    setShowResults(false)
    setExecutionResults([])

    try {
      const commandList = commands
        .split('\n')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0)

      if (commandList.length === 0) {
        alert('Please enter valid commands.')
        setIsExecuting(false)
        setCurrentSessionId(null)
        return
      }

      const devices = selectedDevices.map(device => ({
        ip: device.primary_ip4 || '',
        name: device.name,
        platform: device.platform || 'cisco_ios'
      }))

      const baseBody = {
        devices,
        commands: commandList,
        enable_mode: enableMode,
        write_config: writeConfig,
        session_id: sessionId
      }

      const requestBody = buildCredentialRequestBody(
        baseBody,
        selectedCredentialId,
        username,
        password
      )

      const response = await apiCall<{
        session_id: string
        results: CommandResult[]
        total_devices: number
        successful: number
        failed: number
        cancelled: number
      }>('netmiko/execute-commands', {
        method: 'POST',
        body: requestBody
      })

      setExecutionResults(response.results)
      setExecutionSummary({
        total: response.total_devices,
        successful: response.successful,
        failed: response.failed,
        cancelled: response.cancelled
      })
      setShowResults(true)
    } catch (error) {
      console.error('Error executing:', error)
      alert('Error executing: ' + (error as Error).message)
    } finally {
      setIsExecuting(false)
      setCurrentSessionId(null)
      setIsCancelling(false)
    }
  }

  const executeTemplate = async (params: {
    selectedDevices: DeviceInfo[]
    selectedTemplate: Template | null
    editedTemplateContent: string
    variables: TemplateVariable[]
    useNautobotContext: boolean
    dryRun: boolean
    enableMode: boolean
    writeConfig: boolean
    selectedCredentialId: string
    username: string
    password: string
  }) => {
    const {
      selectedDevices,
      selectedTemplate,
      editedTemplateContent,
      variables,
      useNautobotContext,
      dryRun,
      enableMode,
      writeConfig,
      selectedCredentialId,
      username,
      password
    } = params

    const sessionId = crypto.randomUUID()
    setCurrentSessionId(sessionId)
    setIsExecuting(true)
    setShowResults(false)
    setExecutionResults([])

    try {
      const varsObject = prepareVariablesObject(variables)
      const useEditedContent = selectedTemplate && editedTemplateContent !== selectedTemplate.content

      const baseBody = {
        device_ids: selectedDevices.map(d => d.id),
        user_variables: varsObject,
        use_nautobot_context: useNautobotContext,
        dry_run: dryRun,
        enable_mode: enableMode,
        write_config: writeConfig,
        session_id: sessionId,
        ...(useEditedContent 
          ? { template_content: editedTemplateContent }
          : { template_id: selectedTemplate?.id }
        )
      }

      const requestBody = buildCredentialRequestBody(
        baseBody,
        selectedCredentialId,
        username,
        password
      )

      const response = await apiCall<{
        session_id: string
        results: Array<{
          device_id: string
          device_name: string
          success: boolean
          rendered_content?: string
          output?: string
          error?: string
        }>
        summary: Record<string, number>
      }>('netmiko/execute-template', {
        method: 'POST',
        body: requestBody
      })

      const convertedResults = formatExecutionResults(response.results, dryRun)

      setExecutionResults(convertedResults)
      setExecutionSummary({
        total: response.summary.total || 0,
        successful: dryRun ? (response.summary.rendered_successfully || 0) : (response.summary.executed_successfully || 0),
        failed: response.summary.failed || 0,
        cancelled: response.summary.cancelled || 0
      })
      setShowResults(true)
    } catch (error) {
      console.error('Error executing:', error)
      alert('Error executing: ' + (error as Error).message)
    } finally {
      setIsExecuting(false)
      setCurrentSessionId(null)
      setIsCancelling(false)
    }
  }

  const cancelExecution = async () => {
    if (!currentSessionId) {
      return
    }

    setIsCancelling(true)
    try {
      await apiCall(`netmiko/cancel/${currentSessionId}`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('Error cancelling execution:', error)
      alert('Error cancelling execution: ' + (error as Error).message)
    }
  }

  const resetResults = () => {
    setShowResults(false)
    setExecutionResults([])
    setExecutionSummary(null)
  }

  return {
    isExecuting,
    isCancelling,
    currentSessionId,
    executionResults,
    showResults,
    executionSummary,
    executeCommands,
    executeTemplate,
    cancelExecution,
    resetResults,
  }
}
