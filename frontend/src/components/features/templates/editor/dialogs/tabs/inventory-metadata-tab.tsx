'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Info, Download } from 'lucide-react'
import { useSavedInventoriesQuery } from '@/hooks/queries/use-saved-inventories-queries'
import type { InventoryMetadataType } from '../types'

const METADATA_TYPE_OPTIONS: { value: InventoryMetadataType; label: string; suggestedName: string }[] = [
  { value: 'locations', label: 'Locations', suggestedName: 'inventory_locations' },
  { value: 'tags', label: 'Tags', suggestedName: 'inventory_tags' },
  { value: 'custom-fields', label: 'Custom Fields', suggestedName: 'inventory_custom_fields' },
]

interface InventoryMetadataTabProps {
  existingVariableNames: string[]
}

export function InventoryMetadataTab({ existingVariableNames }: InventoryMetadataTabProps) {
  const { data: inventoriesData, isLoading: loadingInventories } = useSavedInventoriesQuery()
  const inventories = inventoriesData?.inventories || []

  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('')
  const [selectedMetadataType, setSelectedMetadataType] = useState<InventoryMetadataType | ''>('')
  const [variableName, setVariableName] = useState('')

  // Auto-suggest variable name from metadata type
  useEffect(() => {
    if (selectedMetadataType) {
      const option = METADATA_TYPE_OPTIONS.find((o) => o.value === selectedMetadataType)
      if (option) {
        setVariableName(option.suggestedName)
      }
    }
  }, [selectedMetadataType])

  const nameError = variableName && existingVariableNames.includes(variableName)
    ? 'A variable with this name already exists'
    : ''

  return (
    <div className="space-y-4">
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

      {selectedInventoryId && (
        <div className="space-y-2">
          <Label>Metadata Type</Label>
          <Select value={selectedMetadataType} onValueChange={(v) => setSelectedMetadataType(v as InventoryMetadataType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select metadata type" />
            </SelectTrigger>
            <SelectContent>
              {METADATA_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedMetadataType && (
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

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          This feature is coming soon. The backend endpoint is not yet implemented.
        </AlertDescription>
      </Alert>

      <Button disabled className="w-full" title="Coming soon - backend endpoint not yet implemented">
        <Download className="h-4 w-4 mr-1" />
        Add (Coming Soon)
      </Button>
    </div>
  )
}
