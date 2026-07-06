import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JobType } from '../types'

interface JobTypeCardProps {
  jobType: JobType
  icon: LucideIcon
  isSelected: boolean
  onSelect: (value: string) => void
}

export function JobTypeCard({ jobType, icon: Icon, isSelected, onSelect }: JobTypeCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(jobType.value)
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(jobType.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'cursor-pointer py-4 gap-2 transition-colors hover:border-primary hover:bg-accent/50',
        isSelected && 'border-primary bg-accent'
      )}
    >
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">{jobType.label}</CardTitle>
          </div>
          {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
        </div>
        <CardDescription className="text-xs">{jobType.description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
