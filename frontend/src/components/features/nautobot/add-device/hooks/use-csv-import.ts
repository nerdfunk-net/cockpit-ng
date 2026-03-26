'use client'

import { useState, useCallback, useMemo } from 'react'
import type {
  CSVParseResult,
  DeviceValidationError,
  DeviceImportResult,
  ImportSummary,
  NautobotDropdownsResponse,
  ParsedDevice,
} from '../types'
import { CSV_IMPORT_NAUTOBOT_FIELDS } from '@/components/features/jobs/templates/utils/constants'
import { parseCsvDevices } from '../utils/csv-import-utils'
import { useCsvParser } from './use-csv-parser'
import { useCsvColumnMapping } from './use-csv-column-mapping'

// Re-export constants so existing consumer imports keep working
export {
  MANDATORY_DEVICE_FIELDS,
  MANDATORY_INTERFACE_FIELDS,
} from './use-csv-column-mapping'

// CSV import format
export type CsvImportFormat = 'generic' | 'nautobot' | 'cockpit'

// Wizard steps
export type CsvImportStep =
  | 'upload'
  | 'mapping'
  | 'defaults'
  | 'preview'
  | 'importing'
  | 'summary'

// Form values passed from the Add Device page
export interface FormDefaults {
  deviceType?: string
  deviceTypeName?: string
  role?: string
  roleName?: string
  status?: string
  statusName?: string
  location?: string
  locationName?: string
  platform?: string
  platformName?: string
  selectedTags?: string[]
  customFieldValues?: Record<string, string>
}

export interface PrefixConfig {
  addPrefix: boolean
  defaultPrefixLength: string
}

const DEFAULT_PREFIX_CONFIG: PrefixConfig = {
  addPrefix: false,
  defaultPrefixLength: '/24',
}

interface UseCsvImportProps {
  nautobotDefaults: NautobotDropdownsResponse['nautobotDefaults']
  formDefaults: FormDefaults
  onImportDevice: (
    device: ParsedDevice,
    prefixConfig: PrefixConfig,
    dryRun?: boolean
  ) => Promise<DeviceImportResult>
}

