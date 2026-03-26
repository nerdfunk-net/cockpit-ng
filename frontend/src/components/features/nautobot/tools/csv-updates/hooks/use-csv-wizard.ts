'use client'

import { useState, useCallback, useMemo } from 'react'
import { useCsvUpload } from './use-csv-upload'
import { buildAutoFieldMapping } from '../constants'
import type { ObjectType, ParsedCSVData } from '../types'

export type WizardStep = 'upload' | 'configure' | 'preview' | 'processing' | 'summary'

export const WIZARD_STEP_ORDER: WizardStep[] = [
  'upload',
  'configure',
  'preview',
  'processing',
  'summary',
]

const EMPTY_FIELD_MAPPING: Record<string, string | null> = {}

/** Preferred primary-key columns per object type (first match wins). */
const PRIMARY_KEY_PREFERENCES: Record<ObjectType, string[]> = {
  devices:       ['name', 'id'],
  locations:     ['name', 'id'],
  'ip-prefixes': ['prefix', 'id'],
  'ip-addresses':['address', 'id'],
}

function detectPrimaryKey(headers: string[], type: ObjectType): string {
  const preferred = PRIMARY_KEY_PREFERENCES[type] ?? []
  return preferred.find(col => headers.includes(col)) ?? headers[0] ?? ''
}

export function useCsvWizard() {
  const [step, setStep] = useState<WizardStep>('upload')
  const [objectType, setObjectType] = useState<ObjectType>('devices')

  // Single mapping: CSV column → Nautobot field name (null = not used)
  const [fieldMapping, setFieldMapping] =
    useState<Record<string, string | null>>(EMPTY_FIELD_MAPPING)

  const [primaryKeyColumn, setPrimaryKeyColumn] = useState<string>('')
  const [tagsMode, setTagsMode] = useState<'replace' | 'merge'>('replace')

  const [taskId, setTaskId] = useState<string | null>(null)
  const [dryRunTaskId, setDryRunTaskId] = useState<string | null>(null)

  const onParseComplete = useCallback(
    (data: ParsedCSVData) => {
      setFieldMapping(buildAutoFieldMapping(data.headers, objectType))
      setPrimaryKeyColumn(detectPrimaryKey(data.headers, objectType))
    },
    [objectType]
  )

  const csvUpload = useCsvUpload({ objectType, onParseComplete })

  const handleObjectTypeChange = useCallback(
    (type: ObjectType) => {
      setObjectType(type)
      setFieldMapping(EMPTY_FIELD_MAPPING)
      setPrimaryKeyColumn('')
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
    setFieldMapping(EMPTY_FIELD_MAPPING)
    setPrimaryKeyColumn('')
    setTagsMode('replace')
    setTaskId(null)
    setDryRunTaskId(null)
    csvUpload.clearData()
  }, [csvUpload])

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
      // Field mapping
      fieldMapping,
      setFieldMapping,
      // Primary key
      primaryKeyColumn,
      setPrimaryKeyColumn,
      // Tags mode
      tagsMode,
      setTagsMode,
      // Derived
      selectedColumns,
      columnMappingForBackend,
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
      fieldMapping,
      primaryKeyColumn,
      tagsMode,
      selectedColumns,
      columnMappingForBackend,
      taskId,
      dryRunTaskId,
    ]
  )
}
