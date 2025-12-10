import { useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { VariableManagerPanel } from '../components/variable-manager-panel'
import { TemplateSelectionPanel } from '../components/template-selection-panel'
import type { Template, TemplateVariable, ErrorDetails } from '../types'

interface VariablesAndTemplatesTabProps {
  // Variables
  variables: TemplateVariable[]
  useNautobotContext: boolean
  setUseNautobotContext: (value: boolean) => void
  addVariable: () => void
  removeVariable: (id: string) => void
  updateVariable: (id: string, field: 'name' | 'value', value: string) => void
  validateVariableName: (name: string) => boolean
  // Templates
  templates: Template[]
  selectedTemplateId: string
  selectedTemplate: Template | null
  editedTemplateContent: string
  isSavingTemplate: boolean
  setEditedTemplateContent: (content: string) => void
  handleTemplateChange: (templateId: string) => Promise<void>
  handleSaveTemplate: () => Promise<void>
  // Devices
  selectedDevices: DeviceInfo[]
  // Error handling
  onError: (error: ErrorDetails) => void
  // Dialog callbacks
  onShowTestResult: (result: string) => void
  onShowNautobotData: (data: Record<string, unknown>) => void
}

export function VariablesAndTemplatesTab(props: VariablesAndTemplatesTabProps) {
  const { apiCall } = useApi()
  const [testDeviceId, setTestDeviceId] = useState<string>('')
  const [isTestingTemplate, setIsTestingTemplate] = useState(false)
  const [isLoadingNautobotData, setIsLoadingNautobotData] = useState(false)

  const prepareVariablesObject = () => {
    const varsObject: Record<string, string> = {}
    props.variables.forEach(v => {
      if (v.name && props.validateVariableName(v.name)) {
        varsObject[v.name] = v.value
      }
    })
    return varsObject
  }

  const handleTestTemplate = async () => {
    if (!props.selectedTemplate || !testDeviceId) {
      return
    }

    setIsTestingTemplate(true)
    try {
      const device = props.selectedDevices.find(d => d.id === testDeviceId)
      if (!device) {
        alert('Selected device not found')
        return
      }

      const varsObject = prepareVariablesObject()
      const useEditedContent = props.selectedTemplate.scope === 'private' && 
                               props.editedTemplateContent !== props.selectedTemplate.content

      const response = await apiCall<{
        rendered_content: string
        variables_used: string[]
        warnings?: string[]
      }>('templates/render', {
        method: 'POST',
        body: useEditedContent ? {
          template_content: props.editedTemplateContent,
          category: 'netmiko',
          device_id: device.id,
          user_variables: varsObject,
          use_nautobot_context: props.useNautobotContext
        } : {
          template_id: props.selectedTemplate.id,
          category: 'netmiko',
          device_id: device.id,
          user_variables: varsObject,
          use_nautobot_context: props.useNautobotContext
        }
      })

      props.onShowTestResult(response.rendered_content)

      if (response.warnings && response.warnings.length > 0) {
        console.warn('Template rendering warnings:', response.warnings)
      }
    } catch (error: unknown) {
      console.error('Error testing template:', error)
      const errorMessage = (error as Error)?.message || 'Unknown error'
      const details: string[] = []
      details.push(`Error message: ${errorMessage}`)
      
      const userVars = Object.keys(prepareVariablesObject())
      if (userVars.length > 0) {
        details.push(`User-provided variables: ${userVars.join(', ')}`)
      } else {
        details.push('User-provided variables: (none)')
      }
      
      details.push(`Nautobot context enabled: ${props.useNautobotContext ? 'Yes' : 'No'}`)
      
      props.onError({
        title: 'Template Rendering Failed',
        message: 'The template could not be rendered. Please check the details below:',
        details
      })
    } finally {
      setIsTestingTemplate(false)
    }
  }

  const handleShowNautobotData = async () => {
    if (!testDeviceId) {
      return
    }

    setIsLoadingNautobotData(true)
    try {
      const device = props.selectedDevices.find(d => d.id === testDeviceId)
      if (!device) {
        alert('Selected device not found')
        return
      }

      const response = await apiCall<Record<string, unknown>>(`nautobot/devices/${device.id}/details`)
      props.onShowNautobotData(response)
    } catch (error) {
      console.error('Error fetching Nautobot data:', error)
      alert('Error fetching Nautobot data: ' + (error as Error).message)
    } finally {
      setIsLoadingNautobotData(false)
    }
  }

  return (
    <div className="space-y-6">
      <VariableManagerPanel
        variables={props.variables}
        useNautobotContext={props.useNautobotContext}
        setUseNautobotContext={props.setUseNautobotContext}
        addVariable={props.addVariable}
        removeVariable={props.removeVariable}
        updateVariable={props.updateVariable}
        validateVariableName={props.validateVariableName}
      />

      <TemplateSelectionPanel
        templates={props.templates}
        selectedTemplateId={props.selectedTemplateId}
        selectedTemplate={props.selectedTemplate}
        editedTemplateContent={props.editedTemplateContent}
        isSavingTemplate={props.isSavingTemplate}
        setEditedTemplateContent={props.setEditedTemplateContent}
        handleTemplateChange={props.handleTemplateChange}
        handleSaveTemplate={props.handleSaveTemplate}
        selectedDevices={props.selectedDevices}
        testDeviceId={testDeviceId}
        setTestDeviceId={setTestDeviceId}
        isTestingTemplate={isTestingTemplate}
        isLoadingNautobotData={isLoadingNautobotData}
        onTestTemplate={handleTestTemplate}
        onShowNautobotData={handleShowNautobotData}
      />
    </div>
  )
}
