'use client'

import { useCallback, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { StatusAlert } from '@/components/shared/status-alert'

interface KeySelectionStepProps {
  agentKeys: Record<string, string>
  selectedKeys: string[]
  onSelectedKeysChange: (keys: string[]) => void
  onBack: () => void
  onConfirm: () => { error?: string }
}

export function KeySelectionStep({
  agentKeys,
  selectedKeys,
  onSelectedKeysChange,
  onBack,
  onConfirm,
}: KeySelectionStepProps) {
  const [error, setError] = useState<string | null>(null)
  const keys = Object.keys(agentKeys)

  const toggleKey = useCallback(
    (key: string) => {
      setError(null)
      if (selectedKeys.includes(key)) {
        onSelectedKeysChange(selectedKeys.filter(k => k !== key))
      } else {
        onSelectedKeysChange([...selectedKeys, key])
      }
    },
    [selectedKeys, onSelectedKeysChange]
  )

  const handleContinue = useCallback(() => {
    const result = onConfirm()
    setError(result.error ?? null)
  }, [onConfirm])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The agent returned {keys.length} data keys. Select which ones to include —
        selected keys must share identical CSV headers so their rows can be combined.
      </p>

      <div className="space-y-2">
        {keys.map(key => (
          <div
            key={key}
            className="flex items-center space-x-3 p-3 bg-muted border rounded-lg"
          >
            <Checkbox
              id={`key-${key}`}
              checked={selectedKeys.includes(key)}
              onCheckedChange={() => toggleKey(key)}
            />
            <Label htmlFor={`key-${key}`} className="text-sm font-medium cursor-pointer">
              {key}
            </Label>
          </div>
        ))}
      </div>

      {error && <StatusAlert variant="error">{error}</StatusAlert>}

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={selectedKeys.length === 0}>
          Continue
        </Button>
      </div>
    </div>
  )
}
