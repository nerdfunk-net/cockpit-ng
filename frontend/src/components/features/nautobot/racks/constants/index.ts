import type { RackDevice, RackMode } from '../types'

/** Height of a single rack unit row in pixels — matches the SVG reference */
export const RACK_UNIT_HEIGHT_PX = 22

/** Width of the left unit-number gutter in pixels */
export const RACK_GUTTER_WIDTH_PX = 31

/** Width of the rack slot body in pixels */
export const RACK_BODY_WIDTH_PX = 230

/** Width of the status color indicator bar on the left of a device */
export const RACK_STATUS_INDICATOR_PX = 12

export const EMPTY_RACK_DEVICES: RackDevice[] = []

export const MODE_OPTIONS: { value: RackMode; label: string }[] = [
  { value: 'all', label: 'Show all Devices' },
  { value: 'location', label: 'Show Location only' },
]

/** Minimum search query length before firing the device search */
export const DEVICE_SEARCH_MIN_CHARS = 2

/** Fields available for CSV-based rack position import */
export const RACK_IMPORT_FIELDS = [
  { key: 'rack',       label: 'Rack' },
  { key: 'position',   label: 'Position' },
  { key: 'face',       label: 'Face' },
  { key: 'location',   label: 'Location' },
  { key: 'rack_group', label: 'Rack Group' },
] as const

/** Stale times in milliseconds */
export const RACK_STALE_TIMES = {
  STATIC: 5 * 60 * 1000,
  SEMI_STATIC: 2 * 60 * 1000,
  DYNAMIC: 30 * 1000,
} as const
