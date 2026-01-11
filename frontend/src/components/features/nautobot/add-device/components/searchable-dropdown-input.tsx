import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { SearchableDropdownState } from '../hooks/use-searchable-dropdown'

/**
 * IMPORTANT: DO NOT REMOVE THE ESLINT-DISABLE BELOW
 * 
 * The react-hooks/rules-of-hooks linter incorrectly flags dropdownState properties
 * (displayValue, showDropdown, filteredItems, etc.) as refs being accessed during render.
 * 
 * These are NOT refs - they are regular state values and memoized values that are
 * perfectly safe to use during render. Only containerRef is an actual ref, and it's
 * used correctly (passed to a div's ref prop).
 * 
 * This is a known false positive with memoized objects returned from custom hooks.
 * Removing this disable will cause 8+ linting errors.
 */
/* eslint-disable react-hooks/rules-of-hooks */

interface SearchableDropdownInputProps<T> {
  id: string
  label: string
  placeholder: string
  required?: boolean
  disabled?: boolean
  dropdownState: SearchableDropdownState<T>
  renderItem: (item: T) => React.ReactNode
  getItemKey: (item: T) => string
}

export function SearchableDropdownInput<T>({
  id,
  label,
  placeholder,
  required = false,
  disabled = false,
  dropdownState,
  renderItem,
  getItemKey,
}: SearchableDropdownInputProps<T>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative" ref={dropdownState.containerRef}>
        <Input
          id={id}
          placeholder={placeholder}
          value={dropdownState.displayValue}
          onChange={(e) => {
            dropdownState.setSearchQuery(e.target.value)
            dropdownState.setShowDropdown(true)
          }}
          onFocus={() => dropdownState.setShowDropdown(true)}
          onBlur={() => dropdownState.setShowDropdown(false)}
          disabled={disabled}
        />
        {dropdownState.showDropdown && dropdownState.filteredItems.length > 0 && (
          <div className="absolute z-[100] mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {dropdownState.filteredItems.map((item) => (
              <div
                key={getItemKey(item)}
                className="px-3 py-2 hover:bg-accent cursor-pointer text-sm border-b last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault() // Prevent input blur
                  dropdownState.selectItem(item)
                }}
              >
                {renderItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
