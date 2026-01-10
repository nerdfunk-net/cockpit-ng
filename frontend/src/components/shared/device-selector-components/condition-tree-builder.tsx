import {
    ConditionTree,
    ConditionGroup as ConditionGroupType,
    ConditionItem as ConditionItemType,
    FieldOption,
    CustomField,
    LocationItem
} from '@/types/shared/device-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ConditionGroup } from './condition-group'
import { ConditionItem } from './condition-item'
import {
    Plus,
    RotateCcw,
    Settings,
    Filter,
    HelpCircle,
    ChevronLeft,
    Play,
    Save,
    FolderOpen
} from 'lucide-react'
import { createEmptyTree } from '@/hooks/shared/device-selector/use-condition-tree'

interface ConditionTreeBuilderProps {
    // Tree state
    conditionTree: ConditionTree
    setConditionTree: (tree: ConditionTree | ((prev: ConditionTree) => ConditionTree)) => void
    currentGroupPath: string[]
    setCurrentGroupPath: (path: string[]) => void
    addConditionToTree: (field: string, operator: string, value: string) => void
    addGroup: (logic: 'AND' | 'OR', negate: boolean) => void
    removeItemFromTree: (id: string) => void
    updateGroupLogic: (id: string, logic: 'AND' | 'OR') => void
    findGroupPath: (id: string) => string[] | null

    // Filter state
    currentField: string
    setCurrentField: (value: string) => void
    currentOperator: string
    setCurrentOperator: (value: string) => void
    currentValue: string
    setCurrentValue: (value: string) => void
    currentLogic: string
    setCurrentLogic: (value: string) => void
    currentNegate: boolean
    setCurrentNegate: (value: boolean) => void

    // Options
    fieldOptions: FieldOption[]
    operatorOptions: FieldOption[]
    fieldValues: FieldOption[]
    customFields: CustomField[]
    locations: LocationItem[]
    locationSearchValue: string
    setLocationSearchValue: (value: string) => void
    showLocationDropdown: boolean
    setShowLocationDropdown: (show: boolean) => void

    // Handlers
    handleFieldChange: (field: string) => void
    handleOperatorChange: (operator: string) => void
    handleCustomFieldSelect: (value: string) => void
    selectedCustomField: string

    // Loading states
    isLoadingFieldValues: boolean
    isLoadingCustomFields: boolean

    // Actions
    onPreview: () => void
    isLoadingPreview: boolean
    showActions?: boolean
    showSaveLoad?: boolean
    onOpenSaveModal: () => void
    onOpenLoadModal: () => void
    onOpenManageModal: () => void
    onShowHelp: () => void
    onShowLogicalTree: () => void
}

