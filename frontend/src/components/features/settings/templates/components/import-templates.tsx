'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Search,
  AlertCircle,
  CheckCircle,
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImportableTemplates } from '../hooks/use-template-queries'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { getSourceBadgeVariant } from '../utils/template-utils'
import type { ImportableTemplate } from '../types'

const EMPTY_SUCCESS: string[] = []
const EMPTY_FAILED: string[] = []
const EMPTY_IMPORTABLE_TEMPLATES: ImportableTemplate[] = []

export function ImportTemplates() {
  const [importResults, setImportResults] = useState<{ success: string[], failed: string[] }>({
    success: EMPTY_SUCCESS,
    failed: EMPTY_FAILED
  })
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set())

  const {
    data: importableTemplates = EMPTY_IMPORTABLE_TEMPLATES,
    isLoading: isScanning,
    refetch: scanDirectory
  } = useImportableTemplates({ enabled: false })

  const { importTemplates } = useTemplateMutations()

  const toggleSelection = (filePath: string) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filePath)) {
        newSet.delete(filePath)
      } else {
        newSet.add(filePath)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedTemplates.size === importableTemplates.length) {
      setSelectedTemplates(new Set())
    } else {
      setSelectedTemplates(new Set(importableTemplates.map(t => t.file_path)))
    }
  }

  const handleImport = async () => {
    const filePaths = Array.from(selectedTemplates)
    if (filePaths.length === 0) return

    const result = await importTemplates.mutateAsync({
      filePaths,
      overwriteExisting: false
    })

    setImportResults({
      success: result.imported_templates || EMPTY_SUCCESS,
      failed: result.failed_templates || EMPTY_FAILED
    })
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Download className="h-4 w-4" />
          Import Templates from YAML Files
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Import Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Template Import Instructions</h3>
              <p className="text-blue-800 text-sm">
                This feature scans the <code className="bg-blue-100 px-1 rounded">./contributing-data</code> directory
                for YAML files containing template definitions. Each YAML file should have properties like name, source, type,
                category, and description. Perfect for initial setup or bulk template imports.
              </p>
            </div>
          </div>
        </div>

        {/* Scan Button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Available Templates</h3>
            <p className="text-gray-600 text-sm">
              {importableTemplates.length > 0
                ? `Found ${importableTemplates.length} importable templates`
                : 'Click "Scan Directory" to discover available templates'
              }
            </p>
          </div>
          <Button
            onClick={() => scanDirectory()}
            disabled={isScanning}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>Scan Directory</span>
          </Button>
        </div>

        {/* Import Results */}
        {(importResults.success.length > 0 || importResults.failed.length > 0) && (
          <div className="space-y-3">
            {importResults.success.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900 mb-2">Successfully Imported ({importResults.success.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {importResults.success.map(name => (
                        <Badge key={name} variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {importResults.failed.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900 mb-2">Failed to Import ({importResults.failed.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {importResults.failed.map(name => (
                        <Badge key={name} variant="outline" className="bg-red-100 text-red-800 border-red-300">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Templates Table */}
        {importableTemplates.length > 0 && (
          <div className="space-y-4">
            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="flex items-center space-x-2"
                >
                  {selectedTemplates.size === importableTemplates.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  <span>
                    {selectedTemplates.size === importableTemplates.length ? 'Deselect All' : 'Select All'}
                  </span>
                </Button>
                <span className="text-sm text-gray-600">
                  {selectedTemplates.size} of {importableTemplates.length} selected
                </span>
              </div>
              <Button
                onClick={handleImport}
                disabled={importTemplates.isPending || selectedTemplates.size === 0}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
              >
                {importTemplates.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Import Selected Templates</span>
              </Button>
            </div>

            {/* Templates Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={toggleSelectAll}
                            className="flex items-center justify-center w-4 h-4"
                          >
                            {selectedTemplates.size === importableTemplates.length ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select</span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {importableTemplates.map((template) => {
                      const isSelected = selectedTemplates.has(template.file_path)
                      return (
                        <tr
                          key={template.file_path}
                          className={cn(
                            "hover:bg-gray-50 transition-colors",
                            isSelected && "bg-blue-50"
                          )}
                        >
                          <td className="px-4 py-4">
                            <button
                              onClick={() => toggleSelection(template.file_path)}
                              className="flex items-center justify-center w-4 h-4"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Square className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{template.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getSourceBadgeVariant(template.source)}>
                              {template.source}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {template.template_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {template.category || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {template.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {template.file_path}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isScanning && importableTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Found</h3>
            <p className="text-gray-600 mb-4 max-w-md mx-auto">
              No YAML template files were found in the import directory. Make sure template files are placed in
              <code className="bg-gray-100 px-1 rounded mx-1">./contributing-data</code> and click &quot;Scan Directory&quot;.
            </p>
            <Button
              onClick={() => scanDirectory()}
              variant="outline"
              className="flex items-center space-x-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
            >
              <Search className="h-4 w-4" />
              <span>Scan Directory</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
