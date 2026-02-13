'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, Download } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import type { NautobotDataType } from '../types'

const DATA_TYPE_OPTIONS: { value: NautobotDataType; label: string; endpoint: string; suggestedName: string }[] = [
  { value: 'locations', label: 'Locations', endpoint: 'nautobot/locations', suggestedName: 'nautobot_locations' },
  { value: 'tags', label: 'Tags', endpoint: 'nautobot/tags', suggestedName: 'nautobot_tags' },
  { value: 'custom-fields', label: 'Custom Fields', endpoint: 'nautobot/custom-fields/devices', suggestedName: 'nautobot_custom_fields' },
  { value: 'statuses', label: 'Statuses', endpoint: 'nautobot/statuses', suggestedName: 'nautobot_statuses' },
  { value: 'roles', label: 'Roles', endpoint: 'nautobot/roles', suggestedName: 'nautobot_roles' },
  { value: 'namespaces', label: 'Namespaces', endpoint: 'nautobot/namespaces', suggestedName: 'nautobot_namespaces' },
]

interface NautobotDataTabProps {
  onAdd: (name: string, value: string) => void
  existingVariableNames: string[]
}

export function NautobotDataTab({ onAdd, existingVariableNames }: NautobotDataTabProps) {
  const { apiCall } = useApi()
  const [selectedType, setSelectedType] = useState<NautobotDataType | ''>('')
  const [variableName, setVariableName] = useState('')
  const [fetching, setFetching] = useState(false)

  // Auto-suggest variable name when data type changes
  useEffect(() => {
    if (selectedType) {
      const option = DATA_TYPE_OPTIONS.find((o) => o.value === selectedType)
      if (option) {
        setVariableName(option.suggestedName)
      }
    }
  }, [selectedType])

  const nameError = variableName && existingVariableNames.includes(variableName)
    ? 'A variable with this name already exists'
    : ''

  const canFetch = selectedType && variableName.trim() && !nameError

  const handleFetch = useCallback(async () => {
    if (!canFetch || !selectedType) return
    const option = DATA_TYPE_OPTIONS.find((o) => o.value === selectedType)
    if (!option) return

    setFetching(true)
    try {
      const response = await apiCall(option.endpoint)
      const jsonValue = JSON.stringify(response, null, 2)
      onAdd(variableName.trim(), jsonValue)
    } catch (error) {
      console.error('Failed to fetch Nautobot data:', error)
    } finally {
      setFetching(false)
    }
  }, [canFetch, selectedType, apiCall, variableName, onAdd])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Data Type</Label>
        <Select value={selectedType} onValueChange={(v) => setSelectedType(v as NautobotDataType)}>
          <SelectTrigger>
            <SelectValue placeholder="Select Nautobot data type" />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedType && (
        <div className="space-y-2">
          <Label htmlFor="nautobot-var-name">Variable Name</Label>
          <Input
            id="nautobot-var-name"
            value={variableName}
            onChange={(e) => setVariableName(e.target.value)}
            className={nameError ? 'border-red-300' : ''}
          />
          {nameError && (
            <p className="text-xs text-red-500">{nameError}</p>
          )}
        </div>
      )}

      <Button onClick={handleFetch} disabled={!canFetch || fetching} className="w-full">
        {fetching ? (
          <RefreshCw className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Download className="h-4 w-4 mr-1" />
        )}
        {fetching ? 'Fetching...' : 'Fetch & Add'}
      </Button>
    </div>
  )
}
