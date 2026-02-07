'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileCode, Eye, Edit, Trash2, Search, RefreshCw } from 'lucide-react'
import type { Template } from '../types/templates'

interface TemplateListProps {
  templates: Template[]
  isLoading: boolean
  username?: string
  onView: (templateId: number) => void
  onEdit: (template: Template) => void
  onDelete: (templateId: number) => void
}

export function TemplateList({
  templates,
  isLoading,
  username,
  onView,
  onEdit,
  onDelete,
}: TemplateListProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTemplates = useMemo(() =>
    templates.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [templates, searchTerm]
  )

  const canEditTemplate = (template: Template) => template.created_by === username

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <FileCode className="h-4 w-4" />
          <span className="text-sm font-medium">Templates</span>
        </div>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Templates List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading templates...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No templates found. Create your first template!
            </div>
          ) : (
            filteredTemplates.map(template => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{template.name}</h3>
                        <Badge variant={template.scope === 'global' ? 'default' : 'outline'}>
                          {template.scope}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Updated: {new Date(template.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onView(template.id)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditTemplate(template) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEdit(template)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canEditTemplate(template) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDelete(template.id)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
