export const RESULT_STATUS = {
  MATCH: 'match',
  NAME_MISMATCH: 'name_mismatch',
  IP_NOT_FOUND: 'ip_not_found',
  ERROR: 'error'
} as const

export const MESSAGE_TYPE = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
} as const

export type ResultStatus = typeof RESULT_STATUS[keyof typeof RESULT_STATUS]
export type MessageType = typeof MESSAGE_TYPE[keyof typeof MESSAGE_TYPE]

export interface StatusMessage {
  type: MessageType
  message: string
}

export interface CheckResult {
  ip_address: string
  device_name: string
  status: ResultStatus
  nautobot_device_name?: string
  error?: string
}

export interface TaskProgress {
  current: number
  total: number
  message?: string
}

export interface TaskResult {
  success: boolean
  message?: string
  error?: string
  total_devices?: number
  processed_devices?: number
  results?: CheckResult[]
}

export type TaskStatusType = 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED'

export interface TaskStatus {
  task_id: string
  status: TaskStatusType
  result?: TaskResult
  progress?: TaskProgress
}

export interface UploadFormData {
  file: File
  delimiter: string
  quoteChar: string
}

export interface UploadCsvResponse {
  task_id: string
  message: string
}

export interface NautobotSettings {
  data?: {
    csv_delimiter?: string
    csv_quote_char?: string
  }
}
