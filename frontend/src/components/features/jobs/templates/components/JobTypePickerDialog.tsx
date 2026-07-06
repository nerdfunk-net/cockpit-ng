import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { JOB_TYPE_CATEGORIES, OTHER_CATEGORY_ICON } from '../utils/job-type-categories'
import { JobTypeCard } from './JobTypeCard'
import type { JobType, JobTypeCategory } from '../types'

interface JobTypePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobTypes: JobType[]
  selectedJobType: string
  onSelect: (value: string) => void
}

export function JobTypePickerDialog({
  open,
  onOpenChange,
  jobTypes,
  selectedJobType,
  onSelect,
}: JobTypePickerDialogProps) {
  const categories = useMemo<JobTypeCategory[]>(() => {
    const categorized = new Set(JOB_TYPE_CATEGORIES.flatMap(cat => cat.jobTypes))
    const leftover = jobTypes.map(t => t.value).filter(value => !categorized.has(value))

    if (leftover.length === 0) {
      return JOB_TYPE_CATEGORIES
    }

    return [
      ...JOB_TYPE_CATEGORIES,
      { id: 'other', label: 'Other', icon: OTHER_CATEGORY_ICON, jobTypes: leftover },
    ]
  }, [jobTypes])

  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(
    categories[0]?.id
  )

  useEffect(() => {
    if (!open) return

    const categoryForSelection = categories.find(cat =>
      cat.jobTypes.includes(selectedJobType)
    )
    setActiveCategoryId(categoryForSelection?.id ?? categories[0]?.id)
  }, [open, selectedJobType, categories])

  const activeCategory = categories.find(cat => cat.id === activeCategoryId)

  const typesInActiveCategory = useMemo(() => {
    if (!activeCategory) return []
    return activeCategory.jobTypes
      .map(value => jobTypes.find(t => t.value === value))
      .filter((t): t is JobType => t !== undefined)
  }, [activeCategory, jobTypes])

  const handleSelect = (value: string) => {
    onSelect(value)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Select Job Type</DialogTitle>
        </DialogHeader>

        {jobTypes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Loading job types...</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            <div className="w-56 flex-shrink-0 border-r p-3 overflow-y-auto">
              <div className="space-y-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors',
                      activeCategoryId === cat.id
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent/50'
                    )}
                  >
                    <cat.icon className="h-4 w-4 flex-shrink-0" />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {typesInActiveCategory.map(jt => (
                  <JobTypeCard
                    key={jt.value}
                    jobType={jt}
                    icon={activeCategory?.icon ?? OTHER_CATEGORY_ICON}
                    isSelected={jt.value === selectedJobType}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
