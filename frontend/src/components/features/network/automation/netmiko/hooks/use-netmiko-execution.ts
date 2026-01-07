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

      // Check if template is in "Sync to Nautobot" mode
      if (selectedTemplate?.execution_mode === 'sync_to_nautobot') {
        // Use the new execute-and-sync endpoint
        console.log('Using execute-and-sync endpoint for Sync to Nautobot mode')

        const response = await apiCall<{
          success: boolean
          message: string
          task_id?: string
          job_id?: string
          rendered_outputs?: Record<string, string>
          parsed_updates?: Array<Record<string, unknown>>
          errors?: string[]
          warnings?: string[]
        }>('templates/execute-and-sync', {
          method: 'POST',
          body: {
            template_id: selectedTemplate.id,
            device_ids: selectedDevices.map(d => d.id),
            user_variables: varsObject,
            dry_run: dryRun,
            output_format: 'json' // Default to JSON, could be made configurable
          }
        })

        // Convert response to execution results format
        const convertedResults: CommandResult[] = []

        if (response.rendered_outputs) {
          Object.entries(response.rendered_outputs).forEach(([deviceId, output]) => {
            const device = selectedDevices.find(d => d.id === deviceId)
            const hasError = response.errors?.some(err => err.includes(deviceId))

            convertedResults.push({
              device: device?.name || deviceId,
              success: !hasError && response.success,
              output: dryRun
                ? `Rendered Output:\n${output}\n\n${response.parsed_updates ? `Parsed Update:\n${JSON.stringify(response.parsed_updates.find(u => u.id === deviceId), null, 2)}` : ''}`
                : response.success
                  ? `✅ Successfully queued sync to Nautobot\nTask ID: ${response.task_id}\nJob ID: ${response.job_id}\n\nRendered Output:\n${output}`
                  : `❌ Failed to sync\n${response.errors?.filter(err => err.includes(deviceId)).join('\n')}`,
              error: hasError ? response.errors?.filter(err => err.includes(deviceId)).join('\n') : undefined
            })
          })
        }

        // Show warnings if any
        if (response.warnings && response.warnings.length > 0) {
          console.warn('Warnings:', response.warnings)
        }

        setExecutionResults(convertedResults)
        setExecutionSummary({
          total: selectedDevices.length,
          successful: convertedResults.filter(r => r.success).length,
          failed: convertedResults.filter(r => !r.success).length,
          cancelled: 0
        })
        setShowResults(true)

        // Show success message with job tracking info
        if (response.success && response.job_id) {
          alert(`✅ ${response.message}\n\nJob ID: ${response.job_id}\nYou can track this job in the Jobs/Views page.`)
        } else if (!response.success) {
          alert(`❌ ${response.message}\n\n${response.errors?.join('\n') || ''}`)
        }

      } else {
        // Regular template execution (run on device or write to file)
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
      }
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
