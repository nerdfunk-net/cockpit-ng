'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useCsvUpload } from './use-csv-upload'
import { useFilterPagination } from './use-filter-pagination'
import { useFieldMappingQuery } from '@/hooks/queries/use-field-mapping-query'
import { useFieldMappingMutations } from '@/hooks/queries/use-field-mapping-mutations'
import { useNetworkDefaultsQuery } from '@/components/features/settings/common/hooks/use-network-defaults-query'
import {
  buildAutoFieldMapping,
  CSV_UPDATE_APP_NAME,
  LOOKUP_COLUMN_MAPPING_KEY,
  USE_NEW_MAPPING_KEY,
  USE_DEFAULT_PROPERTIES_KEY,
  PRIMARY_IP_ENABLED_KEY,
} from '../constants'
import { buildDeviceRows } from '../utils/device-merge'
import { buildFilterRows, sortFilterRowsByDisplayName } from '../utils/filter-rows'
import type {
  ObjectType,
  ParsedCSVData,
  MatchingStrategy,
  DefaultProperty,
  NameTransform,
  DeviceCsvRow,
  FilterRow,
} from '../types'

export type WizardStep =
  | 'upload'
  | 'configure'
  | 'properties'
  | 'filter'
  | 'preview'
  | 'processing'
  | 'summary'

export const WIZARD_STEP_ORDER: WizardStep[] = [
  'upload',
  'configure',
  'properties',
  'filter',
  'preview',
  'processing',
  'summary',
]

const EMPTY_FIELD_MAPPING: Record<string, string | null> = {}
const EMPTY_DEVICE_ROWS: DeviceCsvRow[] = []
const EMPTY_FILTER_ROWS: FilterRow[] = []
const EMPTY_DEFAULT_PROPERTIES: DefaultProperty[] = []

/** Preferred primary-key columns per object type (first match wins). */
const PRIMARY_KEY_PREFERENCES: Record<ObjectType, string[]> = {
  devices: ['name', 'id'],
  locations: ['name', 'id'],
  'ip-prefixes': ['prefix', 'id'],
  'ip-addresses': ['address', 'id'],
}

/** Network Defaults keys applied per object type, mapped onto NAUTOBOT_UPDATE_FIELDS keys. */
const DEFAULTS_FIELD_MAP: Partial<Record<ObjectType, Record<string, string>>> = {
  devices: {
    location: 'location',
    platform: 'platform',
    device_status: 'status',
    device_role: 'role',
    interface_status: 'interface_status',
    interface_type: 'interface_type',
  },
  'ip-prefixes': {
    namespace: 'namespace',
    ip_prefix_status: 'status',
  },
  'ip-addresses': {
    namespace: 'namespace',
    ip_address_status: 'status',
  },
}

function detectPrimaryKey(headers: string[], type: ObjectType): string {
  const preferred = PRIMARY_KEY_PREFERENCES[type] ?? []
  return preferred.find(col => headers.includes(col)) ?? headers[0] ?? ''
}

/** Applies a saved mapping to the current headers; unknown headers stay unmapped. */
function applyStoredMapping(
  headers: string[],
  stored: Record<string, string | null>
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}
  for (const header of headers) {
    if (header === LOOKUP_COLUMN_MAPPING_KEY) continue
    mapping[header] = stored[header] ?? null
  }
  return mapping
}

