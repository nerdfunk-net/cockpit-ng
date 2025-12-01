'use client'

import { useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tags, Loader2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface TagItem {
  id: string
  name: string
  color?: string
}

interface TagsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedTags: string[]
  onToggleTag: (tagId: string) => void
  availableTags: TagItem[]
  setAvailableTags: (tags: TagItem[]) => void
  isLoadingTags: boolean
  setIsLoadingTags: (loading: boolean) => void
}

export function TagsModal({
  open,
  onOpenChange,
  selectedTags,
  onToggleTag,
  availableTags,
  setAvailableTags,
  isLoadingTags,
  setIsLoadingTags
}: TagsModalProps) {
  const { apiCall } = useApi()

  // Load tags when modal opens
  useEffect(() => {
    if (open && availableTags.length === 0) {
      loadTags()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadTags = useCallback(async () => {
    setIsLoadingTags(true)
    try {
      const tagsData = await apiCall<TagItem[]>('nautobot/tags/devices', { method: 'GET' })
      if (tagsData && Array.isArray(tagsData)) {
        setAvailableTags(tagsData)
      }
    } catch (error) {
      console.error('Error loading tags:', error)
      setAvailableTags([])
    } finally {
      setIsLoadingTags(false)
    }
  }, [apiCall, setAvailableTags, setIsLoadingTags])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Device Tags
          </DialogTitle>
          <DialogDescription>
            Select tags to apply to this device.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoadingTags ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableTags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags available for devices.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availableTags.map(tag => (
                <label
                  key={tag.id}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() => onToggleTag(tag.id)}
                  />
                  <span className="text-sm">{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
