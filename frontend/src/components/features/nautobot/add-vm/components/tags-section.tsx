import { useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { VMFormReturn } from '../hooks/use-vm-form'
import type { VMDropdownsResponse } from '../types'

interface TagsSectionProps {
  form: VMFormReturn
  dropdownData: VMDropdownsResponse
  isLoading: boolean
}

export function TagsSection({ form, dropdownData, isLoading }: TagsSectionProps) {
  const { setValue, watch } = form
  const selectedTags = watch('tags') ?? []

  const toggleTag = useCallback(
    (tagId: string) => {
      const current = form.getValues('tags') ?? []
      if (current.includes(tagId)) {
        setValue('tags', current.filter((id) => id !== tagId))
      } else {
        setValue('tags', [...current, tagId])
      }
    },
    [form, setValue]
  )

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
        <span className="text-sm font-medium">
          Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
        </span>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dropdownData.tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags available</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dropdownData.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
