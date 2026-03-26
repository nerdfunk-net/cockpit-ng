'use client'

import { useState, useCallback, useMemo } from 'react'
import { MANDATORY_DEVICE_FIELDS, MANDATORY_INTERFACE_FIELDS, buildInitialColumnMapping } from '../utils/csv-import-utils'

export { MANDATORY_DEVICE_FIELDS, MANDATORY_INTERFACE_FIELDS }

interface UseCsvColumnMappingResult {
  columnMapping: Record<string, string | null>
  setColumnMapping: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  unmappedMandatoryFields: readonly string[]
  unmappedMandatoryInterfaceFields: readonly string[]
  initMapping: (headers: string[], nautobotFields: string[]) => void
  clear: () => void
}

/**
 * Manages CSV column mapping state, auto-detection, and mandatory field tracking.
 */
export function useCsvColumnMapping(): UseCsvColumnMappingResult {
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({})

  const unmappedMandatoryFields = useMemo(() => {
    const mappedTargets = new Set(
      Object.values(columnMapping).filter((v): v is string => v !== null)
    )
    return MANDATORY_DEVICE_FIELDS.filter(field => !mappedTargets.has(field))
  }, [columnMapping])

  const unmappedMandatoryInterfaceFields = useMemo(() => {
    const mappedTargets = new Set(
      Object.values(columnMapping).filter((v): v is string => v !== null)
    )
    if (!mappedTargets.has('interface_ip_address')) return [] as const satisfies readonly string[]
    return MANDATORY_INTERFACE_FIELDS.filter(field => !mappedTargets.has(field))
  }, [columnMapping])

  const initMapping = useCallback((headers: string[], nautobotFields: string[]) => {
    setColumnMapping(buildInitialColumnMapping(headers, nautobotFields))
  }, [])

  const clear = useCallback(() => {
    setColumnMapping({})
  }, [])

  return useMemo(
    () => ({
      columnMapping,
      setColumnMapping,
      unmappedMandatoryFields,
      unmappedMandatoryInterfaceFields,
      initMapping,
      clear,
    }),
    [columnMapping, unmappedMandatoryFields, unmappedMandatoryInterfaceFields, initMapping, clear]
  )
}
