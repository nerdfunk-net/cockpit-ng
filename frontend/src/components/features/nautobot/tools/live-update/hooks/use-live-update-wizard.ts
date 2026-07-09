import { useCallback, useMemo, useState } from 'react'
import { useFieldMappingQuery } from '@/hooks/queries/use-field-mapping-query'
import { useFieldMappingMutations } from '@/hooks/queries/use-field-mapping-mutations'
import { CSV_CONFIG, DEVICE_NAME_FIELD_KEY, LIVE_UPDATE_APP_NAME } from '../constants'
import { buildLiveUpdateRows, combineAgentKeys } from '../utils/live-update-parser'
import type { DataSourceMode, LiveUpdateStep, ParsedCsvSource } from '../types'

const EMPTY_MAPPING: Record<string, string | null> = {}
const EMPTY_KEYS: string[] = []

function buildInitialMapping(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}
  for (const header of headers) {
    mapping[header] = null
  }
  return mapping
}

/** Applies a saved mapping to the current headers; unknown headers stay unmapped. */
function applyStoredMapping(
  headers: string[],
  stored: Record<string, string | null>
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}
  for (const header of headers) {
    mapping[header] = stored[header] ?? null
  }
  return mapping
}

function mapsDeviceName(mapping: Record<string, string | null>): boolean {
  return Object.values(mapping).some(value => value === DEVICE_NAME_FIELD_KEY)
}

