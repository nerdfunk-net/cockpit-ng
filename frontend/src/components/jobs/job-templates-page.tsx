"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  Trash2,
  Edit,
  Copy,
  FileText,
  Globe,
  Lock,
  Loader2,
} from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"
import { JobTemplateCommonFields } from "./shared/JobTemplateCommonFields"
import { JobTemplateConfigRepoSection } from "./shared/JobTemplateConfigRepoSection"
import { JobTemplateInventorySection } from "./shared/JobTemplateInventorySection"
import { BackupJobTemplate } from "./job-template-types/BackupJobTemplate"
import { RunCommandsJobTemplate } from "./job-template-types/RunCommandsJobTemplate"
import { SyncDevicesJobTemplate } from "./job-template-types/SyncDevicesJobTemplate"
import { CompareDevicesJobTemplate } from "./job-template-types/CompareDevicesJobTemplate"
import { ScanPrefixesJobTemplate } from "./job-template-types/ScanPrefixesJobTemplate"

interface JobTemplate {
  id: number
  name: string
  job_type: string
  description?: string
  config_repository_id?: number
  inventory_source: "all" | "inventory"
  inventory_repository_id?: number
  inventory_name?: string
  command_template_name?: string
  backup_running_config_path?: string
  backup_startup_config_path?: string
  write_timestamp_to_custom_field?: boolean
  timestamp_custom_field_name?: string
  activate_changes_after_sync?: boolean
  scan_resolve_dns?: boolean
  scan_ping_count?: number
  scan_timeout_ms?: number
  scan_retries?: number
  scan_interval_ms?: number
  scan_custom_field_name?: string
  scan_custom_field_value?: string
  scan_response_custom_field_name?: string
  scan_max_ips?: number
  parallel_tasks?: number
  is_global: boolean
  user_id?: number
  created_by?: string
  created_at: string
  updated_at: string
}

interface JobType {
  value: string
  label: string
  description: string
}

interface GitRepository {
  id: number
  name: string
  url: string
  branch: string
  category: string
}

interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
}

interface CommandTemplate {
  id: number
  name: string
  category: string
}

interface CustomField {
  id: string
  name?: string
  key: string
  label: string
  type: {
    value: string
    label: string
  }
}

const EMPTY_TEMPLATES: JobTemplate[] = []
const EMPTY_TYPES: JobType[] = []
const EMPTY_REPOS: GitRepository[] = []
const EMPTY_INVENTORIES: SavedInventory[] = []
const EMPTY_CMD_TEMPLATES: CommandTemplate[] = []
const EMPTY_CUSTOM_FIELDS: CustomField[] = []

