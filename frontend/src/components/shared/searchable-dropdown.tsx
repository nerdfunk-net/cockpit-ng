'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SearchableDropdownProps {
  label?: string
  placeholder?: string
  options: string[]
  value: string
  onSelect: (value: string) => void
  onClear?: () => void
  className?: string
  inputClassName?: string
  disabled?: boolean
}

export function SearchableDropdown({
  label,
  placeholder = 'Search...',
  options,
  value,
  onSelect,
  onClear,
  className = '',
  inputClassName = '',
  disabled = false
}: SearchableDropdownProps) {
  const [searchText, setSearchText] = useState<string>(value)
  const [showDropdown, setShowDropdown] = useState<boolean>(false)
  const [filteredOptions, setFilteredOptions] = useState<string[]>(options)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Update searchText when value prop changes
  useEffect(() => {
    setSearchText(value)
  }, [value])

  // Update filtered options when options change
  useEffect(() => {
    setFilteredOptions(options)
  }, [options])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }

    return undefined
  }, [showDropdown])

  const handleInputChange = (query: string) => {
    setSearchText(query)

    if (!query.trim()) {
      setFilteredOptions(options)
      if (onClear) {
        onClear()
      }
    } else {
      setFilteredOptions(
        options.filter(opt =>
          opt.toLowerCase().includes(query.toLowerCase())
        )
      )
    }
    setShowDropdown(true)
  }

  const handleSelect = (option: string) => {
    setSearchText(option)
    setShowDropdown(false)
    onSelect(option)
  }

  // Update dropdown position when it opens
  useEffect(() => {
    if (showDropdown && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      })
    } else {
      setDropdownPosition(null)
    }
  }, [showDropdown])

  return (
    <div className={`space-y-1 relative ${className}`} ref={containerRef}>
      {label && <Label className="text-xs font-medium text-gray-600">{label}</Label>}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={searchText}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          disabled={disabled}
          className={`h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 ${inputClassName}`}
        />
        {showDropdown && filteredOptions.length > 0 && !disabled && dropdownPosition && (
          <div
            className="fixed z-[99999] mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto min-w-[200px]"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width
            }}
          >
            {filteredOptions.map(option => (
              <div
                key={option}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                onClick={() => handleSelect(option)}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