export function useCsvImport({
  nautobotDefaults,
  formDefaults,
  onImportDevice,
}: UseCsvImportProps) {
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<CsvImportStep>('upload')
  const [delimiter, setDelimiter] = useState(nautobotDefaults?.csv_delimiter || ',')
  const [importFormat, setImportFormat] = useState<CsvImportFormat>('generic')

  // Defaults state
  const [defaults, setDefaults] = useState<Record<string, string>>({})

  // Form data application flags
  const [applyFormTags, setApplyFormTags] = useState(false)
  const [applyFormCustomFields, setApplyFormCustomFields] = useState(false)

  // Prefix configuration
  const [prefixConfig, setPrefixConfig] = useState<PrefixConfig>(DEFAULT_PREFIX_CONFIG)

  // Preview state
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const [dryRunErrors, setDryRunErrors] = useState<DeviceValidationError[]>([])
  const [isDryRun, setIsDryRun] = useState(false)
  const [dryRunCompleted, setDryRunCompleted] = useState(false)

  // Import state
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // Sub-hooks
  const parser = useCsvParser(delimiter)
  const mapping = useCsvColumnMapping()

  // Available Nautobot fields for the mapping dropdowns
  const nautobotFields = useMemo(() => CSV_IMPORT_NAUTOBOT_FIELDS['devices'] || [], [])

  // Wraps onImportDevice to merge form tags/custom fields when enabled
  const importDeviceWithFormData = useCallback(
    async (device: ParsedDevice, config: PrefixConfig, dryRun?: boolean) => {
      let d = device
      if (applyFormTags && formDefaults.selectedTags?.length) {
        d = { ...d, tags: [...(d.tags || []), ...formDefaults.selectedTags] }
      }
      if (
        applyFormCustomFields &&
        Object.keys(formDefaults.customFieldValues || {}).length
      ) {
        d = {
          ...d,
          custom_fields: {
            ...formDefaults.customFieldValues,
            ...(d.custom_fields || {}),
          },
        }
      }
      return onImportDevice(d, config, dryRun)
    },
    [onImportDevice, applyFormTags, applyFormCustomFields, formDefaults]
  )

  // Wraps parser.handleFileSelect — after reading, initialises column mapping and defaults
  const handleFileSelect = useCallback(
    (file: File) => {
      setParseResult(null)
      setImportSummary(null)
      setDryRunErrors([])
      parser.handleFileSelect(file, parsedHeaders => {
        mapping.initMapping(parsedHeaders, nautobotFields)

        // Pre-fill defaults from form values and Nautobot system defaults
        const initialDefaults: Record<string, string> = {}
        if (formDefaults.deviceType)
          initialDefaults['device_type'] = formDefaults.deviceType
        if (formDefaults.role) initialDefaults['role'] = formDefaults.role
        if (formDefaults.status) initialDefaults['status'] = formDefaults.status
        if (formDefaults.location) initialDefaults['location'] = formDefaults.location
        if (formDefaults.platform) initialDefaults['platform'] = formDefaults.platform
        if (nautobotDefaults?.interface_status)
          initialDefaults['interface_status'] = nautobotDefaults.interface_status
        if (nautobotDefaults?.namespace)
          initialDefaults['interface_namespace'] = nautobotDefaults.namespace
        setDefaults(initialDefaults)

        setStep('mapping')
      })
    },
    [parser, mapping, nautobotFields, formDefaults, nautobotDefaults]
  )

  // Thin wrapper around the pure parseCsvDevices function
  const buildParsedDevices = useCallback(
    (): CSVParseResult =>
      parseCsvDevices(
        parser.csvContent,
        mapping.columnMapping,
        defaults,
        delimiter,
        parser.headers,
        nautobotDefaults
      ),
    [parser, mapping, defaults, delimiter, nautobotDefaults]
  )

  // Navigate to preview step (builds parsed devices)
  const goToPreview = useCallback(() => {
    const result = buildParsedDevices()
    setParseResult(result)
    setDryRunErrors([])
    setDryRunCompleted(false)
    setStep('preview')
  }, [buildParsedDevices])

  // Dry run — validate each device against Nautobot without creating anything
  const runDryRun = useCallback(async () => {
    if (!parseResult || parseResult.devices.length === 0) return

    setIsDryRun(true)
    setDryRunErrors([])
    setDryRunCompleted(false)

    const errors: DeviceValidationError[] = []

    for (const device of parseResult.devices) {
      const result = await importDeviceWithFormData(device, prefixConfig, true)
      if (result.status === 'error') {
        errors.push({
          deviceName: device.name,
          field: 'nautobot',
          message: result.message,
          severity: 'error',
        })
      }
    }

    setDryRunErrors(errors)
    setIsDryRun(false)
    setDryRunCompleted(true)
  }, [parseResult, importDeviceWithFormData, prefixConfig])

  // Import all parsed devices sequentially
  const importDevices = useCallback(async () => {
    if (!parseResult || parseResult.devices.length === 0) return

    const blockingErrors = parseResult.validationErrors.filter(
      e => e.severity === 'error'
    )
    if (blockingErrors.length > 0) return

    setStep('importing')
    setIsImporting(true)
    setImportProgress({ current: 0, total: parseResult.devices.length })

    const results: DeviceImportResult[] = []

    for (let i = 0; i < parseResult.devices.length; i++) {
      const device = parseResult.devices[i]
      if (!device) continue

      setImportProgress({ current: i + 1, total: parseResult.devices.length })

      try {
        const result = await importDeviceWithFormData(device, prefixConfig)
        results.push(result)
      } catch (error) {
        results.push({
          deviceName: device.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const summary: ImportSummary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    }

    setImportSummary(summary)
    setIsImporting(false)
    setStep('summary')
  }, [parseResult, importDeviceWithFormData, prefixConfig])

  // Navigate to a wizard step
  const goToStep = useCallback(
    (targetStep: CsvImportStep) => {
      if (targetStep === 'preview') {
        goToPreview()
      } else {
        setStep(targetStep)
      }
    },
    [goToPreview]
  )

  // Reset all state back to initial
  const reset = useCallback(() => {
    parser.clear()
    mapping.clear()
    setDefaults({})
    setApplyFormTags(false)
    setApplyFormCustomFields(false)
    setPrefixConfig(DEFAULT_PREFIX_CONFIG)
    setImportFormat('generic')
    setParseResult(null)
    setDryRunErrors([])
    setDryRunCompleted(false)
    setImportSummary(null)
    setStep('upload')
  }, [parser, mapping])

  const closeModal = useCallback(() => {
    setShowModal(false)
    reset()
  }, [reset])

  return useMemo(
    () => ({
      // Modal state
      showModal,
      setShowModal,
      closeModal,
      step,
      goToStep,

      // Upload
      csvFile: parser.csvFile,
      isParsing: parser.isParsing,
      parseError: parser.parseError,
      headers: parser.headers,
      delimiter,
      setDelimiter,
      importFormat,
      setImportFormat,
      handleFileSelect,

      // Mapping
      columnMapping: mapping.columnMapping,
      setColumnMapping: mapping.setColumnMapping,
      nautobotFields,
      unmappedMandatoryFields: mapping.unmappedMandatoryFields,
      unmappedMandatoryInterfaceFields: mapping.unmappedMandatoryInterfaceFields,

      // Defaults
      defaults,
      setDefaults,

      // Form data application
      applyFormTags,
      setApplyFormTags,
      applyFormCustomFields,
      setApplyFormCustomFields,

      // Prefix configuration
      prefixConfig,
      setPrefixConfig,

      // Preview
      parseResult,
      dryRunErrors,
      isDryRun,
      dryRunCompleted,
      goToPreview,
      runDryRun,

      // Import
      isImporting,
      importProgress,
      importSummary,
      importDevices,

      // Reset
      reset,
    }),
    [
      showModal,
      closeModal,
      step,
      goToStep,
      parser,
      delimiter,
      importFormat,
      handleFileSelect,
      mapping,
      nautobotFields,
      defaults,
      applyFormTags,
      applyFormCustomFields,
      parseResult,
      dryRunErrors,
      isDryRun,
      dryRunCompleted,
      goToPreview,
      runDryRun,
      isImporting,
      importProgress,
      importSummary,
      importDevices,
      prefixConfig,
      reset,
    ]
  )
}
