'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusAlert } from '@/components/shared/status-alert'
import { Eye, EyeOff, Lock } from 'lucide-react'

interface PasswordState {
  newPassword: string
  confirmPassword: string
}

interface ChangePasswordTabProps {
  passwords: PasswordState
  passwordError: string
  showPassword: boolean
  showConfirmPassword: boolean
  onPasswordsChange: (updater: (prev: PasswordState) => PasswordState) => void
  onPasswordErrorChange: (error: string) => void
  onShowPasswordToggle: () => void
  onShowConfirmPasswordToggle: () => void
}

export function ChangePasswordTab({
  passwords,
  passwordError,
  showPassword,
  showConfirmPassword,
  onPasswordsChange,
  onPasswordErrorChange,
  onShowPasswordToggle,
  onShowConfirmPasswordToggle,
}: ChangePasswordTabProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="panel-header py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center space-x-2 text-base">
          <Lock className="h-5 w-5" />
          <span>Change Password</span>
        </CardTitle>
        <CardDescription className="text-panel-header-muted">
          Update your password (leave empty to keep current password)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              value={passwords.newPassword}
              onChange={e => {
                onPasswordsChange(prev => ({ ...prev, newPassword: e.target.value }))
                onPasswordErrorChange('')
              }}
              placeholder="Enter new password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2"
              onClick={onShowPasswordToggle}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={passwords.confirmPassword}
              onChange={e => {
                onPasswordsChange(prev => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
                onPasswordErrorChange('')
              }}
              placeholder="Confirm new password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2"
              onClick={onShowConfirmPasswordToggle}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Password Error */}
        {passwordError && <StatusAlert variant="error">{passwordError}</StatusAlert>}
      </CardContent>
    </Card>
  )
}
