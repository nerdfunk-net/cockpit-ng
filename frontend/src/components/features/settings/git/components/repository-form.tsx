// Repository Form Component - Reusable for Create and Edit

import { UseFormReturn } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { REPOSITORY_CATEGORIES, AUTH_TYPES } from '../constants'
import { CredentialSelect } from './credential-select'
import { ConnectionTestPanel } from './connection-test-panel'
import type { RepositoryFormValues } from '../validation'
import type { GitCredential } from '../types'

interface RepositoryFormProps {
  form: UseFormReturn<RepositoryFormValues>
  credentials: GitCredential[]
  isSubmitting: boolean
  showConnectionTest?: boolean
  onConnectionTest?: () => void
  connectionTestStatus?: { type: 'success' | 'error'; text: string } | null
  isTestingConnection?: boolean
}

export function RepositoryForm({
  form,
  credentials,
  isSubmitting,
  showConnectionTest = true,
  onConnectionTest,
  connectionTestStatus,
  isTestingConnection = false,
}: RepositoryFormProps) {
  const { register, watch, setValue, formState: { errors } } = form
  const authType = watch('auth_type')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Repository Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-semibold text-gray-800">
            Repository Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="My Config Repository"
            {...register('name')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
          <p className="text-xs text-gray-600">Unique name to identify this repository</p>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-semibold text-gray-800">
            Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('category') ?? ''}
            onValueChange={(value) => setValue('category', value as RepositoryFormValues['category'])}
            disabled={isSubmitting}
          >
            <SelectTrigger id="category" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {REPOSITORY_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category.message}</p>
          )}
          <p className="text-xs text-gray-600">Purpose of this repository</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Repository URL */}
        <div className="space-y-2">
          <Label htmlFor="url" className="text-sm font-semibold text-gray-800">
            Repository URL <span className="text-destructive">*</span>
          </Label>
          <Input
            id="url"
            type="url"
            placeholder="https://github.com/username/repo.git"
            {...register('url')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          {errors.url && (
            <p className="text-xs text-destructive">{errors.url.message}</p>
          )}
          <p className="text-xs text-gray-600">Git repository URL</p>
        </div>

        {/* Branch */}
        <div className="space-y-2">
          <Label htmlFor="branch" className="text-sm font-semibold text-gray-800">
            Default Branch
          </Label>
          <Input
            id="branch"
            placeholder="main"
            {...register('branch')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-600">Default branch to use</p>
        </div>
      </div>

      {/* Authentication Type */}
      <div className="space-y-2">
        <Label htmlFor="auth_type" className="text-sm font-semibold text-gray-800">
          Authentication Type
        </Label>
        <Select
          value={authType}
          onValueChange={(value) => {
            setValue('auth_type', value as RepositoryFormValues['auth_type'])
            setValue('credential_name', '__none__')
          }}
          disabled={isSubmitting}
        >
          <SelectTrigger id="auth_type" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
            <SelectValue placeholder="Select authentication type" />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-600">How to authenticate with this repository</p>
      </div>

      {/* Credential Select (conditional) */}
      {authType !== 'none' && (
        <CredentialSelect
          authType={authType}
          credentials={credentials}
          value={watch('credential_name') ?? ''}
          onChange={(value) => setValue('credential_name', value)}
          disabled={isSubmitting}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Path */}
        <div className="space-y-2">
          <Label htmlFor="path" className="text-sm font-semibold text-gray-800">
            Path
          </Label>
          <Input
            id="path"
            placeholder="configs/"
            {...register('path')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-600">Path within repository (leave empty for root)</p>
        </div>

        {/* Verify SSL */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="verify-ssl"
              checked={watch('verify_ssl') ?? false}
              onCheckedChange={(checked) => setValue('verify_ssl', !!checked)}
              className="border-2 border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              disabled={isSubmitting}
            />
            <Label htmlFor="verify-ssl" className="text-sm font-semibold text-gray-800">
              Verify SSL certificates
            </Label>
          </div>
          <p className="text-xs text-gray-600">Disable for self-signed certificates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Git Author Name */}
        <div className="space-y-2">
          <Label htmlFor="git_author_name" className="text-sm font-semibold text-gray-800">
            Git Author Name
          </Label>
          <Input
            id="git_author_name"
            type="text"
            placeholder="e.g., Network Team (optional)"
            {...register('git_author_name')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-600">Name used for git commits (defaults to &quot;Cockpit-NG Automation&quot;)</p>
        </div>

        {/* Git Author Email */}
        <div className="space-y-2">
          <Label htmlFor="git_author_email" className="text-sm font-semibold text-gray-800">
            Git Author Email
          </Label>
          <Input
            id="git_author_email"
            type="email"
            placeholder="e.g., network@company.com (optional)"
            {...register('git_author_email')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          {errors.git_author_email && (
            <p className="text-xs text-destructive">{errors.git_author_email.message}</p>
          )}
          <p className="text-xs text-gray-600">Email used for git commits (defaults to &quot;noreply@cockpit-ng.local&quot;)</p>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold text-gray-800">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Optional description for this repository"
          rows={3}
          {...register('description')}
          className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 resize-none"
          disabled={isSubmitting}
        />
      </div>

      {/* Connection Test Panel (conditional) */}
      {showConnectionTest && (
        <>
          <Separator />
          <ConnectionTestPanel
            onTest={onConnectionTest}
            status={connectionTestStatus}
            isLoading={isTestingConnection}
            disabled={isSubmitting || !watch('url')}
          />
        </>
      )}
    </div>
  )
}
