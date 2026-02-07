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
}

export function useTemplateRender() {
  const { apiCall } = useApi()
  const [isRendering, setIsRendering] = useState(false)
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const render = useCallback(
    async (options: RenderOptions) => {
      const { content, category, variables, inventoryId, passSnmpMapping, path } = options

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
        const userVariables: Record<string, string> = {}
        for (const v of variables) {
          if (v.name && v.value && !v.isAutoFilled) {
            userVariables[v.name] = v.value
          }
        }

        if (category === 'agent' && inventoryId) {
          // Use the agent deploy dry-run endpoint for agent templates
          // We need to get devices from the inventory first
          const inventoryResponse = await apiCall<{ devices: Array<{ id: string }> }>(
            `inventory/${inventoryId}/preview`,
            { method: 'POST', body: { operations: [] } }
          ).catch(() => null)

          const deviceIds = inventoryResponse?.devices?.map((d) => d.id) || []

          const response = await apiCall<{
            results: Array<{
              renderedConfig: string
              success: boolean
              error: string | null
            }>
          }>('agents/deploy/dry-run', {
            method: 'POST',
            body: {
              templateId: 0, // Will use raw content below
              deviceIds,
              variables: userVariables,
              passSnmpMapping: passSnmpMapping ?? true,
              agentId: 'preview',
              path: path || '',
            },
          })

          const result = response.results?.[0]
          if (result) {
            setRenderResult({
              success: result.success,
              renderedContent: result.renderedConfig || '',
              error: result.error || undefined,
            })
          }
        } else {
          // Use the generic template render endpoint
          const response = await apiCall<{
            rendered_content: string
            errors?: string[]
            warnings?: string[]
          }>('templates/render', {
            method: 'POST',
            body: {
              template_content: content,
              category: category === '__none__' ? '' : category,
              user_variables: userVariables,
            },
          })

          setRenderResult({
            success: !response.errors?.length,
            renderedContent: response.rendered_content || '',
            error: response.errors?.join(', '),
            warnings: response.warnings,
          })
        }
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