export function useLiveUpdateWizard() {
  const [history, setHistory] = useState<LiveUpdateStep[]>(['source'])
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode | null>(null)
  const [csvSource, setCsvSource] = useState<ParsedCsvSource | null>(null)
  const [agentKeys, setAgentKeys] = useState<Record<string, string> | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>(EMPTY_KEYS)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string | null>>(
    EMPTY_MAPPING
  )
  const [deviceFilter, setDeviceFilter] = useState('')
  const [selectedOverrides, setSelectedOverrides] = useState<Record<string, boolean>>({})
  const [primaryIpByDevice, setPrimaryIpByDevice] = useState<Record<string, string | null>>(
    {}
  )
  const [useNewMapping, setUseNewMapping] = useState(false)
  const [saveMappingForLater, setSaveMappingForLater] = useState(false)

  const { data: storedMapping } = useFieldMappingQuery(LIVE_UPDATE_APP_NAME)
  const { saveFieldMapping } = useFieldMappingMutations()

  const step = history[history.length - 1] ?? 'source'

  const goToStep = useCallback((next: LiveUpdateStep) => {
    setHistory(prev => [...prev, next])
  }, [])

  const goBack = useCallback(() => {
    setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const reset = useCallback(() => {
    setHistory(['source'])
    setDataSourceMode(null)
    setCsvSource(null)
    setAgentKeys(null)
    setSelectedKeys(EMPTY_KEYS)
    setFieldMapping(EMPTY_MAPPING)
    setDeviceFilter('')
    setSelectedOverrides({})
    setPrimaryIpByDevice({})
    setSaveMappingForLater(false)
  }, [])

  /** Applies the resolved source, using a saved mapping to skip to Data when possible. */
  const applySource = useCallback(
    (source: ParsedCsvSource) => {
      setCsvSource(source)

      if (!useNewMapping && storedMapping) {
        const applied = applyStoredMapping(source.headers, storedMapping)
        if (mapsDeviceName(applied)) {
          setFieldMapping(applied)
          setSelectedOverrides({})
          setPrimaryIpByDevice({})
          goToStep('table')
          return
        }
        // Saved mapping doesn't cover these headers — prefill what matched and ask to finish.
        setFieldMapping(applied)
        goToStep('mapping')
        return
      }

      setFieldMapping(buildInitialMapping(source.headers))
      goToStep('mapping')
    },
    [useNewMapping, storedMapping, goToStep]
  )

  const startCsvUpload = useCallback(
    (source: ParsedCsvSource) => {
      setDataSourceMode('csv')
      setHistory(['source'])
      applySource(source)
    },
    [applySource]
  )

  const startAgentData = useCallback(
    (result: Record<string, string>) => {
      setDataSourceMode('agent')
      setAgentKeys(result)
      const keys = Object.keys(result)

      if (keys.length <= 1) {
        setSelectedKeys(keys)
        const combined = combineAgentKeys(result, keys, CSV_CONFIG)
        if (combined.data) {
          setHistory(['source'])
          applySource(combined.data)
        } else {
          setHistory(['source', 'keys'])
        }
        return
      }

      setSelectedKeys(keys)
      setHistory(['source', 'keys'])
    },
    [applySource]
  )

  const confirmKeySelection = useCallback((): { error?: string } => {
    if (!agentKeys) {
      return { error: 'No agent data available.' }
    }

    const combined = combineAgentKeys(agentKeys, selectedKeys, CSV_CONFIG)
    if (!combined.data) {
      return { error: combined.error ?? 'Failed to combine selected keys.' }
    }

    applySource(combined.data)
    return {}
  }, [agentKeys, selectedKeys, applySource])

  const confirmMapping = useCallback(() => {
    if (saveMappingForLater) {
      saveFieldMapping.mutate({ appName: LIVE_UPDATE_APP_NAME, mapping: fieldMapping })
    }
    setSelectedOverrides({})
    setPrimaryIpByDevice({})
    goToStep('table')
  }, [saveMappingForLater, saveFieldMapping, fieldMapping, goToStep])

  const rows = useMemo(() => {
    if (!csvSource) return []
    return buildLiveUpdateRows(csvSource, fieldMapping)
  }, [csvSource, fieldMapping])

  const filteredRows = useMemo(() => {
    const filter = deviceFilter.trim().toLowerCase()
    if (!filter) return rows
    return rows.filter(row => row.deviceName.toLowerCase().includes(filter))
  }, [rows, deviceFilter])

  const isRowSelected = useCallback(
    (rowId: string) => selectedOverrides[rowId] ?? true,
    [selectedOverrides]
  )

  const selectedDeviceCount = useMemo(() => {
    const deviceNames = new Set(
      rows.filter(row => isRowSelected(row.id) && row.deviceName).map(row => row.deviceName)
    )
    return deviceNames.size
  }, [rows, isRowSelected])

  const toggleRowSelected = useCallback(
    (rowId: string) => {
      setSelectedOverrides(prev => ({ ...prev, [rowId]: !isRowSelected(rowId) }))
    },
    [isRowSelected]
  )

  const toggleSelectAllVisible = useCallback(() => {
    const allSelected = filteredRows.every(row => isRowSelected(row.id))
    setSelectedOverrides(prev => {
      const next = { ...prev }
      for (const row of filteredRows) {
        next[row.id] = !allSelected
      }
      return next
    })
  }, [filteredRows, isRowSelected])

  const setPrimaryIp = useCallback((deviceName: string, rowId: string) => {
    setPrimaryIpByDevice(prev => ({ ...prev, [deviceName]: rowId }))
  }, [])

  const isMappingComplete = useMemo(() => mapsDeviceName(fieldMapping), [fieldMapping])

  return useMemo(
    () => ({
      step,
      dataSourceMode,
      csvSource,
      agentKeys,
      selectedKeys,
      fieldMapping,
      deviceFilter,
      rows,
      filteredRows,
      selectedDeviceCount,
      primaryIpByDevice,
      isMappingComplete,
      canGoBack: history.length > 1,
      useNewMapping,
      setUseNewMapping,
      saveMappingForLater,
      setSaveMappingForLater,
      goBack,
      goToStep,
      reset,
      startCsvUpload,
      startAgentData,
      setSelectedKeys,
      confirmKeySelection,
      setFieldMapping,
      confirmMapping,
      setDeviceFilter,
      isRowSelected,
      toggleRowSelected,
      toggleSelectAllVisible,
      setPrimaryIp,
    }),
    [
      step,
      dataSourceMode,
      csvSource,
      agentKeys,
      selectedKeys,
      fieldMapping,
      deviceFilter,
      rows,
      filteredRows,
      selectedDeviceCount,
      primaryIpByDevice,
      isMappingComplete,
      history.length,
      useNewMapping,
      saveMappingForLater,
      goBack,
      goToStep,
      reset,
      startCsvUpload,
      startAgentData,
      confirmKeySelection,
      confirmMapping,
      isRowSelected,
      toggleRowSelected,
      toggleSelectAllVisible,
      setPrimaryIp,
    ]
  )
}
