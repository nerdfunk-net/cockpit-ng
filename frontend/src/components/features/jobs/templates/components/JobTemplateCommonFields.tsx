import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Globe, Lock, ShieldAlert } from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import type { User } from '@/types/auth'

interface JobType {
  value: string
  label: string
  description: string
}

interface JobTemplateCommonFieldsProps {
  formName: string
  setFormName: (value: string) => void
  formJobType: string
  setFormJobType: (value: string) => void
  formDescription: string
  setFormDescription: (value: string) => void
  formIsGlobal: boolean
  setFormIsGlobal: (value: boolean) => void
  jobTypes: JobType[]
  user: User | null
  editingTemplate: boolean
  getJobTypeColor: (jobType: string) => string
}

export function JobTemplateCommonFields({
  formName,
  setFormName,
  formJobType,
  setFormJobType,
  formDescription,
  setFormDescription,
  formIsGlobal,
  setFormIsGlobal,
  jobTypes,
  user,
  editingTemplate,
  getJobTypeColor,
}: JobTemplateCommonFieldsProps) {
  const canCreateGlobalTemplate = hasPermission(user, 'jobs', 'write')

  return (
    <>
      {/* Name and Type in grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="template-name" className="text-sm font-medium text-foreground">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="template-name"
            placeholder="Enter template name"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            className="h-9 bg-card"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="job-type" className="text-sm font-medium text-foreground">
            Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formJobType}
            onValueChange={setFormJobType}
            disabled={editingTemplate}
          >
            <SelectTrigger id="job-type" className="h-9 bg-card">
              <SelectValue placeholder="Select job type" />
            </SelectTrigger>
            <SelectContent>
              {jobTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${getJobTypeColor(type.value)}`}
                    />
                    <span>{type.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-sm font-medium text-foreground">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Enter a description for this template"
          value={formDescription}
          onChange={e => setFormDescription(e.target.value)}
          className="bg-card resize-none"
          rows={2}
        />
      </div>

      {/* Global/Private Switch */}
      <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="is-global"
              checked={formIsGlobal}
              onCheckedChange={setFormIsGlobal}
              disabled={!canCreateGlobalTemplate}
            />
            <Label
              htmlFor="is-global"
              className="text-sm font-medium text-info-foreground cursor-pointer flex items-center gap-2"
            >
              {formIsGlobal ? (
                <>
                  <Globe className="h-4 w-4 text-info-foreground" />
                  Global Template
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-info-foreground" />
                  Private Template
                </>
              )}
            </Label>
          </div>
          {canCreateGlobalTemplate && (
            <Badge
              variant="secondary"
              className="text-xs bg-info text-info-foreground hover:bg-info"
            >
              {user?.roles?.includes('admin') ? 'Admin' : 'Write Access'}
            </Badge>
          )}
        </div>
        <p className="text-xs text-info-foreground">
          {formIsGlobal
            ? 'Global templates can be scheduled by all users'
            : 'Private templates can only be scheduled by you'}
        </p>
        {!canCreateGlobalTemplate && (
          <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-warning border border-warning-border">
            <ShieldAlert className="h-4 w-4 text-warning-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-warning-foreground">
              You don&apos;t have permission to create global templates. Contact your
              administrator to request{' '}
              <span className="font-mono font-semibold">jobs:write</span> permission.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
