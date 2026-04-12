import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { parseCSVContent } from '../../shared/csv/utils/csv-parser'
import { RACK_IMPORT_FIELDS } from '../constants'
import type { CSVConfig, ParsedCSVData } from '../../shared/csv/types'
import type { RackMetadata, RackFaceAssignments, RackDevice, RackImportApplyPayload } from '../types'
import type { LocationItem } from '../../add-device/types'

export type ImportStep = 'upload' | 'mapping' | 'properties' | 'resolve'

const DEFAULT_CSV_CONFIG: CSVConfig = { delimiter: ',', quoteChar: '"' }
const EMPTY_PARSED_DATA: ParsedCSVData = { headers: [], rows: [], rowCount: 0 }

const RACK_FIELD_KEYS = new Set<string>(RACK_IMPORT_FIELDS.map(f => f.key))

interface NautobotDeviceListItem {
  id: string
  name: string
}

interface UseImportPositionsOptions {
  selectedLocationId: string
  rackMetadata: RackMetadata | null
  locations: LocationItem[]
  localFront: RackFaceAssignments
  localRear: RackFaceAssignments
  localUnpositioned: RackDevice[]
  onApply: (payload: RackImportApplyPayload) => void
  onClose: () => void
}

export function useImportPositions({
  selectedLocationId,
  rackMetadata,
  locations,
  localFront,
  localRear,
  localUnpositioned,
  onApply,
  onClose,
}: UseImportPositionsOptions) {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const [step, setStep] = useState<ImportStep>('upload')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvConfig, setCsvConfig] = useState<CSVConfig>(DEFAULT_CSV_CONFIG)
  const [parsedData, setParsedData] = useState<ParsedCSVData>(EMPTY_PARSED_DATA)
  const [isParsing, setIsParsing] = useState(false)
  const [deviceNameColumn, setDeviceNameColumn] = useState<string | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string | null>>({})
  const [locationColumn, setLocationColumn] = useState<string | null>(null)
  const [clearRackBeforeImport, setClearRackBeforeImport] = useState(true)
  const [isResolving, setIsResolving] = useState(false)

  const selectedLocation = useMemo(
    () => locations.find(l => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  )

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setCsvFile(file)
    setParsedData(EMPTY_PARSED_DATA)
    setDeviceNameColumn(null)
    setFieldMapping({})
    setLocationColumn(null)
  }, [])

  const handleConfigChange = useCallback((updates: Partial<CSVConfig>) => {
    setCsvConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const handleParseCSV = useCallback(async () => {
    if (!csvFile) return
    setIsParsing(true)
    try {
      const text = await csvFile.text()
      const { headers, rows } = parseCSVContent(text, csvConfig)
      const data: ParsedCSVData = { headers, rows, rowCount: rows.length }
      setParsedData(data)

      // Auto-detect device name column (prefer 'name', then first column)
      const nameCol = headers.find(h => h.toLowerCase() === 'name') ?? null
      setDeviceNameColumn(nameCol)

      // Auto-detect field mapping from headers
      const mapping: Record<string, string | null> = {}
      for (const h of headers) {
        const lower = h.toLowerCase()
        mapping[h] = RACK_FIELD_KEYS.has(lower) ? lower : null
      }
      setFieldMapping(mapping)

      // Auto-detect location column
      const locCol = headers.find(h => ['location', 'site', 'standort'].includes(h.toLowerCase())) ?? null
      setLocationColumn(locCol)
    } catch (err) {
      toast({
        title: 'Failed to parse CSV',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsParsing(false)
    }
  }, [csvFile, csvConfig, toast])

  const handleClear = useCallback(() => {
    setCsvFile(null)
    setParsedData(EMPTY_PARSED_DATA)
    setDeviceNameColumn(null)
    setFieldMapping({})
    setLocationColumn(null)
  }, [])

  // Compute which column indices correspond to each mapped rack field
  const rackColIdx = useMemo(() => {
    const col = Object.entries(fieldMapping).find(([, v]) => v === 'rack')?.[0] ?? null
    return col ? parsedData.headers.indexOf(col) : -1
  }, [fieldMapping, parsedData.headers])

  const posColIdx = useMemo(() => {
    const col = Object.entries(fieldMapping).find(([, v]) => v === 'position')?.[0] ?? null
    return col ? parsedData.headers.indexOf(col) : -1
  }, [fieldMapping, parsedData.headers])

  const faceColIdx = useMemo(() => {
    const col = Object.entries(fieldMapping).find(([, v]) => v === 'face')?.[0] ?? null
    return col ? parsedData.headers.indexOf(col) : -1
  }, [fieldMapping, parsedData.headers])

  const nameColIdx = useMemo(
    () => (deviceNameColumn ? parsedData.headers.indexOf(deviceNameColumn) : -1),
    [deviceNameColumn, parsedData.headers]
  )

  const locationColIdx = useMemo(
    () => (locationColumn ? parsedData.headers.indexOf(locationColumn) : -1),
    [locationColumn, parsedData.headers]
  )

  // Reactive preview of how many rows match the selected rack + location filter
  const previewMatchCount = useMemo(() => {
    if (!parsedData.rowCount || !rackMetadata) return 0
    const rackName = rackMetadata.name
    const locationName = selectedLocation?.name ?? ''

    return parsedData.rows.filter(row => {
      const rowRack = rackColIdx >= 0 ? row[rackColIdx]?.trim() : undefined
      if (rowRack !== rackName) return false
      if (locationColIdx >= 0) {
        const rowLocation = row[locationColIdx]?.trim() ?? ''
        return rowLocation === locationName
      }
      return true
    }).length
  }, [parsedData.rows, parsedData.rowCount, rackMetadata, selectedLocation, rackColIdx, locationColIdx])

  // Navigation guards
  const canGoNext = useMemo(() => {
    if (step === 'upload') return parsedData.rowCount > 0
    if (step === 'mapping') return deviceNameColumn !== null
    if (step === 'properties') return true
    return false
  }, [step, parsedData.rowCount, deviceNameColumn])

  const canFinish = locationColumn !== null && previewMatchCount > 0 && !isResolving

  const goNext = useCallback(() => {
    if (step === 'upload') setStep('mapping')
    else if (step === 'mapping') setStep('properties')
    else if (step === 'properties') setStep('resolve')
  }, [step])

  const goBack = useCallback(() => {
    if (step === 'resolve') setStep('properties')
    else if (step === 'properties') setStep('mapping')
    else if (step === 'mapping') setStep('upload')
  }, [step])

  const reset = useCallback(() => {
    setStep('upload')
    setCsvFile(null)
    setParsedData(EMPTY_PARSED_DATA)
    setDeviceNameColumn(null)
    setFieldMapping({})
    setLocationColumn(null)
    setClearRackBeforeImport(true)
    setIsResolving(false)
  }, [])

  const handleFinish = useCallback(async () => {
    if (!rackMetadata || !selectedLocation || nameColIdx < 0) return
    setIsResolving(true)

    try {
      const rackName = rackMetadata.name
      const locationName = selectedLocation.name

      // 1. Filter rows matching this rack + location
      const matchedRows = parsedData.rows.filter(row => {
        const rowRack = rackColIdx >= 0 ? row[rackColIdx]?.trim() : undefined
        if (rowRack !== rackName) return false
        if (locationColIdx >= 0) {
          const rowLocation = row[locationColIdx]?.trim() ?? ''
          return rowLocation === locationName
        }
        return true
      })

      // 2. Collect unique device names
      const uniqueNames = [
        ...new Set(
          matchedRows
            .map(row => row[nameColIdx]?.trim())
            .filter((n): n is string => Boolean(n))
        ),
      ]

      // 3. Resolve device names → IDs in parallel
      const nameToIdMap = new Map<string, string>()
      const notFoundNames: string[] = []

      await Promise.all(
        uniqueNames.map(async name => {
          const params = new URLSearchParams({ name_ic: name })
          if (selectedLocationId) params.append('location_id', selectedLocationId)
          const result = await apiCall<NautobotDeviceListItem[] | { devices?: NautobotDeviceListItem[] }>(
            `nautobot/devices?${params.toString()}`
          )
          const items = Array.isArray(result)
            ? result
            : (result as { devices?: NautobotDeviceListItem[] }).devices ?? []
          const exact = items.find(d => d.name === name)
          if (exact) {
            nameToIdMap.set(name, exact.id)
          } else {
            notFoundNames.push(name)
          }
        })
      )

      // 4. Build new assignments — start from empty if clearing, else overlay on existing
      const newFront: RackFaceAssignments = clearRackBeforeImport ? {} : { ...localFront }
      const newRear: RackFaceAssignments = clearRackBeforeImport ? {} : { ...localRear }
      const newUnpositioned: RackDevice[] = clearRackBeforeImport ? [] : [...localUnpositioned]

      for (const row of matchedRows) {
        const deviceName = row[nameColIdx]?.trim()
        if (!deviceName) continue
        const deviceId = nameToIdMap.get(deviceName)
        if (!deviceId) continue

        const posRaw = posColIdx >= 0 ? row[posColIdx]?.trim() : undefined
        const position = posRaw ? parseInt(posRaw, 10) : NaN
        const faceRaw = faceColIdx >= 0 ? row[faceColIdx]?.trim().toLowerCase() : ''
        const face: 'front' | 'rear' = faceRaw === 'rear' ? 'rear' : 'front'

        if (!isNaN(position) && position > 0) {
          const slot = { deviceId, deviceName, uHeight: 1 }
          if (face === 'rear') {
            newRear[position] = slot
          } else {
            newFront[position] = slot
          }
        } else {
          if (!newUnpositioned.some(d => d.id === deviceId)) {
            newUnpositioned.push({ id: deviceId, name: deviceName, position: null, face: null, uHeight: 1 })
          }
        }
      }

      // 5. Apply to rack state
      onApply({ newFront, newRear, newUnpositioned })

      // 6. Warn about unresolved devices
      if (notFoundNames.length > 0) {
        const preview = notFoundNames.slice(0, 3).join(', ')
        const suffix = notFoundNames.length > 3 ? ` and ${notFoundNames.length - 3} more` : ''
        toast({
          title: `${notFoundNames.length} device(s) not found in Nautobot`,
          description: `Could not resolve: ${preview}${suffix}`,
          variant: 'destructive',
        })
      }

      onClose()
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error during import',
        variant: 'destructive',
      })
    } finally {
      setIsResolving(false)
    }
  }, [
    rackMetadata,
    selectedLocation,
    selectedLocationId,
    parsedData.rows,
    nameColIdx,
    rackColIdx,
    locationColIdx,
    posColIdx,
    faceColIdx,
    clearRackBeforeImport,
    localFront,
    localRear,
    localUnpositioned,
    apiCall,
    toast,
    onApply,
    onClose,
  ])

  return useMemo(
    () => ({
      // Navigation
      step,
      goNext,
      goBack,
      reset,
      canGoNext,
      canFinish,

      // Step 1
      csvFile,
      csvConfig,
      parsedData,
      isParsing,
      handleFileChange,
      handleConfigChange,
      handleParseCSV,
      handleClear,

      // Step 2
      deviceNameColumn,
      setDeviceNameColumn,
      fieldMapping,
      setFieldMapping,

      // Step 3
      clearRackBeforeImport,
      setClearRackBeforeImport,

      // Step 4
      locationColumn,
      setLocationColumn,
      previewMatchCount,
      isResolving,
      handleFinish,

      // Derived
      selectedLocationName: selectedLocation?.name ?? '',
      rackName: rackMetadata?.name ?? '',
    }),
    [
      step,
      goNext,
      goBack,
      reset,
      canGoNext,
      canFinish,
      csvFile,
      csvConfig,
      parsedData,
      isParsing,
      handleFileChange,
      handleConfigChange,
      handleParseCSV,
      handleClear,
      deviceNameColumn,
      fieldMapping,
      clearRackBeforeImport,
      locationColumn,
      previewMatchCount,
      isResolving,
      handleFinish,
      selectedLocation,
      rackMetadata,
    ]
  )
}
