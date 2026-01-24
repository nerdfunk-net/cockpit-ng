import { useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle, XCircle, FileText } from 'lucide-react'
import type { RegexPattern, RegexPatternFormData } from '../types'
import { DEFAULT_REGEX_FORM } from '../utils/constants'

interface RegexPatternDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pattern: RegexPattern | null
  formData: RegexPatternFormData
  onFormChange: (data: RegexPatternFormData) => void
  onSave: () => void
  isSaving?: boolean
}

export function RegexPatternDialog({
  open,
  onOpenChange,
  pattern,
  formData,
  onFormChange,
  onSave,
  isSaving = false,
}: RegexPatternDialogProps) {
  // Reset form when dialog opens with no pattern (creating new)
  useEffect(() => {
    if (open && !pattern) {
      onFormChange(DEFAULT_REGEX_FORM)
    }
  }, [open, pattern, onFormChange])

  const handleSave = useCallback(() => {
    onSave()
  }, [onSave])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white px-6 py-4 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-white text-lg">
            <FileText className="h-5 w-5" />
            {pattern ? 'Edit' : 'Add'} Regex Pattern
          </DialogTitle>
          <DialogDescription className="text-blue-50">
            Configure a regular expression pattern for compliance checking
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 px-6 pb-6">
          {/* Pattern Input */}
          <div className="space-y-2">
            <Label
              htmlFor="pattern"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1"
            >
              Pattern
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pattern"
              value={formData.pattern}
              onChange={(e) =>
                onFormChange({ ...formData, pattern: e.target.value })
              }
              placeholder="^logging.*"
              className="font-mono bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              Enter a regular expression pattern to match against device
              configurations
            </p>
          </div>

          {/* Pattern Type */}
          <div className="space-y-2">
            <Label
              htmlFor="pattern-type"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1"
            >
              Type
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.pattern_type}
              onValueChange={(value: 'must_match' | 'must_not_match') =>
                onFormChange({ ...formData, pattern_type: value })
              }
            >
              <SelectTrigger className="bg-gray-50 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="must_match">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Must Match</span>
                  </div>
                </SelectItem>
                <SelectItem value="must_not_match">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Must Not Match</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {formData.pattern_type === 'must_match'
                ? 'Configuration must contain lines matching this pattern'
                : 'Configuration must not contain lines matching this pattern'}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="pattern-description"
              className="text-sm font-semibold text-gray-700"
            >
              Description
            </Label>
            <Textarea
              id="pattern-description"
              value={formData.description}
              onChange={(e) =>
                onFormChange({ ...formData, description: e.target.value })
              }
              placeholder="Describe what this pattern checks for (e.g., 'Ensure logging is enabled')"
              rows={3}
              className="bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 px-6 pb-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-300 hover:bg-gray-50"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSaving}
          >
            {pattern ? 'Update Pattern' : 'Add Pattern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
