'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  FileCode,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  RotateCcw as Sync,
  CheckSquare,
  Square,
  GitBranch,
  Upload,
  Code as CodeIcon
} from 'lucide-react'
import { useTemplates, useTemplateCategories } from '../hooks/use-template-queries'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { getSourceBadgeVariant } from '../utils/template-utils'
import type { Template, TemplateFilters } from '../types'

interface TemplatesListProps {
  onEdit: (template: Template) => void
  onView: (templateId: number) => void
}

const EMPTY_SET: Set<number> = new Set()
const EMPTY_CATEGORIES: string[] = []

export function TemplatesList({ onEdit, onView }: TemplatesListProps) {
  const [filters, setFilters] = useState<TemplateFilters>({})
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(EMPTY_SET)

  const { templates, isLoading } = useTemplates({ filters })
  const { data: categories = EMPTY_CATEGORIES } = useTemplateCategories()
  const { deleteTemplate, bulkDeleteTemplates, syncTemplate } = useTemplateMutations()

  const handleFilterChange = (key: keyof TemplateFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '__all__' ? undefined : value
    }))
  }

  const toggleSelection = (templateId: number) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateId)) {
        newSet.delete(templateId)
      } else {
        newSet.add(templateId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedTemplates.size === templates.length) {
      setSelectedTemplates(EMPTY_SET)
    } else {
      setSelectedTemplates(new Set(templates.map(t => t.id)))
    }
  }

  const handleBulkDelete = async () => {
    const templateNames = templates
      .filter(t => selectedTemplates.has(t.id))
      .map(t => t.name)
      .join(', ')

    if (!confirm(`Are you sure you want to delete ${selectedTemplates.size} template(s)?\n\nTemplates: ${templateNames}`)) {
      return
    }

    await bulkDeleteTemplates.mutateAsync(Array.from(selectedTemplates))
    setSelectedTemplates(EMPTY_SET)
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'git':
        return GitBranch
      case 'file':
        return Upload
      case 'webeditor':
        return CodeIcon
      default:
        return FileCode
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <FileCode className="h-4 w-4" />
          Templates List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search templates..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={filters.category || '__all__'}
            onValueChange={(value) => handleFilterChange('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.source || '__all__'}
            onValueChange={(value) => handleFilterChange('source', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sources</SelectItem>
              <SelectItem value="git">Git Repository</SelectItem>
              <SelectItem value="file">File Upload</SelectItem>
              <SelectItem value="webeditor">Web Editor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedTemplates.size > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedTemplates.size} template(s) selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTemplates(EMPTY_SET)}
              >
                Clear Selection
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteTemplates.isPending}
            >
              {bulkDeleteTemplates.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span>Delete Selected</span>
            </Button>
          </div>
        )}

        {/* Templates Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleSelectAll}>
                      {selectedTemplates.size === templates.length && templates.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                      <span className="ml-2">Loading templates...</span>
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No templates found
                    </td>
                  </tr>
                ) : (
                  templates.map((template) => {
                    const SourceIcon = getSourceIcon(template.source)
                    const isSelected = selectedTemplates.has(template.id)
                    return (
                      <tr
                        key={template.id}
                        className={isSelected ? 'bg-blue-50' : ''}
                      >
                        <td className="px-4 py-4">
                          <button onClick={() => toggleSelection(template.id)}>
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{template.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={getSourceBadgeVariant(template.source)} className="flex items-center space-x-1 w-fit">
                            <SourceIcon className="h-3 w-3" />
                            <span>{template.source}</span>
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{template.template_type}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{template.category || '-'}</td>
                        <td className="px-6 py-4 max-w-xs truncate">{template.description || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline" onClick={() => onView(template.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onEdit(template)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {template.source === 'git' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => syncTemplate.mutate(template.id)}
                                disabled={syncTemplate.isPending}
                              >
                                <Sync className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this template?')) {
                                  deleteTemplate.mutate(template.id)
                                }
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