export function ConditionTreeBuilder({
    conditionTree,
    setConditionTree,
    currentGroupPath,
    setCurrentGroupPath,
    addConditionToTree,
    addGroup,
    removeItemFromTree,
    updateGroupLogic,
    findGroupPath,
    currentField,
    currentOperator,
    currentValue,
    setCurrentValue,
    currentLogic,
    setCurrentLogic,
    currentNegate,
    setCurrentNegate,
    fieldOptions,
    operatorOptions,
    fieldValues,
    customFields,
    locations,
    locationSearchValue,
    setLocationSearchValue,
    showLocationDropdown,
    setShowLocationDropdown,
    handleFieldChange,
    handleOperatorChange,
    handleCustomFieldSelect,
    selectedCustomField,
    isLoadingFieldValues,
    isLoadingCustomFields,
    onPreview,
    isLoadingPreview,
    showActions = true,
    showSaveLoad = true,
    onOpenSaveModal,
    onOpenLoadModal,
    onOpenManageModal,
    onShowHelp,
    onShowLogicalTree
}: ConditionTreeBuilderProps) {

    const getFieldLabel = (field: string) => {
        const option = fieldOptions.find(opt => opt.value === field)
        return option?.label || field
    }

    // Set target group for adding conditions
    const setTargetGroup = (groupId: string | null) => {
        if (groupId === null) {
            setCurrentGroupPath([])
        } else {
            const path = findGroupPath(groupId)
            if (path) {
                setCurrentGroupPath(path)
            }
        }
    }

    // Get current target display name
    const getCurrentTargetName = () => {
        if (currentGroupPath.length === 0) {
            return 'Root'
        }

        const findGroupById = (
            items: (ConditionItemType | ConditionGroupType)[],
            groupId: string
        ): ConditionGroupType | null => {
            for (const item of items) {
                if ('type' in item && item.type === 'group') {
                    if (item.id === groupId) {
                        return item as ConditionGroupType
                    }
                    const found = findGroupById(item.items, groupId)
                    if (found) return found
                }
            }
            return null
        }

        // Find the actual group to get its logic type
        const targetGroupId = currentGroupPath[currentGroupPath.length - 1]
        if (!targetGroupId) {
            return `Group ${currentGroupPath.length}`
        }

        const group = findGroupById(conditionTree.items, targetGroupId)
        if (group) {
            return `Group (${group.internalLogic})`
        }

        return `Group ${currentGroupPath.length}`
    }

    // Helper to check if an item is at root level
    const isItemAtRootLevel = (itemId: string): boolean => {
        return conditionTree.items.some(item => item.id === itemId)
    }

    return (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Device Filter</span>
                </div>
                <button
                    onClick={onShowHelp}
                    className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 px-2.5 py-1 rounded transition-colors"
                    title="Show help and examples"
                >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Help</span>
                </button>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
                {/* Target Location Indicator */}
                <div className="mb-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium text-blue-900">Adding conditions to:</span>
                        <Badge variant="outline" className="bg-white">
                            {getCurrentTargetName()}
                        </Badge>
                    </div>
                    {currentGroupPath.length > 0 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setTargetGroup(null)}
                            className="h-7 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                        >
                            <ChevronLeft className="h-3 w-3 mr-1" />
                            Back to Root
                        </Button>
                    )}
                </div>

                <div className={`grid grid-cols-1 gap-4 ${currentField === 'custom_fields' || selectedCustomField ? 'md:grid-cols-[1fr_1fr_1fr_2fr_1fr_auto]' : 'md:grid-cols-[1fr_1fr_2fr_1fr_auto]'}`}>
                    {/* Field Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="field">Field</Label>
                        <Select value={currentField === 'custom_fields' || selectedCustomField ? 'custom_fields' : currentField} onValueChange={handleFieldChange}>
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

                    {/* Custom Field Selection - shown when 'custom_fields' is selected */}
                    {(currentField === 'custom_fields' || selectedCustomField) && (
                        <div className="space-y-2">
                            <Label htmlFor="custom-field">Custom Field</Label>
                            <Select value={selectedCustomField} onValueChange={handleCustomFieldSelect} disabled={isLoadingCustomFields}>
                                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                                    <SelectValue placeholder={isLoadingCustomFields ? "Loading..." : "Select custom field..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {customFields.map(field => (
                                        <SelectItem key={field.name} value={`cf_${String(field.name)}`}>
                                            {String(field.label || field.name)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

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
                        {currentField === 'has_primary' ? (
                            <Select value={currentValue} onValueChange={setCurrentValue}>
                                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                                    <SelectValue placeholder="Select value..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="True">True</SelectItem>
                                    <SelectItem value="False">False</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : currentField === 'location' ? (
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
                                placeholder={currentField ? `Enter ${currentField}...` : 'Select a field first'}
                                value={currentValue}
                                onChange={(e) => setCurrentValue(e.target.value)}
                                disabled={!currentField || isLoadingFieldValues}
                                className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200"
                            />
                        )}
                    </div>

                    {/* Logic Selection - Split into two controls */}
                    <div className="space-y-2">
                        <Label htmlFor="logic">Connector</Label>
                        <div className="flex flex-col gap-2">
                            {/* Dropdown for AND/OR */}
                            <Select value={currentLogic} onValueChange={(val) => setCurrentLogic(val)}>
                                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                                    <SelectValue placeholder="Select connector..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AND">AND</SelectItem>
                                    <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                            </Select>
                            {/* Checkbox for Negate */}
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentNegate}
                                    onChange={(e) => setCurrentNegate(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-gray-700">Negate (NOT)</span>
                            </label>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <Label>&nbsp;</Label>
                        <div className="flex space-x-2">
                            <Button onClick={() => addConditionToTree(currentField, currentOperator, currentValue)} size="sm" title="Add Condition">
                                <Plus className="h-4 w-4" />
                            </Button>
                            <Button onClick={() => addGroup(currentLogic as 'AND' | 'OR', currentNegate)} size="sm" variant="secondary" title="Add Group">
                                <Plus className="h-4 w-4 mr-1" />
                                <span className="text-xs">Group</span>
                            </Button>
                            <Button onClick={() => setConditionTree(createEmptyTree())} variant="outline" size="sm" title="Clear All">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                                onClick={onShowLogicalTree}
                                variant="outline"
                                size="sm"
                                title="Show Logical Tree"
                                disabled={conditionTree.items.length === 0}
                                className="ml-auto"
                            >
                                <Settings className="h-4 w-4 mr-1" />
                                <span className="text-xs">Show Tree</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Tree-based Conditions Display */}
                <div className="mt-6">
                    <Label className="text-base font-medium">Logical Expression</Label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg min-h-[60px]">
                        {conditionTree.items.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">
                                No conditions added yet. Add conditions or groups above to filter devices.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {/* Root level logic indicator */}
                                <div className="text-xs text-gray-500 mb-2">
                                    Root logic: <Badge variant="outline">{conditionTree.internalLogic}</Badge>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="ml-2 h-5 text-xs"
                                        onClick={() => {
                                            setConditionTree((prev: ConditionTree) => ({
                                                ...prev,
                                                internalLogic: prev.internalLogic === 'AND' ? 'OR' : 'AND'
                                            }))
                                        }}
                                    >
                                        Toggle
                                    </Button>
                                </div>
                                {conditionTree.items.map((item, index) => (
                                    <div key={item.id}>
                                        {'type' in item && item.type === 'group' ? (
                                            <ConditionGroup
                                                group={item as ConditionGroupType}
                                                currentGroupPath={currentGroupPath}
                                                onSetTargetGroup={setTargetGroup}
                                                onUpdateLogic={updateGroupLogic}
                                                onRemove={removeItemFromTree}
                                                getFieldLabel={getFieldLabel}
                                                isFirst={index === 0}
                                                isAtRoot={true}
                                                isItemAtRootLevel={isItemAtRootLevel}
                                            />
                                        ) : (
                                            <ConditionItem
                                                item={item as ConditionItemType}
                                                onRemove={removeItemFromTree}
                                                getFieldLabel={getFieldLabel}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                {showActions && (
                    <div className="flex justify-start gap-2 mt-4">
                        <Button
                            onClick={onPreview}
                            disabled={conditionTree.items.length === 0 || isLoadingPreview}
                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white border-0"
                        >
                            <Play className="h-4 w-4" />
                            <span>{isLoadingPreview ? 'Loading...' : 'Preview Results'}</span>
                        </Button>
                        {showSaveLoad && (
                            <>
                                <Button
                                    onClick={onOpenSaveModal}
                                    disabled={conditionTree.items.length === 0}
                                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white border-0"
                                >
                                    <Save className="h-4 w-4" />
                                    <span>Save</span>
                                </Button>
                                <Button
                                    onClick={onOpenLoadModal}
                                    variant="outline"
                                    className="flex items-center space-x-2"
                                >
                                    <FolderOpen className="h-4 w-4" />
                                    <span>Load</span>
                                </Button>
                                <Button
                                    onClick={onOpenManageModal}
                                    variant="outline"
                                    className="flex items-center space-x-2 border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>Manage Inventory</span>
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
