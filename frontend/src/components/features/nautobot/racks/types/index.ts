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
}

export interface RackSlotAssignment {
  deviceId: string
  deviceName: string
}

/** position (1-based) → assignment or null for each face */
export type RackFaceAssignments = Record<number, RackSlotAssignment | null>

export type RackMode = 'all' | 'location'

export interface DeviceSearchResult {
  id: string
  name: string
}

export interface ActiveSlot {
  position: number
  face: 'front' | 'rear'
}
