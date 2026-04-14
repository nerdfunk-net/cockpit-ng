'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { LayoutGrid, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

import { useRackSaveMutation } from './hooks/use-rack-save-mutation'
import { useLocationsQuery } from './hooks/use-locations-query'
import { useRacksByLocationQuery } from './hooks/use-racks-by-location-query'
import { useRackMetadataQuery } from './hooks/use-rack-metadata-query'
import { useRackDevicesQuery } from './hooks/use-rack-devices-query'
import { useDeviceSearchQuery } from './hooks/use-device-search-query'

import { RackSelectorBar } from './components/rack-selector-bar'
import { RackView } from './components/rack-view'
import { RackActions } from './components/rack-actions'
import { UnpositionedDevicesPanel } from './components/unpositioned-devices-panel'
import { UnknownCsvDevicesPanel } from './components/unknown-csv-devices-panel'
import { ImportPositionsDialog } from './components/import-positions-dialog'
import { ValidateNamesDialog } from './components/validate-names-dialog'

import type {
  RackMode,
  RackFaceAssignments,
  RackDevice,
  ActiveSlot,
  DeviceSearchResult,
  RackImportApplyPayload,
  MatchingStrategy,
  NameTransform,
  UnknownCsvDevice,
} from './types'

function buildFaceAssignments(
  devices: { id: string; name: string; position: number | null; face: 'front' | 'rear' | null; uHeight: number; isReservation?: boolean }[],
  face: 'front' | 'rear'
): RackFaceAssignments {
  const assignments: RackFaceAssignments = {}
  for (const device of devices) {
    if (device.face === face && device.position !== null) {
      assignments[device.position] = { deviceId: device.id, deviceName: device.name, uHeight: device.uHeight, isReservation: device.isReservation }
    }
  }
  return assignments
}

function assignmentsEqual(a: RackFaceAssignments, b: RackFaceAssignments): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    const aVal = a[Number(key)]
    const bVal = b[Number(key)]
    if (aVal?.deviceId !== bVal?.deviceId) return false
  }
  return true
}

