export type DeviceSource = 'nautobot' | 'checkmk' | 'both'
export type SystemFilter = 'all' | 'both' | 'nautobot' | 'checkmk'

export interface DiffDevice {
  name: string
  source: DeviceSource
  nautobot_id?: string
  ip_address?: string
  role?: string
  location?: string
  status?: string
  device_type?: string
  checkmk_folder?: string
  checkmk_alias?: string
  checkmk_ip?: string
  checkmk_diff_status?: string
}

export interface DiffTaskResult {
  all_devices: DiffDevice[]
  nautobot_only: DiffDevice[]
  checkmk_only: DiffDevice[]
  total_nautobot: number
  total_checkmk: number
  total_both: number
}
