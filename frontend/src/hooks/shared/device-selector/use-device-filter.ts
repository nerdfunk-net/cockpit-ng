import { useState, useMemo, useCallback } from 'react'
import { FieldOption, LocationItem } from '@/types/shared/device-selector'
import {
    useInventoryFieldOptionsQuery,
    useInventoryFieldValuesQuery,
    useInventoryCustomFieldsQuery,
    useNautobotLocationsQuery
} from '@/hooks/queries/use-inventory-queries'

export function useDeviceFilter() {
    // Current input state for adding new conditions
    const [currentField, setCurrentField] = useState('')
    const [currentOperator, setCurrentOperator] = useState('equals')
    const [currentValue, setCurrentValue] = useState('')
    const [currentLogic, setCurrentLogic] = useState('AND')
    const [currentNegate, setCurrentNegate] = useState(false)

    // Operator options override (for specific fields)
    const [operatorOptionsOverride, setOperatorOptionsOverride] = useState<FieldOption[] | null>(null)

    // Location handling
    const [locationSearchValue, setLocationSearchValue] = useState('')
    const [showLocationDropdown, setShowLocationDropdown] = useState(false)
    const [selectedLocationValue, setSelectedLocationValue] = useState('')

    // Selected custom field (when 'custom_fields' is chosen as field type)
    const [selectedCustomField, setSelectedCustomField] = useState('')

    // Control when to load custom fields and locations
    const [loadCustomFields, setLoadCustomFields] = useState(false)
    const [loadLocations, setLoadLocations] = useState(false)
    const [fieldNameToLoad, setFieldNameToLoad] = useState<string | null>(null)

    // Use TanStack Query for field options
    const { data: fieldOptionsData } = useInventoryFieldOptionsQuery()

    // Use TanStack Query for custom fields (load on demand)
    const { data: customFieldsData, isLoading: isLoadingCustomFields } = useInventoryCustomFieldsQuery(loadCustomFields)

    // Use TanStack Query for locations (load on demand)
    const { data: locationsData } = useNautobotLocationsQuery(loadLocations)

    // Use TanStack Query for field values (load on demand)
    const { data: fieldValuesData, isLoading: isLoadingFieldValues } = useInventoryFieldValuesQuery(fieldNameToLoad)

    // Extract data from queries and derive state - memoize to prevent new arrays on every render
    const fieldOptions = useMemo(() => fieldOptionsData?.fields || [], [fieldOptionsData?.fields])
    const customFields = useMemo(() => customFieldsData?.custom_fields || [], [customFieldsData?.custom_fields])
    const fieldValues = useMemo(() => fieldValuesData?.values || [], [fieldValuesData?.values])

    // Derive operator options from field options or override
    const operatorOptions = useMemo(() => {
        return operatorOptionsOverride || fieldOptionsData?.operators || []
    }, [operatorOptionsOverride, fieldOptionsData?.operators])

    // Build location hierarchy with useMemo to avoid recalculating on every render
    const locations = useMemo(() => {
        if (!locationsData) return []

        const locationMap = new Map(locationsData.map(loc => [loc.id, loc]))

        locationsData.forEach(location => {
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

        return [...locationsData].sort((a, b) => a.hierarchicalPath.localeCompare(b.hierarchicalPath))
    }, [locationsData])

    // Helper function to update operator options based on field type
    const updateOperatorOptions = useCallback((fieldName: string) => {
        const restrictedFields = ['role', 'device_type', 'manufacturer', 'platform', 'has_primary']
        const isCustomField = fieldName && fieldName.startsWith('cf_')

        if (restrictedFields.includes(fieldName)) {
            setOperatorOptionsOverride([{ value: 'equals', label: 'Equals' }])
            setCurrentOperator('equals')
        } else if (fieldName === 'location' || fieldName === 'tag') {
            // Location and Tag support equals and not_equals
            setOperatorOptionsOverride([
                { value: 'equals', label: 'Equals' },
                { value: 'not_equals', label: 'Not Equals' }
            ])
        } else if (isCustomField || fieldName === 'name') {
            setOperatorOptionsOverride([
                { value: 'equals', label: 'Equals' },
                { value: 'contains', label: 'Contains' }
            ])
        } else {
            setOperatorOptionsOverride(null) // Reset to default from field options
        }
    }, [])

    const handleFieldChange = useCallback(async (fieldName: string) => {
        setCurrentField(fieldName)
        setCurrentValue('')
        setLocationSearchValue('')
        setSelectedLocationValue('')
        setSelectedCustomField('')

        if (fieldName === 'custom_fields') {
            // Trigger custom fields query
            setLoadCustomFields(true)
            return
        }

        updateOperatorOptions(fieldName)

        if (fieldName === 'location') {
            // Trigger locations query
            setLoadLocations(true)
        } else if (fieldName && fieldName !== 'has_primary') {
            // Trigger field values query
            setFieldNameToLoad(fieldName)
        }
    }, [updateOperatorOptions]) // Add updateOperatorOptions to dependencies

    const handleCustomFieldSelect = useCallback((customFieldName: string) => {
        // customFieldName already has 'cf_' prefix from SelectItem value in condition-tree-builder.tsx
        // Extract the actual custom field name without prefix for display
        const actualFieldName = customFieldName.replace(/^cf_/, '')
        setSelectedCustomField(actualFieldName)
        // Use the value as-is (already has cf_ prefix)
        setCurrentField(customFieldName)
        setCurrentValue('')
        updateOperatorOptions(customFieldName)

        // Load field values - for 'select' type custom fields, this will return the available choices
        if (customFieldName) {
            setFieldNameToLoad(customFieldName)
        }
    }, [updateOperatorOptions]) // Add updateOperatorOptions to dependencies

    const handleOperatorChange = useCallback((operator: string) => {
        setCurrentOperator(operator)
    }, [])

    return useMemo(() => ({
        currentField,
        setCurrentField,
        currentOperator,
        setCurrentOperator,
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
        selectedLocationValue,
        setSelectedLocationValue,
        isLoadingFieldValues,
        isLoadingCustomFields,
        selectedCustomField,
        handleFieldChange,
        handleCustomFieldSelect,
        handleOperatorChange,
    }), [
        currentField,
        currentOperator,
        currentValue,
        currentLogic,
        currentNegate,
        fieldOptions,
        operatorOptions,
        fieldValues,
        customFields,
        locations,
        locationSearchValue,
        showLocationDropdown,
        selectedLocationValue,
        isLoadingFieldValues,
        isLoadingCustomFields,
        selectedCustomField,
        handleFieldChange,
        handleCustomFieldSelect,
        handleOperatorChange,
    ])
}
