'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import {
  Plus,
  Save,
  RotateCcw,
  GitBranch,
  Upload,
  Code,
  RefreshCw,
  FolderOpen,
  Play
} from 'lucide-react'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { useTemplateContent } from '../hooks/use-template-queries'
import { useToast } from '@/hooks/use-toast'
import {
  CANONICAL_CATEGORIES,
  FILE_ACCEPT_TYPES
} from '../utils/constants'
import { getTemplateNameFromFile } from '../utils/template-utils'
import type { Template, TemplateFormData } from '../types'

// Zod validation schema
const templateFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  source: z.enum(['git', 'file', 'webeditor']),
  template_type: z.string(),
  category: z.string(),
  description: z.string(),
  scope: z.enum(['global', 'private']),
  use_nautobot_context: z.boolean().optional(),

  // Git source fields
  git_repo_url: z.string().optional(),
  git_branch: z.string().optional(),
  git_path: z.string().optional(),
  git_username: z.string().optional(),
  git_token: z.string().optional(),

  // Editor source fields
  content: z.string().optional(),

  // File source fields
  filename: z.string().optional(),
})

type TemplateFormSchema = z.infer<typeof templateFormSchema>

interface TemplateFormProps {
  template?: Template | null
  onSuccess: () => void
  onCancel: () => void
  onSelectInventory?: () => void
  selectedInventory?: { id: number; name: string } | null
}

