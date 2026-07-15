import type { Profile } from '../types'

// React best practice: extract default arrays to prevent re-render loops
export const EMPTY_PROFILES: Profile[] = []

export const PROFILES_CACHE_TIME = 30 * 1000
