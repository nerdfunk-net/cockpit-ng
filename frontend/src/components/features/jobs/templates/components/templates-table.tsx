'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Copy, Trash2, Globe, Lock, FileText } from 'lucide-react'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { JOB_TYPE_LABELS, JOB_TYPE_COLORS } from '../utils/constants'
import type { JobTemplate } from '../types'

interface TemplatesTableProps {
  templates: JobTemplate[]
  onEdit: (template: JobTemplate) => void
}

export function TemplatesTable({ templates, onEdit }: TemplatesTableProps) {
  const { deleteTemplate, copyTemplate } = useTemplateMutations()

  const getJobTypeLabel = (jobType: string) => {
    return JOB_TYPE_LABELS[jobType] || jobType
  }

  const getJobTypeColor = (jobType: string) => {
    return JOB_TYPE_COLORS[jobType] || 'bg-gray-500'
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    await deleteTemplate.mutateAsync(id)
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Job Templates ({templates.length})</h3>
            <p className="text-blue-100 text-xs">Reusable job configurations for the scheduler</p>
          </div>
        </div>
      </div>
      <div className="bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-gray-700">Name</TableHead>
              <TableHead className="font-semibold text-gray-700">Type</TableHead>
              <TableHead className="font-semibold text-gray-700">Inventory</TableHead>
              <TableHead className="font-semibold text-gray-700">Scope</TableHead>
              <TableHead className="font-semibold text-gray-700">Created By</TableHead>
              <TableHead className="font-semibold text-gray-700 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{template.name}</span>
                    {template.description && (
                      <span className="text-xs text-gray-500 truncate max-w-xs">
                        {template.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${getJobTypeColor(template.job_type)}`} />
                    <span className="text-gray-700">{getJobTypeLabel(template.job_type)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {template.inventory_source === "all" ? (
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      <Globe className="h-3 w-3 mr-1" />
                      All Devices
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <FileText className="h-3 w-3 mr-1" />
                      {template.inventory_name || "Inventory"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {template.is_global ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      <Globe className="h-3 w-3 mr-1" />
                      Global
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-gray-600 text-sm">
                  {template.created_by || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(template)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                      title="Edit template"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyTemplate.mutate(template)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-green-600"
                      title="Copy template"
                      disabled={copyTemplate.isPending}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
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
    </div>
  )
}
