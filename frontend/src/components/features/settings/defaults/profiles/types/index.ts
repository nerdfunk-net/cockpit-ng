import type { DefaultsFields } from './defaults-fields'

export interface Profile extends DefaultsFields {
  id: number
  name: string
  built_in_key: string | null
  is_built_in: boolean
}

export interface ProfileApiResponse {
  success: boolean
  data?: Profile
  message?: string
}

export interface ProfileListApiResponse {
  success: boolean
  data?: Profile[]
  message?: string
}

export type { DefaultsFields, DefaultsApiResponse } from './defaults-fields'
export type { DefaultsFields as NetworkDefaults } from './defaults-fields'
export type { DefaultsFields as ServerDefaults } from './defaults-fields'
