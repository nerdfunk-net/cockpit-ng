import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JobType } from '../types'

interface JobTypeCardProps {
  jobType: JobType
  icon: LucideIcon
  isSelected: boolean
  onSelect: (value: string) => void
  disabled?: boolean
  disabledReason?: string
}

export function JobTypeCard({
  jobType,
  icon: Icon,
  isSelected,
  onSelect,
  disabled = false,
  disabledReason,
}: JobTypeCardProps) {
  const handleSelect = () => {
    if (disabled) return
    onSelect(jobType.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(jobType.value)
    }
  }

  return (
    <Card
      role="button"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'py-4 gap-2 transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:border-primary hover:bg-accent/50',
        isSelected && !disabled && 'border-primary bg-accent'
      )}
    >
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">{jobType.label}</CardTitle>
          </div>
          {isSelected && !disabled && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
        </div>
        <CardDescription className="text-xs">{jobType.description}</CardDescription>
        {disabled && disabledReason && (
          <p className="text-xs text-warning-foreground italic">{disabledReason}</p>
        )}
      </CardHeader>
    </Card>
  )
}
