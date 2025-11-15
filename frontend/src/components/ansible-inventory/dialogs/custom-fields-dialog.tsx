/**
 * Custom Fields Dialog Component
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CustomField } from '../types'

interface CustomFieldsDialogProps {
  show: boolean
  onClose: () => void
  customFields: CustomField[]
}

export function CustomFieldsDialog({ show, onClose, customFields }: CustomFieldsDialogProps) {
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom Fields</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {customFields.length === 0 ? (
            <p className="text-gray-500 text-sm">No custom fields available</p>
          ) : (
            customFields.map((field, index) => (
              <div key={index} className="p-2 border rounded">
                <div className="font-medium">{field.label}</div>
                <div className="text-xs text-gray-600">{field.name} ({field.type})</div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
