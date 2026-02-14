'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, Download } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useSavedInventoriesQuery } from '@/hooks/queries/use-saved-inventories-queries'
import type { InventoryMetadataType } from '../types'

interface AnalyzeResponse {
  locations: string[]
  tags: string[]
  custom_fields: Record<string, string[]>
  statuses: string[]
  roles: string[]
  device_count: number
}

const DATA_TYPE_LABELS: Record<InventoryMetadataType, string> = {
  locations: 'Locations',
  tags: 'Tags',
  custom_fields: 'Custom Fields',
  statuses: 'Statuses',
  roles: 'Roles',
}

interface InventoryMetadataTabProps {
  onAdd: (name: string, value: string) => void
  existingVariableNames: string[]
  category: string
  inventoryId: number | null
}

export function InventoryMetadataTab({
  onAdd,
  existingVariableNames,
  category,
  inventoryId
}: InventoryMetadataTabProps) {
  const { apiCall } = useApi()
  const { data: inventoriesData, isLoading: loadingInventories } = useSavedInventoriesQuery()
  const inventories = inventoriesData?.inventories || []

  // For agent category, use the inventory from Agent Options panel
  // For other categories, allow user to select an inventory
  const isAgentCategory = category === 'agent'
  const agentInventoryId = isAgentCategory && inventoryId ? String(inventoryId) : ''

  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('')
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [selectedDataType, setSelectedDataType] = useState<InventoryMetadataType | ''>('')
  const [selectedCustomField, setSelectedCustomField] = useState<string>('')
  const [variableName, setVariableName] = useState('')

  // Determine which inventory ID to use
  const activeInventoryId = isAgentCategory ? agentInventoryId : selectedInventoryId

  // Fetch analyze data when inventory changes
  useEffect(() => {
    if (!activeInventoryId) {
      setAnalyzeData(null)
      setSelectedDataType('')
      setSelectedCustomField('')
      setVariableName('')
      setAnalyzeError('')
      return
    }

    let cancelled = false
    setAnalyzing(true)
    setAnalyzeData(null)
    setSelectedDataType('')
    setSelectedCustomField('')
    setVariableName('')
    setAnalyzeError('')

    apiCall<AnalyzeResponse>(`inventory/${activeInventoryId}/analyze`)
      .then((data) => {
        if (!cancelled) {
          setAnalyzeData(data)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAnalyzeError(error instanceof Error ? error.message : 'Failed to analyze inventory')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAnalyzing(false)
        }
      })

    return () => { cancelled = true }
  }, [activeInventoryId, apiCall])

  // Auto-suggest variable name when data type changes
  useEffect(() => {
    if (!selectedDataType) {
      setVariableName('')
      setSelectedCustomField('')
      return
    }
    if (selectedDataType !== 'custom_fields') {
      setSelectedCustomField('')
      setVariableName(`inventory_${selectedDataType}`)
    } else {
      setVariableName('')
    }
  }, [selectedDataType])

  // Auto-suggest variable name when custom field changes
  useEffect(() => {
    if (selectedDataType === 'custom_fields' && selectedCustomField) {
      setVariableName(`inventory_cf_${selectedCustomField}`)
    }
  }, [selectedDataType, selectedCustomField])

  // Build available data type options from analyze response
  const availableDataTypes: InventoryMetadataType[] = analyzeData
    ? (Object.keys(DATA_TYPE_LABELS) as InventoryMetadataType[]).filter((key) => {
        const value = analyzeData[key]
        if (key === 'custom_fields') {
          return value && typeof value === 'object' && Object.keys(value).length > 0
        }
        return Array.isArray(value) && value.length > 0
      })
    : []

  const customFieldNames = analyzeData?.custom_fields ? Object.keys(analyzeData.custom_fields) : []

  const nameError = variableName && existingVariableNames.includes(variableName)
    ? 'A variable with this name already exists'
    : ''

  const canAdd =
    activeInventoryId && // Must have an active inventory ID
    selectedDataType &&
    variableName.trim() &&
    !nameError &&
    (selectedDataType !== 'custom_fields' || selectedCustomField)

  const handleAdd = useCallback(() => {
    if (!canAdd || !analyzeData || !selectedDataType) return

    let values: unknown
    if (selectedDataType === 'custom_fields') {
      values = analyzeData.custom_fields[selectedCustomField]
    } else {
      values = analyzeData[selectedDataType]
    }

    onAdd(variableName.trim(), JSON.stringify(values, null, 2))
  }, [canAdd, analyzeData, selectedDataType, selectedCustomField, variableName, onAdd])

  // Preview values for the current selection
  const previewValues: string[] | null = (() => {
    if (!analyzeData || !selectedDataType) return null
    if (selectedDataType === 'custom_fields') {
      return selectedCustomField ? analyzeData.custom_fields[selectedCustomField] || [] : null
    }
    return analyzeData[selectedDataType] || []
  })()

  // Get inventory name for agent category
  const agentInventoryName = isAgentCategory && agentInventoryId
    ? inventories.find(inv => String(inv.id) === agentInventoryId)?.name
    : null

  return (
    <div className="space-y-4">
      {isAgentCategory && !agentInventoryId ? (
        // Agent category with no inventory selected
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>No inventory selected.</strong>
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Please select an inventory in the <strong>Agent Options</strong> panel above before adding inventory-based variables.
          </p>
        </div>
      ) : isAgentCategory && agentInventoryId ? (
        // Agent category with inventory selected - show which inventory is being used
        <div className="space-y-2">
          <Label>Using Inventory from Agent Options</Label>
          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-900">
            {agentInventoryName || `Inventory #${agentInventoryId}`}
          </div>
        </div>
      ) : (
        // Other categories - show dropdown
        <div className="space-y-2">
          <Label>Saved Inventory</Label>
          <Select value={selectedInventoryId} onValueChange={setSelectedInventoryId}>
            <SelectTrigger>
              <SelectValue placeholder={loadingInventories ? 'Loading...' : 'Select an inventory'} />
            </SelectTrigger>
            <SelectContent>
              {inventories.map((inv) => (
                <SelectItem key={inv.id} value={String(inv.id)}>
                  {inv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {analyzing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Analyzing inventory...
        </div>
      )}

      {analyzeError && (
        <p className="text-sm text-red-500">{analyzeError}</p>
      )}

      {analyzeData && (
        <>
          <div className="text-xs text-muted-foreground">
            {analyzeData.device_count} device{analyzeData.device_count !== 1 ? 's' : ''} in inventory
          </div>

          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={selectedDataType} onValueChange={(v) => setSelectedDataType(v as InventoryMetadataType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                {availableDataTypes.map((key) => (
                  <SelectItem key={key} value={key}>
                    {DATA_TYPE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDataType === 'custom_fields' && (
            <div className="space-y-2">
              <Label>Custom Field</Label>
              <Select value={selectedCustomField} onValueChange={setSelectedCustomField}>
                <SelectTrigger>
                  <SelectValue placeholder="Select custom field" />
                </SelectTrigger>
                <SelectContent>
                  {customFieldNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedDataType && (
            <div className="space-y-2">
              <Label htmlFor="inventory-var-name">Variable Name</Label>
              <Input
                id="inventory-var-name"
                value={variableName}
                onChange={(e) => setVariableName(e.target.value)}
                className={nameError ? 'border-red-300' : ''}
              />
              {nameError && (
                <p className="text-xs text-red-500">{nameError}</p>
              )}
            </div>
          )}

          {previewValues && previewValues.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Preview ({previewValues.length} values)</Label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {previewValues.map((val) => (
                  <Badge key={val} variant="secondary" className="text-xs">
                    {val}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Button onClick={handleAdd} disabled={!canAdd} className="w-full">
        <Download className="h-4 w-4 mr-1" />
        Add Variable
      </Button>
    </div>
  )
}
