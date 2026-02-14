import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { RenderResult, TemplateVariable } from '../types'

interface RenderOptions {
  content: string
  category: string
  variables: TemplateVariable[]
  inventoryId?: number | null
  passSnmpMapping?: boolean
  path?: string
  // Netmiko-specific
  deviceId?: string | null
  credentialId?: string | null
  preRunCommand?: string | null
  useNautobotContext?: boolean
}

export function useTemplateRender() {
  const { apiCall } = useApi()
  const [isRendering, setIsRendering] = useState(false)
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const render = useCallback(
    async (options: RenderOptions) => {
      const { 
        content, 
        category, 
        variables, 
        inventoryId, 
        passSnmpMapping, 
        path,
        deviceId,
        credentialId,
        preRunCommand,
        useNautobotContext = true,
      } = options

      if (!content.trim()) {
        setRenderResult({
          success: false,
          renderedContent: '',
          error: 'Template content is empty',
        })
        setShowDialog(true)
        return
      }

      setIsRendering(true)
      try {
        // Build user variables, filtering out pre_run.raw and pre_run.parsed
        // as the backend will execute and populate these dynamically
        // Parse JSON strings into objects so Jinja2 can use them directly
        const userVariables: Record<string, unknown> = {}
        for (const v of variables) {
          // Skip auto-filled variables and pre_run variables
          if (v.name && v.value && !v.isAutoFilled) {
            // Filter out pre_run.raw and pre_run.parsed - backend will generate these
            if (v.name === 'pre_run.raw' || v.name === 'pre_run.parsed') {
              continue
            }

            // Try to parse JSON strings into objects for proper template usage
            // If parsing fails, keep the original string value
            let parsedValue: unknown = v.value
            try {
              parsedValue = JSON.parse(v.value)
            } catch {
              // Not JSON or invalid JSON - keep as string
              parsedValue = v.value
            }

            userVariables[v.name] = parsedValue
          }
        }

        // Use the new unified advanced-render endpoint for both categories
        const requestBody: Record<string, unknown> = {
          template_content: content,
          category: category === '__none__' ? 'generic' : category,
          user_variables: userVariables,
        }

        // Add netmiko-specific fields
        if (category === 'netmiko') {
          requestBody.device_id = deviceId || null
          requestBody.use_nautobot_context = useNautobotContext
          requestBody.pre_run_command = preRunCommand || null
          requestBody.credential_id = credentialId && credentialId !== 'none' 
            ? parseInt(credentialId) 
            : null
        }

        // Add agent-specific fields
        if (category === 'agent') {
          requestBody.inventory_id = inventoryId || null
          requestBody.pass_snmp_mapping = passSnmpMapping ?? false
          requestBody.path = path || null
        }

        const response = await apiCall<{
          rendered_content: string
          variables_used: string[]
          context_data?: Record<string, unknown>
          warnings?: string[]
          pre_run_output?: string
          pre_run_parsed?: Array<Record<string, unknown>>
        }>('templates/advanced-render', {
          method: 'POST',
          body: requestBody,
        })

        setRenderResult({
          success: true,
          renderedContent: response.rendered_content || '',
          warnings: response.warnings,
        })
      } catch (err) {
        setRenderResult({
          success: false,
          renderedContent: '',
          error: (err as Error).message || 'Failed to render template',
        })
      } finally {
        setIsRendering(false)
        setShowDialog(true)
      }
    },
    [apiCall]
  )

  return useMemo(
    () => ({
      isRendering,
      renderResult,
      showDialog,
      setShowDialog,
      render,
    }),
    [isRendering, renderResult, showDialog, render]
  )
}
