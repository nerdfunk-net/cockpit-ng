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
import { Key } from 'lucide-react'
import type { LoginCredential, LoginCredentialFormData } from '../types'
import { DEFAULT_LOGIN_FORM } from '../utils/constants'

interface LoginCredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credential: LoginCredential | null
  formData: LoginCredentialFormData
  onFormChange: (data: LoginCredentialFormData) => void
  onSave: () => void
  isSaving?: boolean
}

export function LoginCredentialDialog({
  open,
  onOpenChange,
  credential,
  formData,
  onFormChange,
  onSave,
  isSaving = false,
}: LoginCredentialDialogProps) {
  // Reset form when dialog opens with no credential (creating new)
  useEffect(() => {
    if (open && !credential) {
      onFormChange(DEFAULT_LOGIN_FORM)
    }
  }, [open, credential, onFormChange])

  const handleSave = useCallback(() => {
    onSave()
  }, [onSave])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white px-6 py-4 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-white text-lg">
            <Key className="h-5 w-5" />
            {credential ? 'Edit' : 'Add'} Login Credential
          </DialogTitle>
          <DialogDescription className="text-blue-50">
            Configure a username and password for compliance checks
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 px-6 pb-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label
              htmlFor="credential-name"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1"
            >
              Credential Name
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="credential-name"
              value={formData.name}
              onChange={(e) =>
                onFormChange({ ...formData, name: e.target.value })
              }
              placeholder="Production Admin"
              className="bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              A friendly name to identify this credential (e.g., &quot;Production
              Admin&quot;, &quot;ReadOnly User&quot;)
            </p>
          </div>

          {/* Username Input */}
          <div className="space-y-2">
            <Label
              htmlFor="username"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1"
            >
              Username
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) =>
                onFormChange({ ...formData, username: e.target.value })
              }
              placeholder="admin"
              className="bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              Username for device authentication during compliance checks
            </p>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1"
            >
              Password
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                onFormChange({ ...formData, password: e.target.value })
              }
              placeholder={
                credential ? '(leave blank to keep current)' : 'Enter password'
              }
              className="bg-gray-50 border-gray-300 focus:border-green-500 focus:ring-green-500"
            />
            {credential && (
              <p className="text-xs text-amber-600">
                Leave blank to keep the existing password unchanged
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="login-description"
              className="text-sm font-semibold text-gray-700"
            >
              Description
            </Label>
            <Textarea
              id="login-description"
              value={formData.description}
              onChange={(e) =>
                onFormChange({ ...formData, description: e.target.value })
              }
              placeholder="Describe this credential"
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
            {credential ? 'Update Credential' : 'Add Credential'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
