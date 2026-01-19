import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

export interface SearchableDropdownState<T> {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredItems: T[]
  showDropdown: boolean
  setShowDropdown: (show: boolean) => void
  selectItem: (item: T) => void
  selectedItem: T | null
  containerRef: React.RefObject<HTMLDivElement | null>
  displayValue: string
}

interface UseSearchableDropdownOptions<T> {
  items: T[]
  selectedId: string
  onSelect: (id: string) => void
  getDisplayText: (item: T) => string
  filterPredicate: (item: T, query: string) => boolean
}

/**
 * Searchable dropdown hook with click-outside handling
 * @param options - Configuration options
 * @returns Memoized dropdown state
 */
export function useSearchableDropdown<T extends { id: string }>(
  options: UseSearchableDropdownOptions<T>
): SearchableDropdownState<T> {
  const { items, selectedId, onSelect, getDisplayText, filterPredicate } = options

  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const lowerQuery = searchQuery.toLowerCase()
    return items.filter((item) => filterPredicate(item, lowerQuery))
  }, [items, searchQuery, filterPredicate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectItem = useCallback(
    (item: T) => {
      onSelect(item.id)
      setSearchQuery(getDisplayText(item))
      setShowDropdown(false)
    },
    [onSelect, getDisplayText]
  )

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  )

  const displayValue = useMemo(() => {
    // If user is actively searching, show their search query
    if (searchQuery !== '') return searchQuery
    // Otherwise show the selected item's text
    return selectedItem ? getDisplayText(selectedItem) : ''
  }, [searchQuery, selectedItem, getDisplayText])

  // Sync search query with selected item when selection changes externally
  // This handles form reset and external selection changes
  useEffect(() => {
    // If there's a selected item, update the search query to match it (but only if currently empty)
    if (selectedItem && searchQuery === '') {
      const expectedText = getDisplayText(selectedItem)
      setSearchQuery(expectedText)
    }
    // If there's no selected item and search query doesn't match any ongoing user input
    // (this happens on form reset), clear it
    else if (!selectedItem && searchQuery !== '' && !showDropdown) {
      // Only clear if dropdown is not shown (user is not actively typing)
      setSearchQuery('')
    }
  }, [selectedItem, getDisplayText, showDropdown])

  // Clear selection when user manually clears the input field completely
  useEffect(() => {
    if (searchQuery === '' && selectedItem && showDropdown) {
      // User is actively clearing the field, so clear the selection
      onSelect('')
    }
  }, [searchQuery, selectedItem, onSelect, showDropdown])

  // CRITICAL: Memoize return object to prevent infinite loops
  return useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      filteredItems,
      showDropdown,
      setShowDropdown,
      selectItem,
      selectedItem,
      containerRef,
      displayValue,
    }),
    [searchQuery, filteredItems, showDropdown, selectItem, selectedItem, displayValue]
  )
}
