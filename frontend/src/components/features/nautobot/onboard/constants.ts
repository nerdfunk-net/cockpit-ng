/**
 * Shared constants for the onboarding feature
 *
 * This module contains constant values that are reused across multiple
 * components to ensure referential stability and prevent unnecessary re-renders.
 */

import type { DropdownOption, LocationItem } from './types'

/**
 * Empty array constants for default parameters
 *
 * These are defined as constants outside components to ensure referential
 * equality across renders, preventing infinite re-render loops.
 *
 * IMPORTANT: Always use these constants as default values instead of
 * inline array literals (e.g., `= []`) to prevent re-render issues.
 */

export const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
export const EMPTY_LOCATIONS: LocationItem[] = []
export const EMPTY_STRING_ARRAY: string[] = []

/**
 * Empty object constants for default parameters
 */
export const EMPTY_OBJECT: Record<string, unknown> = {}
