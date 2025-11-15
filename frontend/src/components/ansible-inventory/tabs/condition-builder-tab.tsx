/**
 * Condition Builder Tab Component
 * Handles logical condition creation and management
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, RotateCcw, Play, Save, FolderOpen, Filter, X } from 'lucide-react'
import { getFieldLabel, getLogicBadgeColor, updateOperatorOptions } from '../utils'

import type { ApiCallType } from '../types'

// Types inferred from hooks
type ConditionBuilderType = ReturnType<typeof import('../hooks').useConditionBuilder>
type SavedInventoriesType = ReturnType<typeof import('../hooks').useSavedInventories>

interface ConditionBuilderTabProps {
  conditionBuilder: ConditionBuilderType
  apiCall: ApiCallType
  onPreview: () => void
  savedInventories: SavedInventoriesType
}

export function ConditionBuilderTab({
  conditionBuilder,
  apiCall,
  onPreview,
  savedInventories,
}: ConditionBuilderTabProps) {
  const {
    conditions,
    currentField,
    currentOperator,
    currentValue,
    currentLogic,
    fieldOptions,
    operatorOptions,
    logicOptions,
    fieldValues,
    locations,
    locationSearchValue,
    showLocationDropdown,
    setCurrentField,
    setCurrentOperator,
    setCurrentValue,
    setCurrentLogic,
    setFieldValues,
    setLocations,
    setLocationSearchValue,
    setShowLocationDropdown,
    setIsLoadingFieldValues,
    addCondition,
    removeCondition,
    clearAllConditions,
  } = conditionBuilder

  // Handle field change
  const handleFieldChange = async (fieldName: string) => {
    setCurrentField(fieldName)
    setCurrentValue('')
    setFieldValues([])
    setLocationSearchValue('')

    // Update operator options based on field
    const filteredOps = updateOperatorOptions(fieldName, operatorOptions)
    conditionBuilder.setOperatorOptions(filteredOps)

    // Load field values
    await loadFieldValues(fieldName)
  }

  const loadFieldValues = async (fieldName: string) => {
    if (!fieldName || fieldName === 'custom_fields') return

    setIsLoadingFieldValues(true)
    try {
      if (fieldName === 'location') {
        // Location uses Nautobot locations endpoint
        const response = await apiCall<Array<{id: string, name: string, parent?: {id: string}}>>('nautobot/locations')
        
        // Build hierarchical paths
        const locationMap = new Map(response.map(loc => [loc.id, loc]))
        
        response.forEach(location => {
          const path: string[] = []
          let current: typeof location | null = location
          
          while (current) {
            path.unshift(current.name)
            if (current.parent?.id) {
              current = locationMap.get(current.parent.id) || null
            } else {
              current = null
            }
          }
          
          // Add hierarchicalPath property
          (location as any).hierarchicalPath = path.join(' → ')
        })

        // Sort by hierarchical path
        response.sort((a: any, b: any) => a.hierarchicalPath.localeCompare(b.hierarchicalPath))
        setLocations(response as any)
      } else {
        // Load other field values
        const response = await apiCall<{field: string, values: Array<{value: string, label: string}>, input_type: string}>(`ansible-inventory/field-values/${fieldName}`)
        setFieldValues(response.values || [])
      }
    } catch (error) {
      console.error(`Error loading values for ${fieldName}:`, error)
      setFieldValues([])
    } finally {
      setIsLoadingFieldValues(false)
    }
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Logical Operations</span>
        </div>
        <div className="text-xs text-blue-100">
          Add conditions to filter devices. Use logical operators to combine multiple conditions.
        </div>
      </div>

      {/* Condition Builder Form */}
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_1fr_auto] gap-4">
          {/* Field Selection */}
          <div className="space-y-2">
            <Label htmlFor="field">Field</Label>
            <Select value={currentField} onValueChange={handleFieldChange}>
              <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operator Selection */}
          <div className="space-y-2">
            <Label htmlFor="operator">Operator</Label>
            <Select value={currentOperator} onValueChange={setCurrentOperator}>
              <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                <SelectValue placeholder="Select operator..." />
              </SelectTrigger>
              <SelectContent>
                {operatorOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value Input */}
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            {currentField === 'location' ? (
              <div className="relative">
                <Input
                  placeholder="Search locations..."
                  value={locationSearchValue}
                  onChange={(e) => {
                    setLocationSearchValue(e.target.value)
                    setShowLocationDropdown(true)
                  }}
                  onFocus={() => setShowLocationDropdown(true)}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
                {showLocationDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {locations
                      .filter(loc => 
                        loc.hierarchicalPath.toLowerCase().includes(locationSearchValue.toLowerCase())
                      )
                      .map(location => (
                        <div
                          key={location.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          onClick={() => {
                            setLocationSearchValue(location.hierarchicalPath)
                            setCurrentValue(location.name)
                            setShowLocationDropdown(false)
                          }}
                        >
                          {location.hierarchicalPath}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : fieldValues.length > 0 ? (
              <Select value={currentValue} onValueChange={setCurrentValue}>
                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                  <SelectValue placeholder="Choose value..." />
                </SelectTrigger>
                <SelectContent>
                  {fieldValues.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="value"
                placeholder="Enter value..."
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
            )}
          </div>

          {/* Logic Selection */}
          <div className="space-y-2">
            <Label htmlFor="logic">Logic</Label>
            <Select value={currentLogic} onValueChange={setCurrentLogic}>
              <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {logicOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Button */}
          <div className="space-y-2">
            <Label>&nbsp;</Label>
            <Button
              onClick={() => addCondition()}
              disabled={!currentField || !currentValue}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Conditions List */}
        {conditions.length > 0 && (
          <div className="mt-4 space-y-2">
            <Label>Added Conditions</Label>
            <div className="flex flex-wrap gap-2">
              {conditions.map((condition, index) => (
                <div key={`${condition.field}-${condition.value}-${index}`} className="flex items-center space-x-2">
                  {index > 0 && (
                    <Badge className={getLogicBadgeColor(condition.logic)}>
                      {condition.logic}
                    </Badge>
                  )}
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    <span className="font-medium">{getFieldLabel(condition.field, fieldOptions)}</span>
                    <span>{condition.operator}</span>
                    <span className="font-medium">&quot;{condition.value}&quot;</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCondition(index)}
                      className="h-4 w-4 p-0 hover:bg-blue-200"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={clearAllConditions}
            variant="outline"
            disabled={conditions.length === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear All
          </Button>
          <Button
            onClick={onPreview}
            disabled={conditions.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="h-4 w-4 mr-2" />
            Preview Results
          </Button>
          <Button
            onClick={() => savedInventories.setShowSaveModal(true)}
            variant="outline"
            disabled={conditions.length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button
            onClick={() => savedInventories.setShowLoadModal(true)}
            variant="outline"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
          </Button>
        </div>
      </div>
    </div>
  )
}
