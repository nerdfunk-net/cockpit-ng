/**
 * Custom hook for diff navigation and display controls
 * Handles font size, hide unchanged toggle, and diff navigation
 */

import { useState, useEffect, useCallback, useMemo } from 'react'

const FONT_SIZE_KEY = 'diff_font_size'
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 20
const DEFAULT_FONT_SIZE = 12

// Helper function to get initial font size from localStorage
const getInitialFontSize = (): number => {
  if (typeof window === 'undefined') return DEFAULT_FONT_SIZE
  
  const stored = localStorage.getItem(FONT_SIZE_KEY)
  if (stored) {
    const parsedSize = parseInt(stored, 10)
    if (!isNaN(parsedSize) && parsedSize >= MIN_FONT_SIZE && parsedSize <= MAX_FONT_SIZE) {
      return parsedSize
    }
  }
  return DEFAULT_FONT_SIZE
}

export function useDiffNavigation(totalDiffs: number = 0) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [fontSize, setFontSize] = useState(getInitialFontSize)

  // Save font size to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, fontSize.toString())
  }, [fontSize])

  const nextDiff = useCallback(() => {
    if (totalDiffs > 0) {
      setCurrentIndex(prev => Math.min(prev + 1, totalDiffs - 1))
    }
  }, [totalDiffs])

  const prevDiff = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const goToFirstDiff = useCallback(() => {
    setCurrentIndex(0)
  }, [])

  const goToLastDiff = useCallback(() => {
    if (totalDiffs > 0) {
      setCurrentIndex(totalDiffs - 1)
    }
  }, [totalDiffs])

  const increaseFontSize = useCallback(() => {
    setFontSize(prev => Math.min(prev + 1, MAX_FONT_SIZE))
  }, [])

  const decreaseFontSize = useCallback(() => {
    setFontSize(prev => Math.max(prev - 1, MIN_FONT_SIZE))
  }, [])

  const resetFontSize = useCallback(() => {
    setFontSize(DEFAULT_FONT_SIZE)
  }, [])

  const toggleHideUnchanged = useCallback(() => {
    setHideUnchanged(prev => !prev)
  }, [])

  return useMemo(() => ({
    // Navigation state
    currentIndex,
    setCurrentIndex,
    totalDiffs,

    // Navigation controls
    nextDiff,
    prevDiff,
    goToFirstDiff,
    goToLastDiff,

    // Display controls
    hideUnchanged,
    setHideUnchanged,
    toggleHideUnchanged,

    // Font controls
    fontSize,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,

    // Computed values
    hasPrevious: currentIndex > 0,
    hasNext: currentIndex < totalDiffs - 1,
    canIncreaseFontSize: fontSize < MAX_FONT_SIZE,
    canDecreaseFontSize: fontSize > MIN_FONT_SIZE
  }), [
    currentIndex,
    totalDiffs,
    nextDiff,
    prevDiff,
    goToFirstDiff,
    goToLastDiff,
    hideUnchanged,
    toggleHideUnchanged,
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize
  ])
}
