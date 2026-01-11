import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Tags as TagsIcon } from 'lucide-react'
import type { TagItem } from '../types'

interface TagsModalProps {
  show: boolean
  onClose: () => void
  availableTags: TagItem[]
  selectedTags: string[]
  onToggleTag: (tagId: string) => void
  isLoading: boolean
}

export function TagsModal({
  show,
  onClose,
  availableTags,
  selectedTags,
  onToggleTag,
  isLoading,
}: TagsModalProps) {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagsIcon className="h-5 w-5" />
            Select Tags
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : availableTags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tags available</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => onToggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={isLoading}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
