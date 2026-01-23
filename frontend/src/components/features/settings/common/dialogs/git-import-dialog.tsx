import { useState, useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/components/ui/form'
import {
  Download,
  Loader2,
  GitPullRequest,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import type {
  GitRepository,
  GitFile,
  GitRepoStatus,
  ImportStep
} from '../types'
import {
  EMPTY_GIT_REPOS,
  EMPTY_GIT_FILES,
  COCKPIT_CONFIGS_CATEGORY
} from '../utils/constants'

const importSchema = z.object({
  repositoryId: z.number().min(1, 'Please select a repository'),
  filePath: z.string().min(1, 'Please select a file'),
})

type ImportFormData = z.infer<typeof importSchema>

const DEFAULT_VALUES: Partial<ImportFormData> = {
  repositoryId: undefined,
  filePath: '',
}

interface GitImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (content: string) => void
  fileType?: 'yaml' | 'json' | 'text'
}

export function GitImportDialog({
  open,
  onOpenChange,
  onImport,
}: GitImportDialogProps) {
  const { apiCall } = useApi()
  const { toast } = useToast()

  // State
  const [gitRepos, setGitRepos] = useState<GitRepository[]>(EMPTY_GIT_REPOS)
  const [repoStatus, setRepoStatus] = useState<GitRepoStatus | null>(null)
  const [repoFiles, setRepoFiles] = useState<GitFile[]>(EMPTY_GIT_FILES)
  const [fileFilter, setFileFilter] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importStep, setImportStep] = useState<ImportStep>('select-repo')

  // Form
  const form = useForm<ImportFormData>({
    resolver: zodResolver(importSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const selectedRepoId = form.watch('repositoryId')
  const selectedFile = form.watch('filePath')

  // Filtered files based on search
  const filteredFiles = useMemo(() => {
    if (!fileFilter) return repoFiles
    const lower = fileFilter.toLowerCase()
    return repoFiles.filter(file =>
      file.path.toLowerCase().includes(lower)
    )
  }, [repoFiles, fileFilter])

  // Load Git repositories
  const loadGitRepos = useCallback(async () => {
    try {
      const response = await apiCall<{
        repositories: GitRepository[]
        total?: number
      }>('git-repositories/')

      if (response.repositories) {
        // Filter for cockpit_configs category
        const cockpitRepos = response.repositories.filter(repo =>
          repo.category?.toLowerCase() === COCKPIT_CONFIGS_CATEGORY && repo.is_active
        )
        setGitRepos(cockpitRepos)
      }
    } catch (error) {
      console.error('Error loading git repositories:', error)
      toast({
        title: 'Error',
        description: 'Failed to load git repositories',
        variant: 'destructive'
      })
    }
  }, [apiCall, toast])

  // Load repository files
  const loadRepoFiles = useCallback(async (repoId: number) => {
    try {
      const response = await apiCall<{
        success: boolean
        data?: {
          files: GitFile[]
          total_count?: number
          has_more?: boolean
        }
      }>(`git/${repoId}/files/search?query=&limit=5000`)

      if (response.success && response.data?.files) {
        setRepoFiles(response.data.files)

        if (response.data.has_more) {
          toast({
            title: 'Warning',
            description: `Repository has more than ${response.data.files.length} files. Only showing first ${response.data.files.length}. Use the filter to narrow results.`,
            variant: 'destructive'
          })
        }
      }
    } catch (error) {
      console.error('Error loading repository files:', error)
      toast({
        title: 'Error',
        description: 'Failed to load repository files',
        variant: 'destructive'
      })
    }
  }, [apiCall, toast])

  // Check repository status
  const checkRepoStatus = useCallback(async (repoId: number) => {
    try {
      setImportLoading(true)

      // Check if repo has been synced before
      const repoInfo = gitRepos.find(r => r.id === repoId)
      const hasBeenSynced = repoInfo?.last_sync !== null

      if (!hasBeenSynced) {
        // Repo never synced, needs initial clone
        setRepoStatus({ ahead_count: 0, behind_count: 1, is_clean: true })
        setImportStep('check-sync')
        return
      }

      const response = await apiCall<{
        success: boolean
        data?: GitRepoStatus
      }>(`git/${repoId}/status`)

      if (response.success && response.data) {
        setRepoStatus(response.data)

        // If repo is behind, stay on sync check step
        if (response.data.behind_count > 0) {
          setImportStep('check-sync')
        } else {
          // Load files if already synced
          await loadRepoFiles(repoId)
          setImportStep('select-file')
        }
      }
    } catch (error) {
      console.error('Error checking repo status:', error)
      // If status check fails, assume repo doesn't exist locally
      setRepoStatus({ ahead_count: 0, behind_count: 1, is_clean: true })
      setImportStep('check-sync')
    } finally {
      setImportLoading(false)
    }
  }, [apiCall, gitRepos, loadRepoFiles])

  // Sync repository
  const syncRepo = useCallback(async (repoId: number) => {
    try {
      setImportLoading(true)
      const response = await apiCall<{
        success: boolean
        message?: string
      }>(`git/${repoId}/sync`, {
        method: 'POST',
      })

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Repository synced successfully',
        })
        // Reload status and files
        await checkRepoStatus(repoId)
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to sync repository',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error syncing repository:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync repository',
        variant: 'destructive'
      })
    } finally {
      setImportLoading(false)
    }
  }, [apiCall, toast, checkRepoStatus])

  // Import file from Git
  const handleImport = form.handleSubmit(async (data) => {
    try {
      setImportLoading(true)

      // Get auth token
      const token = useAuthStore.getState().token
      if (!token) {
        toast({
          title: 'Error',
          description: 'Not authenticated',
          variant: 'destructive'
        })
        return
      }

      // Read file content
      const fileResponse = await fetch(
        `/api/proxy/git/${data.repositoryId}/file-content?path=${encodeURIComponent(data.filePath)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!fileResponse.ok) {
        throw new Error('Failed to read file content from repository')
      }

      let fileContent = await fileResponse.text()

      // Check if content is double-encoded JSON string
      try {
        if (fileContent.startsWith('"') && fileContent.endsWith('"')) {
          fileContent = JSON.parse(fileContent)
        }
      } catch {
        // Not JSON, use as-is
      }

      // Call parent handler
      onImport(fileContent)

      // Close dialog and reset
      onOpenChange(false)
      form.reset(DEFAULT_VALUES)
      setFileFilter('')
      setRepoStatus(null)
      setRepoFiles(EMPTY_GIT_FILES)
      setImportStep('select-repo')

      toast({
        title: 'Success',
        description: `File "${data.filePath}" imported successfully. Click "Save Mapping" to persist changes.`,
      })
    } catch (error) {
      console.error('Error importing file:', error)
      toast({
        title: 'Error',
        description: 'Failed to import file from repository',
        variant: 'destructive'
      })
    } finally {
      setImportLoading(false)
    }
  })

  // Handle repository selection
  const handleRepoSelect = useCallback(async (repoId: string) => {
    const id = parseInt(repoId)
    form.setValue('repositoryId', id)
    await checkRepoStatus(id)
  }, [form, checkRepoStatus])

  // Load repos when dialog opens
  useEffect(() => {
    if (open) {
      loadGitRepos()
    }
  }, [open, loadGitRepos])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Import SNMP Mapping from Git</span>
          </DialogTitle>
          <DialogDescription>
            {importStep === 'select-repo' && 'Select a Cockpit Configs repository to import from'}
            {importStep === 'check-sync' && 'Check repository synchronization status'}
            {importStep === 'select-file' && 'Select a file to import'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleImport} className="space-y-4 py-4">
            {/* Step 1: Select Repository */}
            {importStep === 'select-repo' && (
              <FormField
                control={form.control}
                name="repositoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cockpit Configs Repository</FormLabel>
                    <FormControl>
                      {gitRepos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No Cockpit Configs repositories found. Please add a repository with category &quot;Cockpit Configs&quot; first.
                        </p>
                      ) : (
                        <Select
                          value={field.value?.toString()}
                          onValueChange={handleRepoSelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a repository" />
                          </SelectTrigger>
                          <SelectContent>
                            {gitRepos.map((repo) => (
                              <SelectItem key={repo.id} value={repo.id.toString()}>
                                {repo.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 2: Check Sync Status */}
            {importStep === 'check-sync' && repoStatus && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-yellow-900">Repository Not Synced</h4>
                    <p className="text-sm text-yellow-800 mt-1">
                      This repository is {repoStatus.behind_count} commit(s) behind the remote.
                      Please sync the repository to get the latest files.
                    </p>
                    <Button
                      type="button"
                      onClick={() => selectedRepoId && syncRepo(selectedRepoId)}
                      disabled={importLoading}
                      className="mt-3 flex items-center space-x-2"
                    >
                      {importLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GitPullRequest className="h-4 w-4" />
                      )}
                      <span>Sync Repository (Git Pull)</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Select File */}
            {importStep === 'select-file' && (
              <div className="space-y-4">
                {repoStatus && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">
                        Repository is up to date
                      </span>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="filePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select File to Import</FormLabel>
                      <FormControl>
                        {repoFiles.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No files found in this repository.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              type="text"
                              placeholder="Filter files..."
                              value={fileFilter}
                              onChange={(e) => setFileFilter(e.target.value)}
                            />
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a file" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {filteredFiles.map((file) => (
                                  <SelectItem key={file.path} value={file.path}>
                                    <div className="flex items-center space-x-2">
                                      <FileText className="h-4 w-4" />
                                      <span>{file.path}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {fileFilter && (
                              <p className="text-xs text-muted-foreground">
                                Showing {filteredFiles.length} of {repoFiles.length} files
                              </p>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        The selected file content will be loaded into the editor.
                        You must click &quot;Save Mapping&quot; to persist the changes.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  form.reset(DEFAULT_VALUES)
                  setFileFilter('')
                  setRepoStatus(null)
                  setRepoFiles(EMPTY_GIT_FILES)
                  setImportStep('select-repo')
                }}
              >
                Cancel
              </Button>
              {importStep === 'select-file' && selectedFile && (
                <Button
                  type="submit"
                  disabled={importLoading || !selectedFile}
                  className="flex items-center space-x-2"
                >
                  {importLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>Import File</span>
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