export function useCsvWizard() {
  const [history, setHistory] = useState<WizardStep[]>(['upload'])
  const [objectType, setObjectType] = useState<ObjectType>('devices')

  // Single mapping: CSV column → Nautobot field name (null = not used)
  const [fieldMapping, setFieldMapping] =
    useState<Record<string, string | null>>(EMPTY_FIELD_MAPPING)

  const [primaryKeyColumn, setPrimaryKeyColumn] = useState<string>('')
  const [tagsMode, setTagsMode] = useState<'replace' | 'merge'>('replace')
  const [matchingStrategy, setMatchingStrategy] = useState<MatchingStrategy>('exact')
  const [defaultProperties, setDefaultProperties] = useState<DefaultProperty[]>([])
  const [nameTransform, setNameTransform] = useState<NameTransform | null>(null)
  const [rackLocationColumn, setRackLocationColumn] = useState<string | null>(null)

  const [taskId, setTaskId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const [dryRunTaskId, setDryRunTaskId] = useState<string | null>(null)

  const [useNewMapping, setUseNewMappingState] = useState(false)
  const [useDefaultProperties, setUseDefaultPropertiesState] = useState(true)
  const [primaryIpEnabled, setPrimaryIpEnabledState] = useState(false)
  const [configureSkippable, setConfigureSkippable] = useState(false)
  const [checkboxesHydrated, setCheckboxesHydrated] = useState(false)

  const [rowFilter, setRowFilter] = useState('')
  const [selectedOverrides, setSelectedOverrides] = useState<Record<string, boolean>>({})
  const [primaryIpByDevice, setPrimaryIpByDevice] = useState<Record<string, string | null>>(
    {}
  )

  const { data: storedMapping } = useFieldMappingQuery(CSV_UPDATE_APP_NAME)
  const { saveFieldMapping } = useFieldMappingMutations()
  const { data: networkDefaults } = useNetworkDefaultsQuery({
    enabled: useDefaultProperties,
  })

  /**
   * In-memory mirror of the last-known-good saved mapping blob. Writes go
   * through this ref (updated synchronously) rather than merging against the
   * async query cache, so two checkbox toggles fired in quick succession each
   * build on the other's change instead of racing and clobbering it — the
   * query cache only updates after a round trip, which is too slow to rely on
   * as a merge source between back-to-back clicks.
   */
  const mappingBlobRef = useRef<Record<string, string | null>>({})

  useEffect(() => {
    if (storedMapping) {
      mappingBlobRef.current = storedMapping
    }
  }, [storedMapping])

  // Hydrate the step-1 checkboxes from the saved mapping blob once, on first load.
  useEffect(() => {
    if (checkboxesHydrated || !storedMapping) return
    if (storedMapping[USE_NEW_MAPPING_KEY] !== undefined) {
      setUseNewMappingState(storedMapping[USE_NEW_MAPPING_KEY] === 'true')
    }
    if (storedMapping[USE_DEFAULT_PROPERTIES_KEY] !== undefined) {
      setUseDefaultPropertiesState(storedMapping[USE_DEFAULT_PROPERTIES_KEY] === 'true')
    }
    if (storedMapping[PRIMARY_IP_ENABLED_KEY] !== undefined) {
      setPrimaryIpEnabledState(storedMapping[PRIMARY_IP_ENABLED_KEY] === 'true')
    }
    setCheckboxesHydrated(true)
  }, [storedMapping, checkboxesHydrated])

  /** Persists a single step-1 checkbox value alongside the rest of the saved mapping blob. */
  const persistCheckbox = useCallback(
    (key: string, value: boolean) => {
      const next = { ...mappingBlobRef.current, [key]: value ? 'true' : 'false' }
      mappingBlobRef.current = next
      saveFieldMapping.mutate({ appName: CSV_UPDATE_APP_NAME, mapping: next })
    },
    [saveFieldMapping]
  )

  const setUseNewMapping = useCallback(
    (value: boolean) => {
      setUseNewMappingState(value)
      persistCheckbox(USE_NEW_MAPPING_KEY, value)
    },
    [persistCheckbox]
  )

  const setUseDefaultProperties = useCallback(
    (value: boolean) => {
      setUseDefaultPropertiesState(value)
      persistCheckbox(USE_DEFAULT_PROPERTIES_KEY, value)
    },
    [persistCheckbox]
  )

  const setPrimaryIpEnabled = useCallback(
    (value: boolean) => {
      setPrimaryIpEnabledState(value)
      persistCheckbox(PRIMARY_IP_ENABLED_KEY, value)
    },
    [persistCheckbox]
  )

  const onParseComplete = useCallback(
    (data: ParsedCSVData) => {
      if (!useNewMapping && storedMapping) {
        const storedLookupColumn = storedMapping[LOOKUP_COLUMN_MAPPING_KEY]
        const isValid =
          typeof storedLookupColumn === 'string' && data.headers.includes(storedLookupColumn)
        setFieldMapping(applyStoredMapping(data.headers, storedMapping))
        setPrimaryKeyColumn(
          isValid ? (storedLookupColumn as string) : detectPrimaryKey(data.headers, objectType)
        )
        setConfigureSkippable(isValid)
        return
      }

      setFieldMapping(buildAutoFieldMapping(data.headers, objectType))
      setPrimaryKeyColumn(detectPrimaryKey(data.headers, objectType))
      setConfigureSkippable(false)
    },
    [useNewMapping, storedMapping, objectType]
  )

  const csvUpload = useCsvUpload({ objectType, onParseComplete })

  const handleObjectTypeChange = useCallback(
    (type: ObjectType) => {
      setObjectType(type)
      setFieldMapping(EMPTY_FIELD_MAPPING)
      setPrimaryKeyColumn('')
      setDryRunTaskId(null)
      setConfigureSkippable(false)
      setSelectedOverrides({})
      setPrimaryIpByDevice({})
      csvUpload.clearData()
    },
    [csvUpload]
  )

  const goToStep = useCallback((next: WizardStep) => {
    setHistory(prev => [...prev, next])
  }, [])

  const goBack = useCallback(() => {
    setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const reset = useCallback(() => {
    setHistory(['upload'])
    setObjectType('devices')
    setFieldMapping(EMPTY_FIELD_MAPPING)
    setPrimaryKeyColumn('')
    setTagsMode('replace')
    setMatchingStrategy('exact')
    setDefaultProperties([])
    setNameTransform(null)
    setRackLocationColumn(null)
    setTaskId(null)
    setJobId(null)
    setDryRunTaskId(null)
    // Deliberately leave useNewMapping/useDefaultProperties/primaryIpEnabled as-is —
    // they're a persisted user preference, not part of the per-upload wizard state.
    setConfigureSkippable(false)
    setRowFilter('')
    setSelectedOverrides({})
    setPrimaryIpByDevice({})
    csvUpload.clearData()
  }, [csvUpload])

  const step = history[history.length - 1] ?? 'upload'
  const canGoBack = history.length > 1

  /** Advances from the 'upload' step, skipping 'configure' when a valid saved mapping applies. */
  const advanceFromUpload = useCallback(() => {
    setSelectedOverrides({})
    setPrimaryIpByDevice({})
    setHistory(['upload'])
    if (configureSkippable) {
      goToStep(useDefaultProperties ? 'filter' : 'properties')
    } else {
      goToStep('configure')
    }
  }, [configureSkippable, useDefaultProperties, goToStep])

  /** Saves the (now-configured) mapping and advances to Properties or Filter. */
  const confirmConfigure = useCallback(() => {
    const next = {
      ...mappingBlobRef.current,
      [LOOKUP_COLUMN_MAPPING_KEY]: primaryKeyColumn,
      ...fieldMapping,
    }
    mappingBlobRef.current = next
    saveFieldMapping.mutate({ appName: CSV_UPDATE_APP_NAME, mapping: next })
    goToStep(useDefaultProperties ? 'filter' : 'properties')
  }, [saveFieldMapping, primaryKeyColumn, fieldMapping, useDefaultProperties, goToStep])

  /**
   * Columns that have a non-null mapping — used as `selected_columns` for the backend.
   * Columns mapped to null are effectively ignored.
   */
  const selectedColumns = useMemo(
    () => Object.keys(fieldMapping).filter(k => fieldMapping[k] !== null),
    [fieldMapping]
  )

  /**
   * The field mapping in the format the backend expects:
   * { csvColumnName: nautobotFieldName }  (only mapped columns included)
   */
  const columnMappingForBackend = useMemo(() => {
    const result: Record<string, string> = {}
    for (const [col, field] of Object.entries(fieldMapping)) {
      if (field !== null) result[col] = field
    }
    return result
  }, [fieldMapping])

  // --- Devices row/merge state ---

  const deviceRows = useMemo(
    () =>
      objectType === 'devices'
        ? buildDeviceRows(csvUpload.parsedData, fieldMapping)
        : EMPTY_DEVICE_ROWS,
    [objectType, csvUpload.parsedData, fieldMapping]
  )

  const filterRows = useMemo<FilterRow[]>(() => {
    if (objectType === 'devices') {
      return sortFilterRowsByDisplayName(
        deviceRows.map(r => ({
          id: r.id,
          displayName: r.deviceName,
          fields: r.fields,
          hasIpAddress: r.hasIpAddress,
        }))
      )
    }
    if (csvUpload.parsedData.rowCount === 0) return EMPTY_FILTER_ROWS
    return sortFilterRowsByDisplayName(
      buildFilterRows(csvUpload.parsedData, fieldMapping, primaryKeyColumn)
    )
  }, [objectType, deviceRows, csvUpload.parsedData, fieldMapping, primaryKeyColumn])

  const filteredRows = useMemo(() => {
    const f = rowFilter.trim().toLowerCase()
    if (!f) return filterRows
    return filterRows.filter(r => r.displayName.toLowerCase().includes(f))
  }, [filterRows, rowFilter])

  const {
    pagination: filterPagination,
    currentPageItems,
    handlePageChange: handleFilterPageChange,
    handlePageSizeChange: handleFilterPageSizeChange,
    resetPage: resetFilterPage,
  } = useFilterPagination(filteredRows.length)

  const paginatedRows = useMemo(
    () => currentPageItems(filteredRows),
    [currentPageItems, filteredRows]
  )

  const handleRowFilterChange = useCallback(
    (value: string) => {
      setRowFilter(value)
      resetFilterPage()
    },
    [resetFilterPage]
  )

  const isRowSelected = useCallback(
    (rowId: string) => selectedOverrides[rowId] ?? false,
    [selectedOverrides]
  )

  const toggleRowSelected = useCallback(
    (rowId: string) => {
      setSelectedOverrides(prev => ({ ...prev, [rowId]: !isRowSelected(rowId) }))
    },
    [isRowSelected]
  )

  /** Selects/deselects only the rows on the current page (i.e. what's actually on screen). */
  const toggleSelectAllVisible = useCallback(() => {
    const allSelected = paginatedRows.every(r => isRowSelected(r.id))
    setSelectedOverrides(prev => {
      const next = { ...prev }
      for (const r of paginatedRows) {
        next[r.id] = !allSelected
      }
      return next
    })
  }, [paginatedRows, isRowSelected])

  const setPrimaryIp = useCallback((deviceName: string, rowId: string) => {
    setPrimaryIpByDevice(prev => ({ ...prev, [deviceName]: rowId }))
  }, [])

  const selectedCount = useMemo(() => {
    if (objectType === 'devices') {
      const names = new Set(
        deviceRows
          .filter(r => isRowSelected(r.id) && r.deviceName)
          .map(r => r.deviceName)
      )
      return names.size
    }
    return filterRows.filter(r => isRowSelected(r.id)).length
  }, [objectType, deviceRows, filterRows, isRowSelected])

  const selectedDeviceRows = useMemo(
    () => deviceRows.filter(r => isRowSelected(r.id)),
    [deviceRows, isRowSelected]
  )

  /** Filtered CSV data (headers + only-selected rows) for the non-device CSV-text submission path. */
  const selectedParsedData = useMemo<ParsedCSVData>(() => {
    const rows = csvUpload.parsedData.rows.filter((_, idx) => isRowSelected(`row-${idx}`))
    return { headers: csvUpload.parsedData.headers, rows, rowCount: rows.length }
  }, [csvUpload.parsedData, isRowSelected])

  // --- Network-defaults-driven default properties ---

  const autoDefaultProperties = useMemo<DefaultProperty[]>(() => {
    if (!useDefaultProperties || !networkDefaults) return EMPTY_DEFAULT_PROPERTIES
    const map = DEFAULTS_FIELD_MAP[objectType]
    if (!map) return EMPTY_DEFAULT_PROPERTIES

    const defaultsRecord = networkDefaults as unknown as Record<string, string>
    const result: DefaultProperty[] = []
    for (const [defaultsKey, fieldKey] of Object.entries(map)) {
      const value = defaultsRecord[defaultsKey]
      if (value) result.push({ field: fieldKey, value, rowKey: defaultsKey })
    }
    return result
  }, [useDefaultProperties, networkDefaults, objectType])

  const effectiveDefaultProperties = useDefaultProperties
    ? autoDefaultProperties
    : defaultProperties

  return useMemo(
    () => ({
      // Navigation
      step,
      canGoBack,
      goBack,
      goToStep,
      advanceFromUpload,
      confirmConfigure,
      reset,
      // CSV upload
      csvUpload,
      // Object type
      objectType,
      handleObjectTypeChange,
      // Field mapping
      fieldMapping,
      setFieldMapping,
      // Primary key
      primaryKeyColumn,
      setPrimaryKeyColumn,
      // Tags mode
      tagsMode,
      setTagsMode,
      // Matching strategy
      matchingStrategy,
      setMatchingStrategy,
      // Default properties (manual + auto)
      defaultProperties,
      setDefaultProperties,
      effectiveDefaultProperties,
      // Name transform
      nameTransform,
      setNameTransform,
      // Rack location disambiguation
      rackLocationColumn,
      setRackLocationColumn,
      // Derived
      selectedColumns,
      columnMappingForBackend,
      // Options (step 1 checkboxes)
      useNewMapping,
      setUseNewMapping,
      useDefaultProperties,
      setUseDefaultProperties,
      primaryIpEnabled,
      setPrimaryIpEnabled,
      configureSkippable,
      // Devices rows / filter / selection
      deviceRows,
      selectedDeviceRows,
      filterRows,
      filteredRows,
      paginatedRows,
      filterPagination,
      handleFilterPageChange,
      handleFilterPageSizeChange,
      rowFilter,
      setRowFilter: handleRowFilterChange,
      isRowSelected,
      toggleRowSelected,
      toggleSelectAllVisible,
      selectedCount,
      primaryIpByDevice,
      setPrimaryIp,
      selectedParsedData,
      // Task tracking
      taskId,
      setTaskId,
      jobId,
      setJobId,
      dryRunTaskId,
      setDryRunTaskId,
    }),
    [
      step,
      canGoBack,
      goBack,
      goToStep,
      advanceFromUpload,
      confirmConfigure,
      reset,
      csvUpload,
      objectType,
      handleObjectTypeChange,
      fieldMapping,
      primaryKeyColumn,
      tagsMode,
      matchingStrategy,
      defaultProperties,
      effectiveDefaultProperties,
      nameTransform,
      rackLocationColumn,
      selectedColumns,
      columnMappingForBackend,
      useNewMapping,
      setUseNewMapping,
      useDefaultProperties,
      setUseDefaultProperties,
      primaryIpEnabled,
      setPrimaryIpEnabled,
      configureSkippable,
      deviceRows,
      selectedDeviceRows,
      filterRows,
      filteredRows,
      paginatedRows,
      filterPagination,
      handleFilterPageChange,
      handleFilterPageSizeChange,
      rowFilter,
      handleRowFilterChange,
      isRowSelected,
      toggleRowSelected,
      toggleSelectAllVisible,
      selectedCount,
      primaryIpByDevice,
      setPrimaryIp,
      selectedParsedData,
      taskId,
      jobId,
      dryRunTaskId,
    ]
  )
}
