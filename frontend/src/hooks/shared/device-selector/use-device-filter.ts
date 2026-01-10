import { useState, useCallback, useEffect } from 'react'
import { FieldOption, CustomField, LocationItem } from '@/types/shared/device-selector'
import { useApi } from '@/hooks/use-api'

export function useDeviceFilter() {
    const { apiCall } = useApi()

    // Current input state for adding new conditions
    const [currentField, setCurrentField] = useState('')
    const [currentOperator, setCurrentOperator] = useState('equals')
    const [currentValue, setCurrentValue] = useState('')
    const [currentLogic, setCurrentLogic] = useState('AND')
    const [currentNegate, setCurrentNegate] = useState(false)

    // Field options and values
    const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([])
    const [operatorOptions, setOperatorOptions] = useState<FieldOption[]>([])
    const [fieldValues, setFieldValues] = useState<FieldOption[]>([])
    const [customFields, setCustomFields] = useState<CustomField[]>([])

    // Location handling
    const [locations, setLocations] = useState<LocationItem[]>([])
    const [locationSearchValue, setLocationSearchValue] = useState('')
    const [showLocationDropdown, setShowLocationDropdown] = useState(false)
    const [selectedLocationValue, setSelectedLocationValue] = useState('')

    // Loading states
    const [isLoadingFieldValues, setIsLoadingFieldValues] = useState(false)
    const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false)

    // Selected custom field (when 'custom_fields' is chosen as field type)
    const [selectedCustomField, setSelectedCustomField] = useState('')

    const loadFieldOptions = useCallback(async () => {
        try {
            const response = await apiCall<{
                fields: FieldOption[]
                operators: FieldOption[]
                logical_operations: FieldOption[]
            }>('inventory/field-options')

            setFieldOptions(response.fields)
            setOperatorOptions(response.operators)
        } catch (error) {
            console.error('Error loading field options:', error)
        }
    }, [apiCall])

    useEffect(() => {
        loadFieldOptions()
    }, [loadFieldOptions])

    const buildLocationHierarchy = (locationData: LocationItem[]) => {
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

        locationData.sort((a, b) => a.hierarchicalPath.localeCompare(b.hierarchicalPath))
        setLocations(locationData)
    }

    const loadFieldValues = async (fieldName: string) => {
        if (!fieldName || fieldName === 'custom_fields' || fieldName === 'has_primary') return

        setIsLoadingFieldValues(true)
        try {
            if (fieldName === 'location') {
                const response = await apiCall<LocationItem[]>('nautobot/locations')
                setLocations(response)
                buildLocationHierarchy(response)
                setIsLoadingFieldValues(false)
                return
            } else {
                const response = await apiCall<{
                    field: string
                    values: FieldOption[]
                    input_type: string
                }>(`inventory/field-values/${fieldName}`)
                setFieldValues(response.values)
            }
        } catch (error) {
            console.error(`Error loading field values for ${fieldName}:`, error)
            setFieldValues([])
        } finally {
            setIsLoadingFieldValues(false)
        }
    }

    const loadCustomFields = async () => {
        try {
            const response = await apiCall<{ custom_fields: CustomField[] }>('inventory/custom-fields')
            setCustomFields(response.custom_fields)
        } catch (error) {
            console.error('Error loading custom fields:', error)
            setCustomFields([])
        }
    }

    const updateOperatorOptions = (fieldName: string) => {
        const restrictedFields = ['role', 'device_type', 'manufacturer', 'platform', 'has_primary']
        const isCustomField = fieldName && fieldName.startsWith('cf_')

        if (restrictedFields.includes(fieldName)) {
            setOperatorOptions([{ value: 'equals', label: 'Equals' }])
            setCurrentOperator('equals')
        } else if (fieldName === 'location' || fieldName === 'tag') {
            // Location and Tag support equals and not_equals
            setOperatorOptions([
                { value: 'equals', label: 'Equals' },
                { value: 'not_equals', label: 'Not Equals' }
            ])
        } else if (isCustomField || fieldName === 'name') {
            setOperatorOptions([
                { value: 'equals', label: 'Equals' },
                { value: 'contains', label: 'Contains' }
            ])
        } else {
            setOperatorOptions([
                { value: 'equals', label: 'Equals' },
                { value: 'contains', label: 'Contains' }
            ])
        }
    }

    const handleFieldChange = async (fieldName: string) => {
        setCurrentField(fieldName)
        setCurrentValue('')
        setLocationSearchValue('')
        setSelectedLocationValue('')
        setFieldValues([])
        setSelectedCustomField('')

        if (fieldName === 'custom_fields') {
            // Load custom fields for the inline dropdown
            setIsLoadingCustomFields(true)
            await loadCustomFields()
            setIsLoadingCustomFields(false)
            return
        }

        updateOperatorOptions(fieldName)

        if (fieldName) {
            await loadFieldValues(fieldName)
        }
    }

    const handleCustomFieldSelect = async (customFieldValue: string) => {
        setSelectedCustomField(customFieldValue)
        // Set the actual field to the cf_ prefixed value
        setCurrentField(customFieldValue)
        setCurrentValue('')
        setFieldValues([])
        updateOperatorOptions(customFieldValue)

        // Load field values - for 'select' type custom fields, this will return the available choices
        if (customFieldValue) {
            await loadFieldValues(customFieldValue)
        }
    }

    const handleOperatorChange = (operator: string) => {
        setCurrentOperator(operator)
    }

    return {
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
        loadFieldValues // Needed if we want to manually trigger value reload
    }
}
