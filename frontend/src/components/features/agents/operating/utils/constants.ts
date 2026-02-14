import type { CockpitAgent, CommandHistoryItem } from '../types'

export const AGENTS_STALE_TIME = 30 * 1000 // 30 seconds
export const HISTORY_STALE_TIME = 15 * 1000 // 15 seconds
export const POLLING_INTERVAL = 30 * 1000 // 30 seconds

export const EMPTY_AGENTS: CockpitAgent[] = []
export const EMPTY_HISTORY: CommandHistoryItem[] = []
