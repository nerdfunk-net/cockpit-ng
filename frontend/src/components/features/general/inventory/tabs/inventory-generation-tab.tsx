/**
 * Inventory Generation Tab Component
 * Handles template selection and inventory generation
 */

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Download, GitBranch, Settings, Copy } from 'lucide-react'
import { buildOperationsFromConditions } from '../utils'
import type { ApiCallType, DeviceInfo, LogicalCondition } from '../types'

type InventoryGenerationType = ReturnType<typeof import('../hooks').useInventoryGeneration>
type GitOperationsType = ReturnType<typeof import('../hooks').useGitOperations>

interface InventoryGenerationTabProps {
  inventoryGeneration: InventoryGenerationType
  gitOperations: GitOperationsType
  previewDevices: DeviceInfo[]
  deviceConditions: LogicalCondition[]
  apiCall: ApiCallType
  token: string | null
}

export function InventoryGenerationTab({
  inventoryGeneration,
  gitOperations,
  previewDevices,
  deviceConditions,
  apiCall,
  token,
}: InventoryGenerationTabProps) {
  const {
    templateCategories,
    selectedCategory,
    availableTemplates,
    selectedTemplate,
    generatedInventory,
    showInventorySection,
    isGeneratingInventory,
    setSelectedCategory,
    setSelectedTemplate,
    setAvailableTemplates,
    setGeneratedInventory,
    setShowInventorySection,
    setIsGeneratingInventory,
  } = inventoryGeneration

  const {
    gitRepositories,
    selectedGitRepo,
    isPushingToGit,
    setSelectedGitRepo,
    setIsPushingToGit,
    updateGitPushResult,
  } = gitOperations

  const loadTemplatesForCategory = async (category: string) => {
    if (!category) {
      setAvailableTemplates([])
      return
    }

    try {
      const response = await apiCall<{ templates: Array<{ name: string }> }>(`templates?category=${encodeURIComponent(category)}`)
      setAvailableTemplates(response.templates.map(t => t.name))
    } catch (error) {
      console.error('Error loading templates for category:', error)
      setAvailableTemplates([])
    }
  }

  const generateInventory = async () => {
    if (!selectedCategory || !selectedTemplate) {
      alert('Please select both template category and name.')
      return
    }

    setIsGeneratingInventory(true)
    try {
      const operations = buildOperationsFromConditions(deviceConditions)
      const response = await apiCall<{
        inventory_content: string
        template_used: string
        device_count: number
      }>('ansible-inventory/generate', {
        method: 'POST',
        body: {
          operations,
          template_name: selectedTemplate,
          template_category: selectedCategory,
        },
      })

      setGeneratedInventory(response.inventory_content)
      setShowInventorySection(true)
    } catch (error) {
      console.error('Error generating inventory:', error)
      alert('Error generating inventory: ' + (error as Error).message)
    } finally {
      setIsGeneratingInventory(false)
    }
  }

  const downloadInventory = async () => {
    if (!selectedCategory || !selectedTemplate) {
      alert('Please select both template category and name.')
      return
    }

    try {
      const operations = buildOperationsFromConditions(deviceConditions)

      // Use fetch for file download
      const response = await fetch('/api/proxy/ansible-inventory/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operations,
          template_name: selectedTemplate,
          template_category: selectedCategory,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'inventory.yaml'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      console.error('Error downloading inventory:', error)
      alert('Error downloading inventory: ' + (error as Error).message)
    }
  }

  const pushToGit = async () => {
    if (!selectedCategory || !selectedTemplate) {
      alert('Please select both template category and name.')
      return
    }

    if (!selectedGitRepo) {
      alert('Please select a Git repository.')
      return
    }

    setIsPushingToGit(true)
    try {
      const operations = buildOperationsFromConditions(deviceConditions)

      const response = await apiCall<{
        success: boolean
        message: string
        repository: string
        branch: string
        file: string
        device_count: number
        commit_message: string
      }>('ansible-inventory/push-to-git', {
        method: 'POST',
        body: {
          operations,
          template_name: selectedTemplate,
          template_category: selectedCategory,
          repository_id: selectedGitRepo,
        },
      })

      if (response.success) {
        // Store result and show modal
        updateGitPushResult({
          repository: response.repository,
          branch: response.branch,
          file: response.file,
          device_count: response.device_count,
          commit_message: response.commit_message,
        })

        // Also show the generated inventory in the UI
        setShowInventorySection(true)

        // If inventory wasn't generated yet, fetch it for display
        if (!generatedInventory) {
          const inventoryResponse = await apiCall<{
            inventory_content: string
            template_used: string
            device_count: number
          }>('ansible-inventory/generate', {
            method: 'POST',
            body: {
              operations,
              template_name: selectedTemplate,
              template_category: selectedCategory,
            },
          })
          setGeneratedInventory(inventoryResponse.inventory_content)
        }
      }
    } catch (error) {
      console.error('Error pushing to Git:', error)
      alert('Error pushing to Git: ' + (error as Error).message)
    } finally {
      setIsPushingToGit(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedInventory)
      alert('Inventory copied to clipboard!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      alert('Failed to copy to clipboard')
    }
  }

  return (
    <>
      {/* Template Selection */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Template Selection and Final Generation</span>
          </div>
          <div className="text-xs text-blue-100">
            Select a Jinja2 template to generate the final Ansible inventory.
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {/* Single row: All inputs and buttons with separator between groups */}
          <div className="flex flex-wrap items-end gap-4">
            {/* Group 1: Template selection and actions */}
            <div className="space-y-2">
              <Label htmlFor="category">Template Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value)
                  setSelectedTemplate('')
                  loadTemplatesForCategory(value)
                }}
              >
                <SelectTrigger className="w-[180px] border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                  <SelectValue placeholder="Select Category..." />
                </SelectTrigger>
                <SelectContent>
                  {templateCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Template Name</Label>
              <Select
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
                disabled={!selectedCategory}
              >
                <SelectTrigger className="w-[200px] border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                  <SelectValue placeholder="Select Template..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template} value={template}>
                      {template}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={downloadInventory}
              disabled={!selectedCategory || !selectedTemplate}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </Button>

            <Button
              onClick={generateInventory}
              disabled={!selectedCategory || !selectedTemplate || isGeneratingInventory}
              size="sm"
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Settings className="h-4 w-4" />
              <span>{isGeneratingInventory ? 'Creating...' : 'Create Inventory'}</span>
            </Button>

            {/* Separator */}
            <div className="h-9 w-px bg-slate-300" />

            {/* Group 2: Git operations */}
            <div className="space-y-2">
              <Label htmlFor="gitRepo">Git Repository</Label>
              <Select
                value={selectedGitRepo?.toString() || ''}
                onValueChange={(value) => setSelectedGitRepo(parseInt(value))}
              >
                <SelectTrigger className="w-[200px] border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                  <SelectValue placeholder="Select Repository..." />
                </SelectTrigger>
                <SelectContent>
                  {gitRepositories.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No repositories configured
                    </SelectItem>
                  ) : (
                    gitRepositories.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id.toString()}>
                        {repo.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={pushToGit}
              disabled={!selectedCategory || !selectedTemplate || !selectedGitRepo || isPushingToGit}
              variant="outline"
              className="flex items-center space-x-2 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400"
            >
              <GitBranch className="h-4 w-4" />
              <span>{isPushingToGit ? 'Pushing...' : 'Push to Git'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Generated Inventory */}
      {showInventorySection && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Generated Inventory</span>
            </div>
            <div className="text-xs text-blue-100">
              Final inventory ({previewDevices.length} devices) generated using {selectedCategory}/{selectedTemplate}
            </div>
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30 flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </Button>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <Textarea
              value={generatedInventory}
              readOnly
              className="font-mono text-sm min-h-[400px] resize-none"
              style={{ fontFamily: 'Courier New, monospace' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
