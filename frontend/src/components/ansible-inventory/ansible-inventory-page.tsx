'use client'

import { useState, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  Play,
  RotateCcw,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Settings,
  Filter,
  FileText,
  Database,
  X,
  GitBranch
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'

interface LogicalCondition {
  field: string
  operator: string
  value: string
  logic: string
}

interface DeviceInfo {
  id: string
  name: string
  location?: string
  role?: string
  device_type?: string
  manufacturer?: string
  platform?: string
  primary_ip4?: string
  status?: string
  tags: string[]
}

interface FieldOption {
  value: string
  label: string
}

interface LocationItem {
  id: string
  name: string
  hierarchicalPath: string
  parent?: { id: string }
}

interface CustomField {
  name: string
  label: string
  type: string
}

export default function AnsibleInventoryPage() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()

  // Authentication state
  const [authReady, setAuthReady] = useState(false)

  // Condition building state
  const [conditions, setConditions] = useState<LogicalCondition[]>([])
  const [currentField, setCurrentField] = useState('')
  const [currentOperator, setCurrentOperator] = useState('equals')
  const [currentValue, setCurrentValue] = useState('')
  const [currentLogic, setCurrentLogic] = useState('AND')

  // Field options and values
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([])
  const [operatorOptions, setOperatorOptions] = useState<FieldOption[]>([])
  const [logicOptions, setLogicOptions] = useState<FieldOption[]>([])
  const [fieldValues, setFieldValues] = useState<FieldOption[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  // Location handling
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [locationSearchValue, setLocationSearchValue] = useState('')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [selectedLocationValue, setSelectedLocationValue] = useState('')

  // Preview results
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
  const [totalDevices, setTotalDevices] = useState(0)
  const [operationsExecuted, setOperationsExecuted] = useState(0)
  const [showPreviewResults, setShowPreviewResults] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Template and generation
  const [templateCategories, setTemplateCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [showTemplateSection, setShowTemplateSection] = useState(false)

  // Git repositories
  const [gitRepositories, setGitRepositories] = useState<Array<{id: number, name: string, url: string, branch: string}>>([])
  const [selectedGitRepo, setSelectedGitRepo] = useState<number | null>(null)

  // Git push success modal
  const [showGitSuccessModal, setShowGitSuccessModal] = useState(false)
  const [gitPushResult, setGitPushResult] = useState<{
    repository: string
    branch: string
    file: string
    device_count: number
    commit_message: string
  } | null>(null)

  // Inventory generation
  const [generatedInventory, setGeneratedInventory] = useState('')
  const [showInventorySection, setShowInventorySection] = useState(false)

  // Loading states
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isLoadingFieldValues, setIsLoadingFieldValues] = useState(false)
  const [isGeneratingInventory, setIsGeneratingInventory] = useState(false)
  const [isPushingToGit, setIsPushingToGit] = useState(false)

  // Custom fields menu
  const [showCustomFieldsMenu, setShowCustomFieldsMenu] = useState(false)

  // Authentication effect - simplified since DashboardLayout handles auth
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('Ansible Inventory: Authentication ready')
      setAuthReady(true)
      loadInitialData()
    }
  }, [isAuthenticated, token])

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadFieldOptions(),
        loadTemplateCategories(),
        loadGitRepositories()
      ])
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const loadFieldOptions = async () => {
    try {
      const response = await apiCall<{
        fields: FieldOption[]
        operators: FieldOption[]
        logical_operations: FieldOption[]
      }>('ansible-inventory/field-options')
      
      setFieldOptions(response.fields)
      setOperatorOptions(response.operators)
      
      // Modify logic options display labels
      const modifiedLogicOptions = response.logical_operations.map(option => {
        if (option.value === 'not') {
          return { ...option, label: '& NOT' }
        }
        return option
      })
      setLogicOptions(modifiedLogicOptions)
    } catch (error) {
      console.error('Error loading field options:', error)
    }
  }

  const loadTemplateCategories = async () => {
    try {
      const response = await apiCall<string[]>('templates/categories')
      setTemplateCategories(response)
    } catch (error) {
      console.error('Error loading template categories:', error)
    }
  }

  const loadGitRepositories = async () => {
    try {
      const response = await apiCall<{
        repositories: Array<{id: number, name: string, url: string, branch: string}>
        total: number
      }>('ansible-inventory/git-repositories')
      
      setGitRepositories(response.repositories)
    } catch (error) {
      console.error('Error loading Git repositories:', error)
      setGitRepositories([])
    }
  }

  const loadTemplatesForCategory = async (category: string) => {
    if (!category) {
      setAvailableTemplates([])
      return
    }

    try {
      const response = await apiCall<{ templates: Array<{ name: string }> }>(`templates?category=${encodeURIComponent(category)}`)
      setAvailableTemplates(response.templates.map(t => t.name))
    } catch (error) {
      console.error('Error loading templates for category:', error)
      setAvailableTemplates([])
    }
  }

  const loadCustomFields = async () => {
    try {
      const response = await apiCall<{ custom_fields: CustomField[] }>('ansible-inventory/custom-fields')
      setCustomFields(response.custom_fields)
    } catch (error) {
      console.error('Error loading custom fields:', error)
      setCustomFields([])
    }
  }

  const loadFieldValues = async (fieldName: string) => {
    if (!fieldName || fieldName === 'custom_fields') return

    setIsLoadingFieldValues(true)
    try {
      if (fieldName === 'location') {
        // Location always uses hierarchical selector with equals operator
        // Use the same endpoint as the old version
        const response = await apiCall<LocationItem[]>('nautobot/locations')
        setLocations(response)
        buildLocationHierarchy(response)
        setIsLoadingFieldValues(false)
        return
      } else {
        // Regular field values
        const response = await apiCall<{
          field: string
          values: FieldOption[]
          input_type: string
        }>(`ansible-inventory/field-values/${fieldName}`)
        setFieldValues(response.values)
      }
    } catch (error) {
      console.error(`Error loading field values for ${fieldName}:`, error)
      setFieldValues([])
    } finally {
      setIsLoadingFieldValues(false)
    }
  }

  const buildLocationHierarchy = (locationData: LocationItem[]) => {
    // Build hierarchical paths for locations
    const locationMap = new Map(locationData.map(loc => [loc.id, loc]))
    
    locationData.forEach(location => {
      const path: string[] = []
      let current: LocationItem | null = location
      
      while (current) {
        path.unshift(current.name)
        if (current.parent?.id) {
          current = locationMap.get(current.parent.id) || null
        } else {
          current = null
        }
      }
      
      location.hierarchicalPath = path.join(' → ')
    })

    // Sort by hierarchical path
    locationData.sort((a, b) => a.hierarchicalPath.localeCompare(b.hierarchicalPath))
    setLocations(locationData)
  }

  const handleFieldChange = async (fieldName: string) => {
    setCurrentField(fieldName)
    setCurrentValue('')
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])

    if (fieldName === 'custom_fields') {
      await loadCustomFields()
      setShowCustomFieldsMenu(true)
      return
    }

    // Update operator options based on field
    updateOperatorOptions(fieldName)

    if (fieldName) {
      await loadFieldValues(fieldName)
    }
  }

  const handleOperatorChange = async (operator: string) => {
    setCurrentOperator(operator)
    
    // Note: Location field only supports 'equals' operator, so no special handling needed
    // Other fields might need special handling when operator changes
  }

  const updateOperatorOptions = (fieldName: string) => {
    const restrictedFields = ['role', 'tag', 'device_type', 'manufacturer', 'platform', 'location']
    const isCustomField = fieldName && fieldName.startsWith('cf_')

    if (restrictedFields.includes(fieldName)) {
      // Only allow "equals" for dropdown fields (including location)
      setOperatorOptions([{ value: 'equals', label: 'Equals' }])
      setCurrentOperator('equals')
    } else if (isCustomField || fieldName === 'name') {
      // Custom fields and name support both equals and contains
      setOperatorOptions([
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' }
      ])
    } else {
      // Default: all operators available
      setOperatorOptions([
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' }
      ])
    }
  }

  const addCondition = () => {
    if (!currentField || !currentValue) {
      alert('Please select a field and enter a value.')
      return
    }

    const condition: LogicalCondition = {
      field: currentField,
      operator: currentOperator,
      value: currentValue,
      logic: currentLogic
    }

    setConditions([...conditions, condition])
    
    // Reset form
    setCurrentField('')
    setCurrentOperator('equals')
    setCurrentValue('')
    setCurrentLogic('AND')
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])
  }

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index)
    setConditions(newConditions)
    
    if (newConditions.length === 0) {
      setShowPreviewResults(false)
      setShowTemplateSection(false)
      setShowInventorySection(false)
    }
  }

  const clearAllConditions = () => {
    setConditions([])
    setCurrentField('')
    setCurrentOperator('equals')
    setCurrentValue('')
    setCurrentLogic('AND')
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])
    setPreviewDevices([])
    setTotalDevices(0)
    setOperationsExecuted(0)
    setShowPreviewResults(false)
    setShowTemplateSection(false)
    setShowInventorySection(false)
  }

  const buildOperationsFromConditions = () => {
    if (conditions.length === 0) return []

    if (conditions.length === 1) {
      return [{
        operation_type: 'AND',
        conditions: [{
          field: conditions[0].field,
          operator: conditions[0].operator,
          value: conditions[0].value
        }],
        nested_operations: []
      }]
    }

    // Group conditions by logic operator
    const andConditions: Array<{field: string, operator: string, value: string}> = []
    const orConditions: Array<{field: string, operator: string, value: string}> = []
    const notConditions: Array<{field: string, operator: string, value: string}> = []

    conditions.forEach((condition, index) => {
      const conditionData = {
        field: condition.field,
        operator: condition.operator,
        value: condition.value
      }

      if (index === 0) {
        andConditions.push(conditionData)
      } else {
        switch (condition.logic) {
          case 'AND':
            andConditions.push(conditionData)
            break
          case 'OR':
            orConditions.push(conditionData)
            break
          case 'NOT':
            notConditions.push(conditionData)
            break
        }
      }
    })

    const operations = []

    // Add OR operation if we have OR conditions
    if (orConditions.length > 0) {
      operations.push({
        operation_type: 'OR',
        conditions: [...andConditions, ...orConditions],
        nested_operations: []
      })
    } else if (andConditions.length > 0) {
      operations.push({
        operation_type: 'AND',
        conditions: andConditions,
        nested_operations: []
      })
    }

    // Add NOT operations
    notConditions.forEach(condition => {
      operations.push({
        operation_type: 'NOT',
        conditions: [condition],
        nested_operations: []
      })
    })

    return operations
  }

  const previewResults = async () => {
    if (conditions.length === 0) {
      alert('Please add at least one condition.')
      return
    }

    setIsLoadingPreview(true)
    try {
      const operations = buildOperationsFromConditions()
      const response = await apiCall<{
        devices: DeviceInfo[]
        total_count: number
        operations_executed: number
      }>('ansible-inventory/preview', {
        method: 'POST',
        body: { operations }
      })

      setPreviewDevices(response.devices)
      setTotalDevices(response.total_count)
      setOperationsExecuted(response.operations_executed)
      setShowPreviewResults(true)
      setShowTemplateSection(true)
      setCurrentPage(1)
    } catch (error) {
      console.error('Error previewing results:', error)
      alert('Error previewing results: ' + (error as Error).message)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const generateInventory = async () => {
    if (!selectedCategory || !selectedTemplate) {
      alert('Please select both template category and name.')
      return
    }

    setIsGeneratingInventory(true)
    try {
      const operations = buildOperationsFromConditions()
      const response = await apiCall<{
        inventory_content: string
        template_used: string
        device_count: number
      }>('ansible-inventory/generate', {
        method: 'POST',
        body: {
          operations,
          template_name: selectedTemplate,
          template_category: selectedCategory
        }
      })

      setGeneratedInventory(response.inventory_content)
      setShowInventorySection(true)
    } catch (error) {
      console.error('Error generating inventory:', error)
      alert('Error generating inventory: ' + (error as Error).message)
    } finally {
      setIsGeneratingInventory(false)
    }
  }

  const downloadInventory = async () => {
    if (!selectedCategory || !selectedTemplate) {
      alert('Please select both template category and name.')
      return
    }

    try {
      const operations = buildOperationsFromConditions()
      
      // Use fetch for file download
      const response = await fetch('/api/proxy/ansible-inventory/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          operations,
          template_name: selectedTemplate,
          template_category: selectedCategory
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'inventory.yaml'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      console.error('Error downloading inventory:', error)
      alert('Error downloading inventory: ' + (error as Error).message)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedInventory)
      alert('Inventory copied to clipboard!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      alert('Failed to copy to clipboard')
    }
  }

  const pushToGit = async () => {
    if (!selectedCategory || !selectedTemplate) {
      alert('Please select both template category and name.')
      return
    }

    if (!selectedGitRepo) {
      alert('Please select a Git repository.')
      return
    }

    setIsPushingToGit(true)
    try {
      const operations = buildOperationsFromConditions()
      
      const response = await apiCall<{
        success: boolean
        message: string
        repository: string
        branch: string
        file: string
        device_count: number
        commit_message: string
      }>('ansible-inventory/push-to-git', {
        method: 'POST',
        body: {
          operations,
          template_name: selectedTemplate,
          template_category: selectedCategory,
          repository_id: selectedGitRepo
        }
      })

      if (response.success) {
        // Store result and show modal
        setGitPushResult({
          repository: response.repository,
          branch: response.branch,
          file: response.file,
          device_count: response.device_count,
          commit_message: response.commit_message
        })
        setShowGitSuccessModal(true)
        
        // Also show the generated inventory in the UI
        setShowInventorySection(true)
        
        // If inventory wasn't generated yet, fetch it for display
        if (!generatedInventory) {
          const inventoryResponse = await apiCall<{
            inventory_content: string
            template_used: string
            device_count: number
          }>('ansible-inventory/generate', {
            method: 'POST',
            body: {
              operations,
              template_name: selectedTemplate,
              template_category: selectedCategory
            }
          })
          setGeneratedInventory(inventoryResponse.inventory_content)
        }
      }
    } catch (error) {
      console.error('Error pushing to Git:', error)
      alert('Error pushing to Git: ' + (error as Error).message)
    } finally {
      setIsPushingToGit(false)
    }
  }

  const getFieldLabel = (field: string) => {
    const option = fieldOptions.find(opt => opt.value === field)
    return option?.label || field
  }

  const getLogicBadgeColor = (logic: string) => {
    switch (logic) {
      case 'AND': return 'bg-green-100 text-green-800'
      case 'OR': return 'bg-yellow-100 text-yellow-800'
      case 'AND NOT': return 'bg-red-100 text-red-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'planned': return 'bg-blue-100 text-blue-800'
      case 'staged': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'offline': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const formatDeviceValue = (value: string | undefined) => {
    return value || 'N/A'
  }

  // Pagination calculations
  const totalPages = Math.ceil(previewDevices.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, previewDevices.length)
  const currentPageDevices = previewDevices.slice(startIndex, endIndex)

  // Loading state while authentication is being established
  if (!authReady) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              Loading Ansible Inventory Builder
            </CardTitle>
            <CardDescription>
              Establishing authentication and initializing inventory tools...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ansible Inventory Builder</h1>
          <p className="text-gray-600">Build dynamic Ansible inventories using logical operations</p>
        </div>
      </div>

      {/* Condition Builder */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Logical Operations</span>
          </div>
          <div className="text-xs text-blue-100">
            Add conditions to filter devices. Use logical operators to combine multiple conditions.
          </div>
        </div>
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
              <Select value={currentOperator} onValueChange={handleOperatorChange}>
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
                              setSelectedLocationValue(location.name)
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
                  placeholder={currentField ? `Enter ${currentField}...` : 'Select a field first'}
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  disabled={!currentField || isLoadingFieldValues}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200"
                />
              )}
            </div>

            {/* Logic Selection */}
            <div className="space-y-2">
              <Label htmlFor="logic">Logic</Label>
              <Select value={currentLogic} onValueChange={setCurrentLogic}>
                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                  <SelectValue placeholder="Select logic..." />
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

            {/* Action Buttons */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex space-x-2">
                <Button onClick={addCondition} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button onClick={clearAllConditions} variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Current Conditions Display */}
          <div className="mt-6">
            <Label className="text-base font-medium">Current Conditions</Label>
            <div className="mt-2 p-4 bg-gray-50 rounded-lg min-h-[60px]">
              {conditions.length === 0 ? (
                <p className="text-gray-500 text-sm italic">
                  No conditions added yet. Add conditions above to build your inventory filter.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {conditions.map((condition, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      {index > 0 && (
                        <Badge className={getLogicBadgeColor(condition.logic)}>
                          {condition.logic}
                        </Badge>
                      )}
                      <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        <span className="font-medium">{getFieldLabel(condition.field)}</span>
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
              )}
            </div>
          </div>

          {/* Preview Button */}
          <div className="flex justify-start">
            <Button
              onClick={previewResults}
              disabled={conditions.length === 0 || isLoadingPreview}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white border-0"
            >
              <Play className="h-4 w-4" />
              <span>{isLoadingPreview ? 'Loading...' : 'Preview Results'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Results */}
      {showPreviewResults && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Preview Results</span>
            </div>
            <div className="text-xs text-blue-100">
              {totalDevices} devices found ({operationsExecuted} queries executed)
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Device Type</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPageDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">
                        {formatDeviceValue(device.name)}
                      </TableCell>
                      <TableCell>{formatDeviceValue(device.location)}</TableCell>
                      <TableCell>{formatDeviceValue(device.role)}</TableCell>
                      <TableCell>{formatDeviceValue(device.device_type)}</TableCell>
                      <TableCell>{formatDeviceValue(device.platform)}</TableCell>
                      <TableCell>{formatDeviceValue(device.primary_ip4)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(device.status || '')}>
                          {formatDeviceValue(device.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {device.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="pageSize" className="text-sm">Show:</Label>
                  <Select value={pageSize.toString()} onValueChange={(value) => {
                    setPageSize(parseInt(value))
                    setCurrentPage(1)
                  }}>
                    <SelectTrigger className="w-20 border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {endIndex} of {previewDevices.length} entries
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Selection */}
      {showTemplateSection && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Template Selection and Final Generation</span>
            </div>
            <div className="text-xs text-blue-100">
              Select a Jinja2 template to generate the final Ansible inventory.
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div className="grid grid-cols-1 gap-4">
              {/* First row: All selections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Template Category</Label>
                  <Select value={selectedCategory} onValueChange={(value) => {
                    setSelectedCategory(value)
                    setSelectedTemplate('')
                    loadTemplatesForCategory(value)
                  }}>
                    <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                      <SelectValue placeholder="Select Category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templateCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template">Template Name</Label>
                  <Select 
                    value={selectedTemplate} 
                    onValueChange={setSelectedTemplate}
                    disabled={!selectedCategory}
                  >
                    <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                      <SelectValue placeholder="Select Template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map(template => (
                        <SelectItem key={template} value={template}>
                          {template}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitRepo">Git Repository</Label>
                  <Select 
                    value={selectedGitRepo?.toString() || ''} 
                    onValueChange={(value) => setSelectedGitRepo(parseInt(value))}
                  >
                    <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                      <SelectValue placeholder="Select Repository..." />
                    </SelectTrigger>
                    <SelectContent>
                      {gitRepositories.length === 0 ? (
                        <SelectItem value="none" disabled>No repositories configured</SelectItem>
                      ) : (
                        gitRepositories.map(repo => (
                          <SelectItem key={repo.id} value={repo.id.toString()}>
                            {repo.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Second row: All action buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <Button
                    onClick={generateInventory}
                    disabled={!selectedCategory || !selectedTemplate || isGeneratingInventory}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white w-full"
                  >
                    <Settings className="h-4 w-4" />
                    <span>{isGeneratingInventory ? 'Creating...' : 'Create Inventory'}</span>
                  </Button>
                </div>

                <div>
                  <Button
                    onClick={pushToGit}
                    disabled={!selectedCategory || !selectedTemplate || !selectedGitRepo || isPushingToGit}
                    variant="outline"
                    className="flex items-center space-x-2 w-full border-2 border-blue-500 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400"
                  >
                    <GitBranch className="h-4 w-4" />
                    <span>{isPushingToGit ? 'Pushing...' : 'Push to Git'}</span>
                  </Button>
                </div>

                <div>
                  <Button
                    onClick={downloadInventory}
                    disabled={!selectedCategory || !selectedTemplate}
                    variant="outline"
                    className="flex items-center space-x-2 w-full"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Inventory */}
      {showInventorySection && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Generated Inventory</span>
            </div>
            <div className="text-xs text-blue-100">
              Final inventory ({previewDevices.length} devices) generated using {selectedCategory}/{selectedTemplate}
            </div>
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30 flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </Button>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <Textarea
              value={generatedInventory}
              readOnly
              className="font-mono text-sm min-h-[400px] resize-none"
              style={{ fontFamily: 'Courier New, monospace' }}
            />
          </div>
        </div>
      )}

      {/* Custom Fields Menu */}
      {showCustomFieldsMenu && (
        <Dialog open={showCustomFieldsMenu} onOpenChange={setShowCustomFieldsMenu}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Custom Fields</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {customFields.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No custom fields available</p>
              ) : (
                customFields.map((field) => (
                  <div
                    key={field.name}
                    className="p-2 hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => {
                      setCurrentField(`cf_${field.name}`)
                      setShowCustomFieldsMenu(false)
                    }}
                  >
                    <div className="font-medium">{field.label}</div>
                    <div className="text-sm text-gray-600">{field.type}</div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Git Push Success Modal */}
      {showGitSuccessModal && gitPushResult && (
        <Dialog open={showGitSuccessModal} onOpenChange={setShowGitSuccessModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <GitBranch className="h-5 w-5" />
                </div>
                Successfully Pushed to Git
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="text-sm font-medium text-gray-500 w-24 flex-shrink-0">Repository:</div>
                  <div className="text-sm font-medium text-gray-900">{gitPushResult.repository}</div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-sm font-medium text-gray-500 w-24 flex-shrink-0">Branch:</div>
                  <div className="text-sm text-gray-900">{gitPushResult.branch}</div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-sm font-medium text-gray-500 w-24 flex-shrink-0">File:</div>
                  <div className="text-sm text-gray-900">{gitPushResult.file}</div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-sm font-medium text-gray-500 w-24 flex-shrink-0">Devices:</div>
                  <div className="text-sm text-gray-900">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {gitPushResult.device_count}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="text-sm font-medium text-gray-500 mb-2">Commit Message:</div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <code className="text-sm text-gray-800 break-words whitespace-pre-wrap">
                    {gitPushResult.commit_message}
                  </code>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setShowGitSuccessModal(false)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