export function JobTemplatesPage() {
  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const { toast } = useToast()

  const [templates, setTemplates] = useState<JobTemplate[]>(EMPTY_TEMPLATES)
  const [jobTypes, setJobTypes] = useState<JobType[]>(EMPTY_TYPES)
  const [configRepos, setConfigRepos] = useState<GitRepository[]>(EMPTY_REPOS)
  // Inventory repos no longer used - using database storage
  // const [inventoryRepos, setInventoryRepos] = useState<GitRepository[]>(EMPTY_REPOS)
  const [savedInventories, setSavedInventories] = useState<SavedInventory[]>(EMPTY_INVENTORIES)
  const [commandTemplates, setCommandTemplates] = useState<CommandTemplate[]>(EMPTY_CMD_TEMPLATES)
  const [customFields, setCustomFields] = useState<CustomField[]>(EMPTY_CUSTOM_FIELDS)

  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null)
  const [loadingInventories, setLoadingInventories] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formJobType, setFormJobType] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formConfigRepoId, setFormConfigRepoId] = useState<number | null>(null)
  const [formInventorySource, setFormInventorySource] = useState<"all" | "inventory">("all")
  // Inventory repo ID no longer used - using database storage
  // const [formInventoryRepoId, setFormInventoryRepoId] = useState<number | null>(null)
  const [formInventoryName, setFormInventoryName] = useState("")
  const [formCommandTemplate, setFormCommandTemplate] = useState("")
  const [formBackupRunningConfigPath, setFormBackupRunningConfigPath] = useState("")
  const [formBackupStartupConfigPath, setFormBackupStartupConfigPath] = useState("")
  const [formWriteTimestampToCustomField, setFormWriteTimestampToCustomField] = useState(false)
  const [formTimestampCustomFieldName, setFormTimestampCustomFieldName] = useState("")
  const [formParallelTasks, setFormParallelTasks] = useState(1)
  const [formActivateChangesAfterSync, setFormActivateChangesAfterSync] = useState(true)
  const [formScanResolveDns, setFormScanResolveDns] = useState(false)
  const [formScanPingCount, setFormScanPingCount] = useState("")
  const [formScanTimeoutMs, setFormScanTimeoutMs] = useState("")
  const [formScanRetries, setFormScanRetries] = useState("")
  const [formScanIntervalMs, setFormScanIntervalMs] = useState("")
  const [formScanCustomFieldName, setFormScanCustomFieldName] = useState("")
  const [formScanCustomFieldValue, setFormScanCustomFieldValue] = useState("")
  const [formScanResponseCustomFieldName, setFormScanResponseCustomFieldName] = useState("")
  const [formScanMaxIps, setFormScanMaxIps] = useState("")
  const [formIsGlobal, setFormIsGlobal] = useState(false)

  // Get job type label
  const getJobTypeLabel = (jobType: string) => {
    const type = jobTypes.find(t => t.value === jobType)
    return type?.label || jobType
  }

  // Get job type color
  const getJobTypeColor = (jobType: string) => {
    switch (jobType) {
      case "backup":
        return "bg-blue-500"
      case "compare_devices":
        return "bg-purple-500"
      case "run_commands":
        return "bg-green-500"
      case "cache_devices":
        return "bg-cyan-500"
      case "sync_devices":
        return "bg-orange-500"
      case "scan_prefixes":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/job-templates", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error("Error fetching job templates:", error)
    } finally {
      setLoading(false)
    }
  }, [token])

  // Fetch job types
  const fetchJobTypes = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/job-templates/types", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setJobTypes(data || [])
      }
    } catch (error) {
      console.error("Error fetching job types:", error)
    }
  }, [token])

  // Fetch config repositories
  const fetchConfigRepos = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/git-repositories?category=device_configs", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setConfigRepos(data.repositories || [])
      }
    } catch (error) {
      console.error("Error fetching config repositories:", error)
    }
  }, [token])

  // Inventory repositories no longer used - using database storage
  // const fetchInventoryRepos = useCallback(async () => { ... }, [token])

  // Fetch saved inventories from database (no longer repository-based)
  const fetchSavedInventories = useCallback(async () => {
    if (!token) return

    setLoadingInventories(true)
    try {
      const response = await fetch('/api/proxy/inventory', {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSavedInventories(data.inventories || [])
      }
    } catch (error) {
      console.error("Error fetching saved inventories:", error)
      setSavedInventories([])
    } finally {
      setLoadingInventories(false)
    }
  }, [token])

  // Fetch command templates
  const fetchCommandTemplates = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/templates", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCommandTemplates(data.templates || [])
      }
    } catch (error) {
      console.error("Error fetching command templates:", error)
    }
  }, [token])

  // Fetch custom fields for devices
  const fetchCustomFields = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/nautobot/custom-fields/devices", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        // The endpoint returns an array directly
        const allFields = Array.isArray(data) ? data : (data.results || [])
        // Filter for text and date type custom fields that can hold timestamp
        // The type field is an object with {value, label}
        const fields = allFields.filter((cf: CustomField) => {
          const cfType = cf.type?.value?.toLowerCase() || ''
          return ["text", "date", "datetime", "url"].includes(cfType)
        })
        setCustomFields(fields)
      }
    } catch (error) {
      console.error("Error fetching custom fields:", error)
    }
  }, [token])

  useEffect(() => {
    fetchTemplates()
    fetchJobTypes()
    fetchConfigRepos()
    // fetchInventoryRepos() // No longer needed - using database
    fetchSavedInventories() // Pre-load inventories for job templates
    fetchCommandTemplates()
    fetchCustomFields()
  }, [fetchTemplates, fetchJobTypes, fetchConfigRepos, fetchSavedInventories, fetchCommandTemplates, fetchCustomFields])

  // When inventory source changes to "inventory", fetch inventories from database
  useEffect(() => {
    if (formInventorySource === "inventory") {
      fetchSavedInventories()
    }
  }, [formInventorySource, fetchSavedInventories])

  const resetForm = useCallback(() => {
    setFormName("")
    setFormJobType("")
    setFormDescription("")
    setFormConfigRepoId(null)
    setFormInventorySource("all")
    // setFormInventoryRepoId(null) // No longer used
    setFormInventoryName("")
    setFormCommandTemplate("")
    setFormBackupRunningConfigPath("")
    setFormBackupStartupConfigPath("")
    setFormWriteTimestampToCustomField(false)
    setFormTimestampCustomFieldName("")
    setFormParallelTasks(1)
    setFormActivateChangesAfterSync(true)
    setFormScanResolveDns(false)
    setFormScanPingCount("")
    setFormScanTimeoutMs("")
    setFormScanRetries("")
    setFormScanIntervalMs("")
    setFormScanCustomFieldName("")
    setFormScanCustomFieldValue("")
    setFormScanResponseCustomFieldName("")
    setFormScanMaxIps("")
    setFormIsGlobal(false)
    setEditingTemplate(null)
    setSavedInventories([])
  }, [])

  const handleEditTemplate = useCallback((template: JobTemplate) => {
    setEditingTemplate(template)
    setFormName(template.name)
    setFormJobType(template.job_type)
    setFormDescription(template.description || "")
    setFormConfigRepoId(template.config_repository_id || null)
    setFormInventorySource(template.inventory_source)
    // setFormInventoryRepoId(template.inventory_repository_id || null) // No longer used
    setFormInventoryName(template.inventory_name || "")
    setFormCommandTemplate(template.command_template_name || "")
    setFormBackupRunningConfigPath(template.backup_running_config_path || "")
    setFormBackupStartupConfigPath(template.backup_startup_config_path || "")
    setFormWriteTimestampToCustomField(template.write_timestamp_to_custom_field ?? false)
    setFormTimestampCustomFieldName(template.timestamp_custom_field_name || "")
    setFormParallelTasks(template.parallel_tasks || 1)
    setFormActivateChangesAfterSync(template.activate_changes_after_sync ?? true)
    setFormScanResolveDns(template.scan_resolve_dns ?? false)
    setFormScanPingCount(template.scan_ping_count?.toString() || "")
    setFormScanTimeoutMs(template.scan_timeout_ms?.toString() || "")
    setFormScanRetries(template.scan_retries?.toString() || "")
    setFormScanIntervalMs(template.scan_interval_ms?.toString() || "")
    setFormScanCustomFieldName(template.scan_custom_field_name || "")
    setFormScanCustomFieldValue(template.scan_custom_field_value || "")
    setFormScanResponseCustomFieldName(template.scan_response_custom_field_name || "")
    setFormScanMaxIps(template.scan_max_ips?.toString() || "")
    setFormIsGlobal(template.is_global)
    setIsDialogOpen(true)
  }, [])

  const handleSaveTemplate = useCallback(async () => {
    if (!token || !formName || !formJobType) {
      toast({
        title: "Validation Error",
        description: "Name and Type are required fields.",
        variant: "destructive"
      })
      return
    }

    // Validate inventory selection
    if (formInventorySource === "inventory" && !formInventoryName) {
      toast({
        title: "Validation Error",
        description: "Please select a saved inventory when using 'Use Saved Inventory'.",
        variant: "destructive"
      })
      return
    }

    // Validate command template for run_commands
    if (formJobType === "run_commands" && !formCommandTemplate) {
      toast({
        title: "Validation Error",
        description: "Please select a command template for 'Run Commands' type.",
        variant: "destructive"
      })
      return
    }

    // Validate backup paths for backup job type (optional - will use defaults if not specified)
    if (formJobType === "backup" && formBackupRunningConfigPath && !formBackupStartupConfigPath) {
      toast({
        title: "Validation Error",
        description: "If you specify a running config path, you must also specify a startup config path.",
        variant: "destructive"
      })
      return
    }
    if (formJobType === "backup" && !formBackupRunningConfigPath && formBackupStartupConfigPath) {
      toast({
        title: "Validation Error",
        description: "If you specify a startup config path, you must also specify a running config path.",
        variant: "destructive"
      })
      return
    }

    // Validate custom field selection when timestamp writing is enabled
    if (formJobType === "backup" && formWriteTimestampToCustomField && !formTimestampCustomFieldName) {
      toast({
        title: "Validation Error",
        description: "Please select a custom field when 'Write timestamp to custom field' is enabled.",
        variant: "destructive"
      })
      return
    }

    try {
      const payload = {
        name: formName,
        job_type: formJobType,
        description: formDescription || undefined,
        config_repository_id: formConfigRepoId || undefined,
        inventory_source: formInventorySource,
        // inventory_repository_id no longer used - database storage
        inventory_name: formInventorySource === "inventory" ? formInventoryName : undefined,
        command_template_name: formJobType === "run_commands" ? formCommandTemplate : undefined,
        backup_running_config_path: formJobType === "backup" ? formBackupRunningConfigPath : undefined,
        backup_startup_config_path: formJobType === "backup" ? formBackupStartupConfigPath : undefined,
        write_timestamp_to_custom_field: formJobType === "backup" ? formWriteTimestampToCustomField : undefined,
        timestamp_custom_field_name: formJobType === "backup" && formWriteTimestampToCustomField ? formTimestampCustomFieldName : undefined,
        parallel_tasks: formJobType === "backup" ? formParallelTasks : undefined,
        activate_changes_after_sync: formJobType === "sync_devices" ? formActivateChangesAfterSync : undefined,
        scan_resolve_dns: formJobType === "scan_prefixes" ? formScanResolveDns : undefined,
        scan_ping_count: formJobType === "scan_prefixes" && formScanPingCount ? parseInt(formScanPingCount) : undefined,
        scan_timeout_ms: formJobType === "scan_prefixes" && formScanTimeoutMs ? parseInt(formScanTimeoutMs) : undefined,
        scan_retries: formJobType === "scan_prefixes" && formScanRetries ? parseInt(formScanRetries) : undefined,
        scan_interval_ms: formJobType === "scan_prefixes" && formScanIntervalMs ? parseInt(formScanIntervalMs) : undefined,
        scan_custom_field_name: formJobType === "scan_prefixes" ? formScanCustomFieldName : undefined,
        scan_custom_field_value: formJobType === "scan_prefixes" ? formScanCustomFieldValue : undefined,
        scan_response_custom_field_name: formJobType === "scan_prefixes" ? formScanResponseCustomFieldName : undefined,
        scan_max_ips: formJobType === "scan_prefixes" && formScanMaxIps ? parseInt(formScanMaxIps) : undefined,
        is_global: formIsGlobal
      }

      if (editingTemplate) {
        // Update existing template
        const response = await fetch(`/api/proxy/api/job-templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          setIsDialogOpen(false)
          resetForm()
          fetchTemplates()
          toast({
            title: "Template Updated",
            description: `Job template "${formName}" has been updated successfully.`,
          })
        } else {
          const error = await response.json()
          toast({
            title: "Update Failed",
            description: error.detail || "Failed to update template.",
            variant: "destructive"
          })
        }
      } else {
        // Create new template
        const response = await fetch("/api/proxy/api/job-templates", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          setIsDialogOpen(false)
          resetForm()
          fetchTemplates()
          toast({
            title: "Template Created",
            description: `Job template "${formName}" has been created successfully.`,
          })
        } else {
          const error = await response.json()
          toast({
            title: "Creation Failed",
            description: error.detail || "Failed to create template.",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      console.error("Error saving template:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      })
    }
  }, [token, formName, formJobType, formDescription, formConfigRepoId, formInventorySource, formInventoryName, formCommandTemplate, formBackupRunningConfigPath, formBackupStartupConfigPath, formWriteTimestampToCustomField, formTimestampCustomFieldName, formParallelTasks, formActivateChangesAfterSync, formScanResolveDns, formScanPingCount, formScanTimeoutMs, formScanRetries, formScanIntervalMs, formScanCustomFieldName, formScanCustomFieldValue, formScanResponseCustomFieldName, formScanMaxIps, formIsGlobal, editingTemplate, resetForm, fetchTemplates, toast])

  const handleDeleteTemplate = useCallback(async (templateId: number) => {
    if (!token) return

    if (!confirm("Are you sure you want to delete this template?")) return

    try {
      const response = await fetch(`/api/proxy/api/job-templates/${templateId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        fetchTemplates()
        toast({
          title: "Template Deleted",
          description: "Job template has been deleted successfully.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Delete Failed",
          description: error.detail || "Failed to delete template.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error deleting template:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      })
    }
  }, [token, fetchTemplates, toast])

  const handleCopyTemplate = useCallback(async (template: JobTemplate) => {
    if (!token) return

    try {
      // Create a copy of the template with "copy_of_" prefix
      const copyPayload = {
        name: `copy_of_${template.name}`,
        job_type: template.job_type,
        description: template.description || undefined,
        config_repository_id: template.config_repository_id || undefined,
        inventory_source: template.inventory_source,
        inventory_name: template.inventory_name || undefined,
        command_template_name: template.command_template_name || undefined,
        backup_running_config_path: template.backup_running_config_path || undefined,
        backup_startup_config_path: template.backup_startup_config_path || undefined,
        write_timestamp_to_custom_field: template.write_timestamp_to_custom_field,
        timestamp_custom_field_name: template.timestamp_custom_field_name || undefined,
        parallel_tasks: template.parallel_tasks || 1,
        activate_changes_after_sync: template.activate_changes_after_sync,
        scan_resolve_dns: template.scan_resolve_dns,
        scan_ping_count: template.scan_ping_count,
        scan_timeout_ms: template.scan_timeout_ms,
        scan_retries: template.scan_retries,
        scan_interval_ms: template.scan_interval_ms,
        scan_custom_field_name: template.scan_custom_field_name || undefined,
        scan_custom_field_value: template.scan_custom_field_value || undefined,
        scan_response_custom_field_name: template.scan_response_custom_field_name || undefined,
        scan_max_ips: template.scan_max_ips,
        is_global: template.is_global
      }

      const response = await fetch("/api/proxy/api/job-templates", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(copyPayload),
      })

      if (response.ok) {
        fetchTemplates()
        toast({
          title: "Template Copied",
          description: `Job template "${copyPayload.name}" has been created successfully.`,
        })
      } else {
        const error = await response.json()
        toast({
          title: "Copy Failed",
          description: error.detail || "Failed to copy template.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error copying template:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      })
    }
  }, [token, fetchTemplates, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Templates</h1>
            <p className="text-gray-600 mt-1">Create and manage reusable job templates for the scheduler</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="!max-w-6xl sm:!max-w-6xl p-0 gap-0 overflow-hidden w-full">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-6 py-4">
              <DialogHeader className="text-white">
                <DialogTitle className="text-lg font-semibold text-white">
                  {editingTemplate ? "Edit Job Template" : "Create Job Template"}
                </DialogTitle>
                <DialogDescription className="text-blue-50">
                  {editingTemplate ? "Update job template settings" : "Create a new reusable job template"}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Form content */}
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <JobTemplateCommonFields
                formName={formName}
                setFormName={setFormName}
                formJobType={formJobType}
                setFormJobType={setFormJobType}
                formDescription={formDescription}
                setFormDescription={setFormDescription}
                formIsGlobal={formIsGlobal}
                setFormIsGlobal={setFormIsGlobal}
                jobTypes={jobTypes}
                user={user}
                editingTemplate={!!editingTemplate}
                getJobTypeColor={getJobTypeColor}
              />

              {/* Config Repository Section - Only show for backup job type */}
              {formJobType === "backup" && (
                <JobTemplateConfigRepoSection
                  formConfigRepoId={formConfigRepoId}
                  setFormConfigRepoId={setFormConfigRepoId}
                  configRepos={configRepos}
                />
              )}

              {/* Inventory Section - Not shown for scan_prefixes */}
              {formJobType !== "scan_prefixes" && (
                <JobTemplateInventorySection
                  formInventorySource={formInventorySource}
                  setFormInventorySource={setFormInventorySource}
                  formInventoryName={formInventoryName}
                  setFormInventoryName={setFormInventoryName}
                  savedInventories={savedInventories}
                  loadingInventories={loadingInventories}
                />
              )}

              {/* Job Type Specific Sections */}
              {formJobType === "backup" && (
                <BackupJobTemplate
                  formBackupRunningConfigPath={formBackupRunningConfigPath}
                  setFormBackupRunningConfigPath={setFormBackupRunningConfigPath}
                  formBackupStartupConfigPath={formBackupStartupConfigPath}
                  setFormBackupStartupConfigPath={setFormBackupStartupConfigPath}
                  formWriteTimestampToCustomField={formWriteTimestampToCustomField}
                  setFormWriteTimestampToCustomField={setFormWriteTimestampToCustomField}
                  formTimestampCustomFieldName={formTimestampCustomFieldName}
                  setFormTimestampCustomFieldName={setFormTimestampCustomFieldName}
                  formParallelTasks={formParallelTasks}
                  setFormParallelTasks={setFormParallelTasks}
                  customFields={customFields}
                />
              )}

              {formJobType === "compare_devices" && (
                <CompareDevicesJobTemplate />
              )}

              {formJobType === "run_commands" && (
                <RunCommandsJobTemplate
                  formCommandTemplate={formCommandTemplate}
                  setFormCommandTemplate={setFormCommandTemplate}
                  commandTemplates={commandTemplates}
                />
              )}

              {formJobType === "sync_devices" && (
                <SyncDevicesJobTemplate
                  formActivateChangesAfterSync={formActivateChangesAfterSync}
                  setFormActivateChangesAfterSync={setFormActivateChangesAfterSync}
                />
              )}

              {formJobType === "scan_prefixes" && (
                <ScanPrefixesJobTemplate
                  formScanResolveDns={formScanResolveDns}
                  setFormScanResolveDns={setFormScanResolveDns}
                  formScanPingCount={formScanPingCount}
                  setFormScanPingCount={setFormScanPingCount}
                  formScanTimeoutMs={formScanTimeoutMs}
                  setFormScanTimeoutMs={setFormScanTimeoutMs}
                  formScanRetries={formScanRetries}
                  setFormScanRetries={setFormScanRetries}
                  formScanIntervalMs={formScanIntervalMs}
                  setFormScanIntervalMs={setFormScanIntervalMs}
                  formScanCustomFieldName={formScanCustomFieldName}
                  setFormScanCustomFieldName={setFormScanCustomFieldName}
                  formScanCustomFieldValue={formScanCustomFieldValue}
                  setFormScanCustomFieldValue={setFormScanCustomFieldValue}
                  formScanResponseCustomFieldName={formScanResponseCustomFieldName}
                  setFormScanResponseCustomFieldName={setFormScanResponseCustomFieldName}
                  formScanMaxIps={formScanMaxIps}
                  setFormScanMaxIps={setFormScanMaxIps}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-3 bg-gray-50 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
                className="h-9 px-4 border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingTemplate ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Template
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Table */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-xl font-semibold text-gray-700 mb-2">No job templates yet</p>
            <p className="text-gray-500 mb-4">
              Create your first job template to use in the scheduler
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Job Template
            </Button>
          </CardContent>
        </Card>
      ) : (
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
                          onClick={() => handleEditTemplate(template)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                          title="Edit template"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyTemplate(template)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-green-600"
                          title="Copy template"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                          title="Delete template"
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
      )}
    </div>
  )
}
