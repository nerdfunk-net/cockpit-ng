'use client'

import { useState, useCallback, useMemo } from 'react'
import { useCsvUpload } from './use-csv-upload'
import type { ObjectType, ParsedCSVData } from '../types'

export type WizardStep = 'upload' | 'configure' | 'preview' | 'processing' | 'summary'

export const WIZARD_STEP_ORDER: WizardStep[] = [
  'upload',
  'configure',
  'preview',
  'processing',
  'summary',
]

const EMPTY_SET = new Set<string>()
const EMPTY_MAPPING: Record<string, string> = {}

export function useCsvWizard() {
  const [step, setStep] = useState<WizardStep>('upload')
  const [objectType, setObjectType] = useState<ObjectType>('devices')
  const [ignoreUuid, setIgnoreUuid] = useState(true)
  const [ignoredColumns, setIgnoredColumns] = useState<Set<string>>(EMPTY_SET)
  const [tagsMode, setTagsMode] = useState<'replace' | 'merge'>('replace')
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(EMPTY_MAPPING)
  const [isLegacyFormat, setIsLegacyFormat] = useState(false)
  const [legacyMapping, setLegacyMapping] = useState<Record<string, string>>(EMPTY_MAPPING)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [dryRunTaskId, setDryRunTaskId] = useState<string | null>(null)

  const autoPopulateColumnMapping = useCallback((headers: string[], type: ObjectType) => {
    if (type !== 'ip-prefixes') return
    const newMapping: Record<string, string> = {}
    if (headers.includes('prefix')) newMapping['prefix'] = 'prefix'
    if (headers.includes('namespace')) {
      newMapping['namespace'] = 'namespace'
    } else if (headers.includes('namespace__name')) {
      newMapping['namespace'] = 'namespace__name'
    }
    setColumnMapping(newMapping)
  }, [])

  const onParseComplete = useCallback(
    (data: ParsedCSVData) => {
      autoPopulateColumnMapping(data.headers, objectType)
      if (objectType === 'ip-addresses') {
        const hasAddress = data.headers.includes('address')
        const hasId = data.headers.includes('id')
        const hasNamespace = data.headers.includes('parent__namespace__name')
        if (!hasAddress || (!hasId && !hasNamespace)) {
          setIsLegacyFormat(true)
          const initialMapping: Record<string, string> = {}
          data.headers.forEach(h => {
            initialMapping[h] = 'none'
          })
          setLegacyMapping(initialMapping)
        } else {
          setIsLegacyFormat(false)
          setLegacyMapping(EMPTY_MAPPING)
        }
      }
    },
    [objectType, autoPopulateColumnMapping]
  )

  const csvUpload = useCsvUpload({ objectType, onParseComplete })

  const handleObjectTypeChange = useCallback(
    (type: ObjectType) => {
      setObjectType(type)
      setColumnMapping(EMPTY_MAPPING)
      setIgnoredColumns(EMPTY_SET)
      setIsLegacyFormat(false)
      setLegacyMapping(EMPTY_MAPPING)
      setDryRunTaskId(null)
      csvUpload.clearData()
    },
    [csvUpload]
  )

  const goToStep = useCallback((s: WizardStep) => setStep(s), [])

  const goNext = useCallback(() => {
    const idx = WIZARD_STEP_ORDER.indexOf(step)
    if (idx < WIZARD_STEP_ORDER.length - 1) setStep(WIZARD_STEP_ORDER[idx + 1]!)
  }, [step])

  const goBack = useCallback(() => {
    const idx = WIZARD_STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(WIZARD_STEP_ORDER[idx - 1]!)
  }, [step])

  const reset = useCallback(() => {
    setStep('upload')
    setObjectType('devices')
    setIgnoreUuid(true)
    setIgnoredColumns(EMPTY_SET)
    setTagsMode('replace')
    setColumnMapping(EMPTY_MAPPING)
    setIsLegacyFormat(false)
    setLegacyMapping(EMPTY_MAPPING)
    setTaskId(null)
    setDryRunTaskId(null)
    csvUpload.clearData()
  }, [csvUpload])

  const selectedColumns = useMemo(() => {
    const { parsedData } = csvUpload
    if (parsedData.headers.length === 0 || ignoredColumns.size === 0) return undefined
    return parsedData.headers.filter(h => !ignoredColumns.has(h))
  }, [csvUpload, ignoredColumns])

  return useMemo(
    () => ({
      // Navigation
      step,
      goNext,
      goBack,
      goToStep,
      reset,
      // CSV upload
      csvUpload,
      // Object type
      objectType,
      handleObjectTypeChange,
      // Update options
      ignoreUuid,
      setIgnoreUuid,
      ignoredColumns,
      setIgnoredColumns,
      tagsMode,
      setTagsMode,
      columnMapping,
      setColumnMapping,
      isLegacyFormat,
      legacyMapping,
      setLegacyMapping,
      selectedColumns,
      // Task tracking
      taskId,
      setTaskId,
      dryRunTaskId,
      setDryRunTaskId,
    }),
    [
      step,
      goNext,
      goBack,
      goToStep,
      reset,
      csvUpload,
      objectType,
      handleObjectTypeChange,
      ignoreUuid,
      ignoredColumns,
      tagsMode,
      columnMapping,
      isLegacyFormat,
      legacyMapping,
      selectedColumns,
      taskId,
      dryRunTaskId,
    ]
  )
}
