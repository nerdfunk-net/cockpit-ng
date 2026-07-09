import { useCallback, useMemo, useState } from 'react'
import { CSV_CONFIG, DEVICE_NAME_FIELD_KEY } from '../constants'
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
  }, [])

  const startCsvUpload = useCallback((source: ParsedCsvSource) => {
    setDataSourceMode('csv')
    setCsvSource(source)
    setFieldMapping(buildInitialMapping(source.headers))
    setHistory(['source', 'mapping'])
  }, [])

  const startAgentData = useCallback((result: Record<string, string>) => {
    setDataSourceMode('agent')
    setAgentKeys(result)
    const keys = Object.keys(result)

    if (keys.length <= 1) {
      setSelectedKeys(keys)
      const combined = combineAgentKeys(result, keys, CSV_CONFIG)
      if (combined.data) {
        const parsedSource = combined.data
        setCsvSource(parsedSource)
        setFieldMapping(buildInitialMapping(parsedSource.headers))
        setHistory(['source', 'mapping'])
      } else {
        setHistory(['source', 'keys'])
      }
      return
    }

    setSelectedKeys(keys)
    setHistory(['source', 'keys'])
  }, [])

  const confirmKeySelection = useCallback((): { error?: string } => {
    if (!agentKeys) {
      return { error: 'No agent data available.' }
    }

    const combined = combineAgentKeys(agentKeys, selectedKeys, CSV_CONFIG)
    if (!combined.data) {
      return { error: combined.error ?? 'Failed to combine selected keys.' }
    }

    setCsvSource(combined.data)
    setFieldMapping(buildInitialMapping(combined.data.headers))
    goToStep('mapping')
    return {}
  }, [agentKeys, selectedKeys, goToStep])

  const confirmMapping = useCallback(() => {
    setSelectedOverrides({})
    setPrimaryIpByDevice({})
    goToStep('table')
  }, [goToStep])

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

  const isMappingComplete = useMemo(
    () => Object.values(fieldMapping).some(value => value === DEVICE_NAME_FIELD_KEY),
    [fieldMapping]
  )

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
