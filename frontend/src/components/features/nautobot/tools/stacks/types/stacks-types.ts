// Types for Nautobot Stacks feature

export interface StackDeviceLocation {
  id: string
  name: string
}

export interface StackDeviceManufacturer {
  id: string
  name: string
}

export interface StackDeviceType {
  id: string
  model: string
  manufacturer: StackDeviceManufacturer
}

export interface StackDevice {
  id: string
  name: string
  serial: string
  location: StackDeviceLocation | null
  device_type: StackDeviceType | null
}

export interface StackDevicesResponse {
  devices: StackDevice[]
  count: number
}

export interface DeviceResult {
  device_id: string
  device_name: string
  success: boolean
  message: string
  created_devices: string[]
  virtual_chassis_id: string | null
  virtual_chassis_name: string | null
}

export interface ProcessStacksResponse {
  results: DeviceResult[]
  total: number
  succeeded: number
  failed: number
}
