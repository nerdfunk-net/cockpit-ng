'use client'

import { X, CheckCircle, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FormActionsProps {
  isLoading: boolean
  onClear: () => void
  onValidate: () => void
}

export function FormActions({ isLoading, onClear, onValidate }: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3">
      <Button
        type="button"
        onClick={onClear}
        disabled={isLoading}
        variant="outline"
        size="lg"
      >
        <X className="h-4 w-4 mr-2" />
        Clear Form
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={onValidate}
        disabled={isLoading}
        size="lg"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        Validate
      </Button>
      <Button type="submit" disabled={isLoading} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Adding Device...
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </>
        )}
      </Button>
    </div>
  )
}
