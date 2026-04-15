export interface RackMetadata {
  id: string
  name: string
  type: string | null
  width: number
  u_height: number
  status: {
    id: string
    name: string
  }
}

export interface RackDevice {
  id: string
  name: string
  position: number | null
  face: 'front' | 'rear' | null
  uHeight: number
  /** True when this device is a rack reservation for an unknown CSV device. */
  isReservation?: boolean
  /** Pre-fill the position selector in UnpositionedDevicesPanel (from CSV position). */
  defaultPosition?: number
}

export interface RackSlotAssignment {
  deviceId: string
  deviceName: string
  uHeight: number
  /** True when this slot represents a rack reservation for an unknown CSV device. */
  isReservation?: boolean
}

/** position (1-based) → assignment or null for each face */
export type RackFaceAssignments = Record<number, RackSlotAssignment | null>

export type RackMode = 'all' | 'location'

export type MatchingStrategy = 'exact' | 'contains' | 'starts_with'
export type NameTransformMode = 'regex' | 'replace'
export interface NameTransform {
  mode: NameTransformMode
  pattern: string
  /** Only used in replace mode. Empty string = delete the matched portion. */
  replacement: string
}

export interface DeviceSearchResult {
  id: string
  name: string
  uHeight?: number
}

export interface ActiveSlot {
  position: number
  face: 'front' | 'rear'
}

export interface UnknownCsvDevice {
  csvName: string
  csvPosition: number | null
  csvFace: 'front' | 'rear' | null
}

export interface RackImportApplyPayload {
  newFront: RackFaceAssignments
  newRear: RackFaceAssignments
  newUnpositioned: RackDevice[]
  unknownCsvDevices: UnknownCsvDevice[]
}

export interface LocationType {
  id: string
  name: string
  parent: { id: string; name: string } | null
}
