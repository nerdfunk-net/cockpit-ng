'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileCode, X, Lock } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'

interface TemplateVariable {
  value: string
  type: 'custom' | 'inventory'
  metadata: Record<string, unknown>
}

interface TemplateListItem {
  id: number
  name: string
  scope: 'global' | 'private'
}

interface TemplateDetail {
  id: number
  name: string
  file_path?: string
  variables?: Record<string, TemplateVariable>
}

interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
}

export interface DeployTemplateEntryData {
  _key: string
  templateId: number | null
  inventoryId: number | null
  path: string
  customVariables: Record<string, string>
}

interface DeployTemplateEntryProps {
  index: number
  entry: DeployTemplateEntryData
  onChange: (index: number, entry: DeployTemplateEntryData) => void
  onRemove: (index: number) => void
  canRemove: boolean
  templates: TemplateListItem[]
  savedInventories: SavedInventory[]
  loadingInventories: boolean
  loadingTemplates: boolean
}

export function DeployTemplateEntryComponent({
  index,
  entry,
  onChange,
  onRemove,
  canRemove,
  templates,
  savedInventories,
  loadingInventories,
  loadingTemplates,
}: DeployTemplateEntryProps) {
  const token = useAuthStore(state => state.token)
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Fetch template detail when templateId changes
  const fetchTemplateDetail = useCallback(async (templateId: number) => {
    if (!token) return
    setLoadingDetail(true)
    try {
      const response = await fetch(`/api/proxy/api/templates/${templateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setTemplateDetail(data)

        // Auto-fill path from template's default file_path if path is empty
        if (data.file_path && !entry.path) {
          onChange(index, { ...entry, path: data.file_path })
        }
      }
    } catch (error) {
      console.error('Error fetching template detail:', error)
    } finally {
      setLoadingDetail(false)
    }
  }, [token, entry, index, onChange])

  useEffect(() => {
    if (entry.templateId) {
      fetchTemplateDetail(entry.templateId)
    } else {
      setTemplateDetail(null)
    }
    // Only re-fetch when templateId changes, not on every entry change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.templateId, token])

  const customVariables = useMemo(() => {
    if (!templateDetail?.variables) return []
    return Object.entries(templateDetail.variables)
      .filter(([, variable]) => variable.type === 'custom')
      .map(([name, variable]) => ({
        name,
        defaultValue: variable.value,
        currentValue: entry.customVariables[name] ?? variable.value,
      }))
  }, [templateDetail, entry.customVariables])

  const handleTemplateChange = useCallback((value: string) => {
    if (value === 'none') {
      onChange(index, { _key: entry._key, templateId: null, inventoryId: entry.inventoryId, path: '', customVariables: {} })
    } else {
      onChange(index, { _key: entry._key, templateId: parseInt(value), inventoryId: entry.inventoryId, path: '', customVariables: {} })
    }
  }, [index, entry._key, entry.inventoryId, onChange])

  const handleInventoryChange = useCallback((value: string) => {
    if (value === 'none') {
      onChange(index, { ...entry, inventoryId: null })
    } else {
      onChange(index, { ...entry, inventoryId: parseInt(value) })
    }
  }, [index, entry, onChange])

  const handlePathChange = useCallback((value: string) => {
    onChange(index, { ...entry, path: value })
  }, [index, entry, onChange])

  const handleVariableChange = useCallback((name: string, value: string) => {
    onChange(index, {
      ...entry,
      customVariables: { ...entry.customVariables, [name]: value },
    })
  }, [index, entry, onChange])

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/20 p-4 space-y-3 relative">
      {/* Header with remove button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-teal-600" />
          <Label className="text-sm font-semibold text-teal-900">
            Template {index + 1}
          </Label>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Template + Inventory selectors */}
      <div className="grid grid-cols-2 gap-3">
        {/* Template Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs text-teal-700">
            Agent Template <span className="text-red-500">*</span>
          </Label>
          <Select
            value={entry.templateId?.toString() || 'none'}
            onValueChange={handleTemplateChange}
            disabled={loadingTemplates}
          >
            <SelectTrigger className="h-9 bg-white border-teal-200 focus:border-teal-400">
              <SelectValue placeholder={loadingTemplates ? 'Loading...' : 'Select template...'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No template selected</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name} ({t.scope})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Inventory Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs text-teal-700">Inventory</Label>
          {loadingInventories ? (
            <div className="flex items-center justify-center h-9 bg-white border border-teal-200 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
            </div>
          ) : (
            <Select
              value={entry.inventoryId?.toString() || 'none'}
              onValueChange={handleInventoryChange}
            >
              <SelectTrigger className="h-9 bg-white border-teal-200 focus:border-teal-400">
                <SelectValue placeholder="Select inventory..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No inventory (use template default)</SelectItem>
                {savedInventories.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{inv.name}</span>
                      {inv.scope === 'private' && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Deployment Path */}
      <div className="space-y-1.5">
        <Label className="text-xs text-teal-700">
          <div className="flex items-center gap-1">
            <FileCode className="h-3 w-3" />
            Deployment Path
          </div>
        </Label>
        <Input
          value={entry.path}
          onChange={(e) => handlePathChange(e.target.value)}
          placeholder="e.g., configs/telegraf.conf"
          className="h-9 bg-white border-teal-200 focus:border-teal-400"
        />
        <p className="text-xs text-teal-600">
          File path relative to Git repo root. Defaults to template&apos;s file_path if not set.
        </p>
      </div>

      {/* Loading template detail */}
      {loadingDetail && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
          <span className="ml-2 text-xs text-gray-600">Loading template details...</span>
        </div>
      )}

      {/* Custom Variables */}
      {!loadingDetail && templateDetail && customVariables.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-teal-700 font-medium">Custom Variables</Label>
          <div className="grid grid-cols-2 gap-3">
            {customVariables.map(({ name, defaultValue, currentValue }) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-teal-900">{name}</Label>
                  <span className="text-xs text-teal-500">Default: {defaultValue}</span>
                </div>
                <Input
                  value={currentValue}
                  onChange={(e) => handleVariableChange(name, e.target.value)}
                  placeholder={`Override value for ${name}`}
                  className="h-8 text-sm bg-white border-teal-200 focus:border-teal-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