export function RacksPage() {
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedRackId, setSelectedRackId] = useState('')
  const [mode, setMode] = useState<RackMode>('all')
  const [overwriteLocation, setOverwriteLocation] = useState(false)

  // Local editable state
  const [localFront, setLocalFront] = useState<RackFaceAssignments>({})
  const [localRear, setLocalRear] = useState<RackFaceAssignments>({})
  const [originalFront, setOriginalFront] = useState<RackFaceAssignments>({})
  const [originalRear, setOriginalRear] = useState<RackFaceAssignments>({})

  // Devices moved to "unpositioned" locally (keep rack, clear position/face)
  const [localUnpositioned, setLocalUnpositioned] = useState<RackDevice[]>([])
  const [originalUnpositioned, setOriginalUnpositioned] = useState<RackDevice[]>([])

  // Inline "add device" state
  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null)
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('')

  // Unknown CSV devices (not resolved during import)
  const [unknownCsvDevices, setUnknownCsvDevices] = useState<UnknownCsvDevice[]>([])

  // CSV import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [validateDialogOpen, setValidateDialogOpen] = useState(false)

  // Matching settings — shared between import wizard and validate feature
  const [matchingStrategy, setMatchingStrategy] = useState<MatchingStrategy>('exact')
  const [nameTransform, setNameTransform] = useState<NameTransform | null>(null)

  const { saveRack, isSaving } = useRackSaveMutation()

  // Data queries
  const { locations } = useLocationsQuery()
  const { racks, isLoading: isLoadingRacks } = useRacksByLocationQuery({
    locationId: selectedLocationId || undefined,
  })
  const { rackMetadata, isLoading: isLoadingMetadata } = useRackMetadataQuery({
    rackId: selectedRackId || undefined,
  })
  const { rackDevices, isLoading: isLoadingDevices } = useRackDevicesQuery({
    rackId: selectedRackId || undefined,
  })

  // Device search for "add device" popover
  const locationIdForSearch = mode === 'location' ? selectedLocationId : undefined
  const { results: deviceSearchResults, isSearching } = useDeviceSearchQuery({
    query: deviceSearchQuery,
    locationId: locationIdForSearch || undefined,
  })

  // Sync rack devices from query into local state
  useEffect(() => {
    if (!selectedRackId) {
      setLocalFront({})
      setLocalRear({})
      setOriginalFront({})
      setOriginalRear({})
      setLocalUnpositioned([])
      setOriginalUnpositioned([])
      return
    }
    const front = buildFaceAssignments(rackDevices, 'front')
    const rear = buildFaceAssignments(rackDevices, 'rear')
    setLocalFront(front)
    setLocalRear(rear)
    setOriginalFront(front)
    setOriginalRear(rear)
    setLocalUnpositioned([])
    setOriginalUnpositioned([])
  }, [rackDevices, selectedRackId])

  // Reset rack when location changes
  const handleSelectLocation = useCallback((id: string) => {
    setSelectedLocationId(id)
    setSelectedRackId('')
    setActiveSlot(null)
    setDeviceSearchQuery('')
    setUnknownCsvDevices([])
  }, [])

  const handleSelectRack = useCallback((id: string) => {
    setSelectedRackId(id)
    setActiveSlot(null)
    setDeviceSearchQuery('')
    setUnknownCsvDevices([])
  }, [])

  const handleAdd = useCallback(
    (position: number, face: 'front' | 'rear', device: DeviceSearchResult) => {
      const setter = face === 'front' ? setLocalFront : setLocalRear
      setter((prev) => ({ ...prev, [position]: { deviceId: device.id, deviceName: device.name, uHeight: device.uHeight ?? 1 } }))
    },
    []
  )

  const handleRemove = useCallback((position: number, face: 'front' | 'rear') => {
    const setter = face === 'front' ? setLocalFront : setLocalRear
    setter((prev) => ({ ...prev, [position]: null }))
  }, [])

  const handleAddSlotReservation = useCallback(
    (position: number, face: 'front' | 'rear', description: string) => {
      const setter = face === 'front' ? setLocalFront : setLocalRear
      setter((prev) => ({
        ...prev,
        [position]: {
          deviceId: `__reservation__::${description}`,
          deviceName: description,
          uHeight: 1,
          isReservation: true,
        },
      }))
    },
    []
  )

  const handleMoveToUnpositioned = useCallback(
    (position: number, face: 'front' | 'rear') => {
      const assignments = face === 'front' ? localFront : localRear
      const assignment = assignments[position]
      if (!assignment) return

      const setter = face === 'front' ? setLocalFront : setLocalRear
      setter((prev) => ({ ...prev, [position]: null }))

      setLocalUnpositioned((prev) => {
        if (prev.some((d) => d.id === assignment.deviceId)) return prev
        return [
          ...prev,
          { id: assignment.deviceId, name: assignment.deviceName, position: null, face: null, uHeight: assignment.uHeight },
        ]
      })
    },
    [localFront, localRear]
  )

  const handleMoveReservationToUnknown = useCallback(
    (position: number, face: 'front' | 'rear') => {
      const assignments = face === 'front' ? localFront : localRear
      const assignment = assignments[position]
      if (!assignment?.isReservation) return

      const setter = face === 'front' ? setLocalFront : setLocalRear
      setter((prev) => ({ ...prev, [position]: null }))

      const csvName = assignment.deviceId.replace('__reservation__::', '')
      setUnknownCsvDevices((prev) => {
        if (prev.some((d) => d.csvName === csvName)) return prev
        return [...prev, { csvName, csvPosition: position, csvFace: face }]
      })
    },
    [localFront, localRear]
  )

  const handleImportApply = useCallback(
    ({ newFront, newRear, newUnpositioned, unknownCsvDevices }: RackImportApplyPayload) => {
      setLocalFront(newFront)
      setLocalRear(newRear)
      setLocalUnpositioned(newUnpositioned)
      setUnknownCsvDevices(unknownCsvDevices)
    },
    []
  )

  const handleMapUnknownDevice = useCallback(
    (csvName: string, device: DeviceSearchResult, csvPosition: number | null, csvFace: 'front' | 'rear' | null) => {
      setUnknownCsvDevices(prev => prev.filter(d => d.csvName !== csvName))
      if (csvPosition !== null && csvFace !== null) {
        const setter = csvFace === 'front' ? setLocalFront : setLocalRear
        setter(prev => ({
          ...prev,
          [csvPosition]: { deviceId: device.id, deviceName: device.name, uHeight: device.uHeight ?? 1 },
        }))
      } else {
        setLocalUnpositioned(prev => {
          if (prev.some(d => d.id === device.id)) return prev
          return [...prev, { id: device.id, name: device.name, position: null, face: null, uHeight: device.uHeight ?? 1 }]
        })
      }
    },
    []
  )

  // Move an unknown CSV device to Non-Racked Devices as a rack reservation placeholder
  const handleAddReservation = useCallback((device: UnknownCsvDevice) => {
    setUnknownCsvDevices(prev => prev.filter(d => d.csvName !== device.csvName))
    setLocalUnpositioned(prev => {
      const id = `__reservation__::${device.csvName}`
      if (prev.some(d => d.id === id)) return prev
      return [
        ...prev,
        {
          id,
          name: device.csvName,
          position: null,
          face: null,
          uHeight: 1,
          isReservation: true,
          defaultPosition: device.csvPosition ?? undefined,
        },
      ]
    })
  }, [])

  // Place a reservation placeholder into the front face of the rack at the chosen position
  const handleAddAsReservation = useCallback(
    (position: number, device: DeviceSearchResult) => {
      setLocalFront(prev => ({
        ...prev,
        [position]: {
          deviceId: device.id,
          deviceName: device.name,
          uHeight: device.uHeight ?? 1,
          isReservation: true,
        },
      }))
      setLocalUnpositioned(prev => prev.filter(d => d.id !== device.id))
    },
    []
  )

  const handleApplyNames = useCallback((renames: Map<string, string>) => {
    setLocalFront(prev => {
      const next = { ...prev }
      for (const [pos, slot] of Object.entries(next)) {
        if (slot && renames.has(slot.deviceId)) {
          next[Number(pos)] = { ...slot, deviceName: renames.get(slot.deviceId)! }
        }
      }
      return next
    })
    setLocalRear(prev => {
      const next = { ...prev }
      for (const [pos, slot] of Object.entries(next)) {
        if (slot && renames.has(slot.deviceId)) {
          next[Number(pos)] = { ...slot, deviceName: renames.get(slot.deviceId)! }
        }
      }
      return next
    })
    setLocalUnpositioned(prev =>
      prev.map(d => (renames.has(d.id) ? { ...d, name: renames.get(d.id)! } : d))
    )
  }, [])

  const handleCancel = useCallback(() => {
    setLocalFront({ ...originalFront })
    setLocalRear({ ...originalRear })
    setLocalUnpositioned([...originalUnpositioned])
    setUnknownCsvDevices([])
    setActiveSlot(null)
    setDeviceSearchQuery('')
  }, [originalFront, originalRear, originalUnpositioned])

  const handleSave = useCallback(() => {
    saveRack(
      {
        rackId: selectedRackId,
        locationId: selectedLocationId,
        overwriteLocation,
        localFront,
        localRear,
        originalFront,
        originalRear,
        localUnpositioned,
        originalUnpositioned,
      },
      {
        onSuccess: () => {
          setOriginalFront({ ...localFront })
          setOriginalRear({ ...localRear })
          setOriginalUnpositioned([...localUnpositioned])
        },
      }
    )
  }, [saveRack, selectedRackId, selectedLocationId, overwriteLocation, localFront, localRear, originalFront, originalRear, localUnpositioned, originalUnpositioned])

  const hasChanges = useMemo(
    () =>
      !assignmentsEqual(localFront, originalFront) ||
      !assignmentsEqual(localRear, originalRear) ||
      localUnpositioned.length !== originalUnpositioned.length,
    [localFront, localRear, originalFront, originalRear, localUnpositioned, originalUnpositioned]
  )

  const unpositionedDevices = useMemo(() => {
    const assignedIds = new Set<string>()
    for (const a of Object.values(localFront)) if (a) assignedIds.add(a.deviceId)
    for (const a of Object.values(localRear)) if (a) assignedIds.add(a.deviceId)

    // Server-side unpositioned devices not yet locally assigned
    const serverUnpositioned = rackDevices.filter(
      (d) => d.position === null && !assignedIds.has(d.id)
    )

    // Locally moved-to-unpositioned devices not yet re-assigned
    const serverIds = new Set(serverUnpositioned.map((d) => d.id))
    const locallyMoved = localUnpositioned.filter(
      (d) => !assignedIds.has(d.id) && !serverIds.has(d.id)
    )

    return [...serverUnpositioned, ...locallyMoved]
  }, [rackDevices, localFront, localRear, localUnpositioned])

  const selectedRack = racks.find((r) => r.id === selectedRackId)
  const uHeight = rackMetadata?.u_height ?? 42
  const isLoadingRackData = isLoadingMetadata || isLoadingDevices

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <LayoutGrid className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rack Management</h1>
          <p className="text-muted-foreground mt-1">
            Visualize and manage device placement in racks
          </p>
        </div>
      </div>

      {/* Selector bar */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
          <span className="text-sm font-medium">Select Rack</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 rounded-b-lg">
          <RackSelectorBar
            locations={locations}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleSelectLocation}
            racks={racks}
            selectedRackId={selectedRackId}
            onSelectRack={handleSelectRack}
            mode={mode}
            onModeChange={setMode}
            isLoadingRacks={isLoadingRacks}
            overwriteLocation={overwriteLocation}
            onOverwriteLocationChange={setOverwriteLocation}
          />
        </div>
      </div>

      {/* CSV import dialog */}
      {selectedRackId && (
        <ImportPositionsDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          selectedLocationId={selectedLocationId}
          rackMetadata={rackMetadata ?? null}
          locations={locations}
          localFront={localFront}
          localRear={localRear}
          localUnpositioned={localUnpositioned}
          matchingStrategy={matchingStrategy}
          onMatchingStrategyChange={setMatchingStrategy}
          nameTransform={nameTransform}
          onNameTransformChange={setNameTransform}
          onApply={handleImportApply}
        />
      )}

      {/* Validate names dialog */}
      {selectedRackId && (
        <ValidateNamesDialog
          open={validateDialogOpen}
          onOpenChange={setValidateDialogOpen}
          localFront={localFront}
          localRear={localRear}
          localUnpositioned={localUnpositioned}
          selectedLocationId={selectedLocationId}
          matchingStrategy={matchingStrategy}
          nameTransform={nameTransform}
          onApplyNames={handleApplyNames}
        />
      )}

      {/* Rack view */}
      {selectedRackId && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-3 rounded-t-lg">
            <span className="text-sm font-medium">
              {rackMetadata?.name ?? selectedRack?.name ?? 'Rack'}
            </span>
            {rackMetadata && (
              <>
                <Badge className="bg-white/20 text-white text-xs border-0">
                  {uHeight}U
                </Badge>
                {rackMetadata.status?.name && (
                  <Badge className="bg-white/20 text-white text-xs border-0">
                    {rackMetadata.status.name}
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50 rounded-b-lg">
            {isLoadingRackData ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex gap-8 items-start">
                  <div className="flex flex-col gap-4 shrink-0">
                    <UnpositionedDevicesPanel
                      key={selectedRackId}
                      devices={unpositionedDevices}
                      uHeight={uHeight}
                      frontAssignments={localFront}
                      rearAssignments={localRear}
                      onAdd={handleAdd}
                      onAddAsReservation={handleAddAsReservation}
                    />
                    <UnknownCsvDevicesPanel
                      devices={unknownCsvDevices}
                      locationId={locationIdForSearch}
                      onMapDevice={handleMapUnknownDevice}
                      onAddReservation={handleAddReservation}
                    />
                  </div>
                  <div className="flex-1">
                    <RackView
                      uHeight={uHeight}
                      frontAssignments={localFront}
                      rearAssignments={localRear}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                      onMoveToUnpositioned={handleMoveToUnpositioned}
                      onMoveReservationToUnknown={handleMoveReservationToUnknown}
                      onAddReservation={handleAddSlotReservation}
                      deviceSearchQuery={deviceSearchQuery}
                      onDeviceSearchQueryChange={setDeviceSearchQuery}
                      deviceSearchResults={deviceSearchResults}
                      isSearching={isSearching}
                      activeSlot={activeSlot}
                      onSetActiveSlot={setActiveSlot}
                    />
                  </div>
                </div>
                <RackActions
                  hasChanges={hasChanges}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isSaving={isSaving}
                  onImportPositions={() => setImportDialogOpen(true)}
                  onValidateNames={() => setValidateDialogOpen(true)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
