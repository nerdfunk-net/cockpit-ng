'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Copy, Trash2, Globe, Lock, FileText } from 'lucide-react'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { JOB_TYPE_LABELS, JOB_TYPE_COLORS } from '../utils/constants'
import type { JobTemplate } from '../types'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusBadge } from '@/components/shared/status-badge'

interface TemplatesTableProps {
  templates: JobTemplate[]
  onEdit: (template: JobTemplate) => void
}

export function TemplatesTable({ templates, onEdit }: TemplatesTableProps) {
  const { deleteTemplate, copyTemplate } = useTemplateMutations()
  const { confirmDialog, openConfirm } = useConfirmDialog()

  const getJobTypeLabel = (jobType: string) => {
    return JOB_TYPE_LABELS[jobType] || jobType
  }

  const getJobTypeColor = (jobType: string) => {
    return JOB_TYPE_COLORS[jobType] || 'bg-muted-foreground'
  }

  const handleDelete = (id: number) => {
    openConfirm({
      title: 'Delete Template',
      description: 'Are you sure you want to delete this template?',
      onConfirm: () => deleteTemplate.mutateAsync(id),
      variant: 'destructive',
    })
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="panel-header py-2 px-4">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">
              Job Templates ({templates.length})
            </h3>
            <p className="text-panel-header-muted text-xs">
              Reusable job configurations for the scheduler
            </p>
          </div>
        </div>
      </div>
      <div className="bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="font-semibold text-muted-foreground">Name</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Type</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Inventory</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Scope</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Created By</TableHead>
              <TableHead className="font-semibold text-muted-foreground w-24">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(template => (
              <TableRow key={template.id} className="hover:bg-muted">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{template.name}</span>
                    {template.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-xs">
                        {template.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${getJobTypeColor(template.job_type)}`}
                    />
                    <span className="text-muted-foreground">
                      {getJobTypeLabel(template.job_type)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {template.inventory_source === 'all' ? (
                    <StatusBadge variant="info">
                      <Globe className="h-3 w-3 mr-1" />
                      All Devices
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="success">
                      <FileText className="h-3 w-3 mr-1" />
                      {template.inventory_name || 'Inventory'}
                    </StatusBadge>
                  )}
                </TableCell>
                <TableCell>
                  {template.is_global ? (
                    <StatusBadge variant="info">
                      <Globe className="h-3 w-3 mr-1" />
                      Global
                    </StatusBadge>
                  ) : (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {template.created_by || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(template)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      title="Edit template"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyTemplate.mutate(template)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-success-foreground"
                      title="Copy template"
                      disabled={copyTemplate.isPending}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      title="Delete template"
                      disabled={deleteTemplate.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog {...confirmDialog} />
    </div>
  )
}