export function TemplateForm({
  template,
  onSuccess,
  onCancel,
  onSelectInventory,
  selectedInventory
}: TemplateFormProps) {
  const isEditMode = !!template
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [isRendering, setIsRendering] = useState(false)

  const { createTemplate, updateTemplate } = useTemplateMutations()
  const { toast } = useToast()

  // Fetch content only when editing
  const { data: templateContent, isLoading: isLoadingContent } = useTemplateContent(
    template?.id || null,
    { enabled: isEditMode }
  )

  // Prepare initial values based on mode
  const getInitialValues = useCallback((): TemplateFormSchema => {
    if (isEditMode && template && templateContent !== undefined) {
      const editSource = template.source === 'file' ? 'webeditor' : template.source
      return {
        name: template.name,
        source: editSource as 'git' | 'file' | 'webeditor',
        template_type: template.template_type,
        category: template.category || '__none__',
        description: template.description || '',
        scope: template.scope || 'global',
        use_nautobot_context: template.use_nautobot_context || false,
        git_repo_url: template.git_repo_url || '',
        git_branch: template.git_branch || 'main',
        git_path: template.git_path || '',
        git_username: '',
        git_token: '',
        content: templateContent || '',
      }
    }
    return {
      name: '',
      source: 'webeditor',
      template_type: 'jinja2',
      category: '__none__',
      description: '',
      scope: 'global',
      use_nautobot_context: false,
      git_repo_url: '',
      git_branch: 'main',
      git_path: '',
      git_username: '',
      git_token: '',
      content: '',
    }
  }, [isEditMode, template, templateContent])

  const form = useForm<TemplateFormSchema>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: getInitialValues(),
  })

  // Reset form when template or content changes
  useEffect(() => {
    const newValues = getInitialValues()
    form.reset(newValues)
    setSelectedFile(null)
    // Force form re-render by updating key
    setFormKey(prev => prev + 1)
  }, [template?.id, templateContent, isEditMode, getInitialValues, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    if (isEditMode && template) {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        formData: { ...data, source: data.source || '' } as TemplateFormData,
        selectedFile,
      })
    } else {
      await createTemplate.mutateAsync({
        formData: { ...data, source: data.source || '' } as TemplateFormData,
        selectedFile,
      })
    }
    onSuccess()
  })

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      form.setValue('filename', file.name)
      if (!form.getValues('name')) {
        form.setValue('name', getTemplateNameFromFile(file.name))
      }
    }
  }, [form])

  const handleRenderTemplate = useCallback(async () => {
    const formData = form.getValues()

    if (!formData.name) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a template name',
        variant: 'destructive'
      })
      return
    }

    // For Agent templates, require inventory selection
    if (formData.category === 'agent' && !selectedInventory) {
      toast({
        title: 'Validation Error',
        description: 'Please select an inventory for Agent templates',
        variant: 'destructive'
      })
      return
    }

    setIsRendering(true)
    try {
      // TODO: Call backend API to render template
      toast({
        title: 'Info',
        description: 'Template rendering will be implemented in backend'
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to render template',
        variant: 'destructive'
      })
    } finally {
      setIsRendering(false)
    }
  }, [form, selectedInventory, toast])

  const watchedSource = useWatch({ control: form.control, name: 'source' })
  const watchedCategory = useWatch({ control: form.control, name: 'category' })
  const watchedTemplateType = useWatch({ control: form.control, name: 'template_type' })

  if (isLoadingContent) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-600">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading template data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Plus className="h-4 w-4" />
          {isEditMode ? `Edit Template: ${template?.name}` : 'Create New Template'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form key={formKey} onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., cisco-ios-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <FormField
                control={form.control}
                name="template_type"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Template Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="jinja2">Jinja2</SelectItem>
                        <SelectItem value="text">Plain Text</SelectItem>
                        <SelectItem value="textfsm">TextFSM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No Category</SelectItem>
                        {CANONICAL_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Source <span className="text-red-500">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="git">Git Repository</SelectItem>
                        <SelectItem value="file">File Upload</SelectItem>
                        <SelectItem value="webeditor">Web Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Scope checkbox */}
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                  <FormControl>
                    <Checkbox
                      checked={field.value === 'global'}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? 'global' : 'private')
                      }
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>This template is global</FormLabel>
                    <FormDescription>
                      Global templates are visible to all users. Private templates are only visible to you.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Nautobot Context for Agent templates */}
            {watchedCategory === 'agent' && (
              <FormField
                control={form.control}
                name="use_nautobot_context"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 p-4 bg-purple-50 rounded-lg">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Use Nautobot data & context</FormLabel>
                      <FormDescription>
                        When enabled, this template will have access to Nautobot device data and context variables.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* Source-specific configurations */}
            {watchedSource === 'git' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-blue-700">
                    <GitBranch className="h-5 w-5" />
                    <span>Git Repository Configuration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="git_repo_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repository URL <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="https://github.com/user/repo.git" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="git_branch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <FormControl>
                            <Input placeholder="main" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="git_path"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>File Path</FormLabel>
                          <FormControl>
                            <Input placeholder="templates/template.j2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="git_username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username (if private)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="git_token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Access Token (if private)</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {watchedSource === 'file' && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-green-700">
                    <Upload className="h-5 w-5" />
                    <span>File Upload</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Template File</Label>
                    <Input
                      type="file"
                      accept={FILE_ACCEPT_TYPES}
                      onChange={handleFileChange}
                    />
                    {selectedFile && (
                      <p className="text-sm text-gray-600">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {watchedSource === 'webeditor' && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-yellow-700">
                    <Code className="h-5 w-5" />
                    <span>Web Editor</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Content <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full h-64 p-3 border-2 bg-white border-gray-300 rounded-md font-mono text-sm"
                            placeholder="Enter your template content here..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t gap-3">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onCancel} type="button">
                  <RotateCcw className="h-4 w-4" />
                  <span>{isEditMode ? 'Cancel Edit' : 'Reset'}</span>
                </Button>

                {watchedCategory === 'agent' && onSelectInventory && (
                  <Button
                    variant="outline"
                    onClick={onSelectInventory}
                    type="button"
                    className="border-purple-300 text-purple-700"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>
                      {selectedInventory ? `Inventory: ${selectedInventory.name}` : 'Select Inventory'}
                    </span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Render Template button - show only for Jinja2 templates */}
                {watchedTemplateType === 'jinja2' && (
                  <Button
                    variant="outline"
                    onClick={handleRenderTemplate}
                    type="button"
                    disabled={isRendering || !form.getValues('name') || (watchedCategory === 'agent' && !selectedInventory)}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {isRendering && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {!isRendering && <Play className="h-4 w-4" />}
                    <span>{isRendering ? 'Rendering...' : 'Render Template'}</span>
                  </Button>
                )}

                <Button
                  type="submit"
                  disabled={createTemplate.isPending || updateTemplate.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {(createTemplate.isPending || updateTemplate.isPending) && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}
                  <Save className="h-4 w-4" />
                  <span>
                    {isEditMode ? 'Update Template' : 'Create Template'}
                  </span>
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
