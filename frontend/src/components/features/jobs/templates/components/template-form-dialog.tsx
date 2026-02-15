'use client'

import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Edit } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { JobTemplateCommonFields } from '../../components/JobTemplateCommonFields'
import { JobTemplateConfigRepoSection } from '../../components/JobTemplateConfigRepoSection'
import { JobTemplateInventorySection } from '../../components/JobTemplateInventorySection'
import { BackupJobTemplate } from '../../components/template-types/BackupJobTemplate'
import { RunCommandsJobTemplate } from '../../components/template-types/RunCommandsJobTemplate'
import { SyncDevicesJobTemplate } from '../../components/template-types/SyncDevicesJobTemplate'
import { CompareDevicesJobTemplate } from '../../components/template-types/CompareDevicesJobTemplate'
import { ScanPrefixesJobTemplate } from '../../components/template-types/ScanPrefixesJobTemplate'
import { DeployAgentJobTemplate, generateEntryKey } from '../../components/template-types/DeployAgentJobTemplate'
import type { DeployTemplateEntryData } from '../../components/template-types/DeployTemplateEntry'
import type { JobTemplate, JobType, GitRepository, SavedInventory, CommandTemplate, CustomField } from '../types'
import { JOB_TYPE_COLORS } from '../utils/constants'

interface TemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTemplate: JobTemplate | null
  jobTypes: JobType[]
  configRepos: GitRepository[]
  savedInventories: SavedInventory[]
  commandTemplates: CommandTemplate[]
  customFields: CustomField[]
  loadingInventories: boolean
  onSaved: () => void
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  editingTemplate,
  jobTypes,
  configRepos,
  savedInventories,
  commandTemplates,
  customFields,
  loadingInventories,
  onSaved
}: TemplateFormDialogProps) {
  const user = useAuthStore(state => state.user)
  const { createTemplate, updateTemplate } = useTemplateMutations()

  // Form state
  const [formName, setFormName] = useState("")
  const [formJobType, setFormJobType] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formConfigRepoId, setFormConfigRepoId] = useState<number | null>(null)
  const [formInventorySource, setFormInventorySource] = useState<"all" | "inventory">("all")
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
  const [formScanSetReachableIpActive, setFormScanSetReachableIpActive] = useState(true)
  const [formScanMaxIps, setFormScanMaxIps] = useState("")
  const [formDeployAgentId, setFormDeployAgentId] = useState("")
  const [formDeployTemplateEntries, setFormDeployTemplateEntries] = useState<DeployTemplateEntryData[]>([
    { _key: generateEntryKey(), templateId: null, inventoryId: null, path: '', customVariables: {} }
  ])
  const [formActivateAfterDeploy, setFormActivateAfterDeploy] = useState(true)
  const [formIsGlobal, setFormIsGlobal] = useState(false)

  const resetForm = useCallback(() => {
    setFormName("")
    setFormJobType("")
    setFormDescription("")
    setFormConfigRepoId(null)
    setFormInventorySource("all")
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
    setFormScanSetReachableIpActive(true)
    setFormScanMaxIps("")
    setFormDeployAgentId("")
    setFormDeployTemplateEntries([
      { _key: generateEntryKey(), templateId: null, inventoryId: null, path: '', customVariables: {} }
    ])
    setFormActivateAfterDeploy(true)
    setFormIsGlobal(false)
  }, [])

  // Load editing template data
  useEffect(() => {
    if (open && editingTemplate) {
      setFormName(editingTemplate.name)
      setFormJobType(editingTemplate.job_type)
      setFormDescription(editingTemplate.description || "")
      setFormConfigRepoId(editingTemplate.config_repository_id || null)
      setFormInventorySource(editingTemplate.inventory_source)
      setFormInventoryName(editingTemplate.inventory_name || "")
      setFormCommandTemplate(editingTemplate.command_template_name || "")
      setFormBackupRunningConfigPath(editingTemplate.backup_running_config_path || "")
      setFormBackupStartupConfigPath(editingTemplate.backup_startup_config_path || "")
      setFormWriteTimestampToCustomField(editingTemplate.write_timestamp_to_custom_field ?? false)
      setFormTimestampCustomFieldName(editingTemplate.timestamp_custom_field_name || "")
      setFormParallelTasks(editingTemplate.parallel_tasks || 1)
      setFormActivateChangesAfterSync(editingTemplate.activate_changes_after_sync ?? true)
      setFormScanResolveDns(editingTemplate.scan_resolve_dns ?? false)
      setFormScanPingCount(editingTemplate.scan_ping_count?.toString() || "")
      setFormScanTimeoutMs(editingTemplate.scan_timeout_ms?.toString() || "")
      setFormScanRetries(editingTemplate.scan_retries?.toString() || "")
      setFormScanIntervalMs(editingTemplate.scan_interval_ms?.toString() || "")
      setFormScanCustomFieldName(editingTemplate.scan_custom_field_name || "")
      setFormScanCustomFieldValue(editingTemplate.scan_custom_field_value || "")
      setFormScanResponseCustomFieldName(editingTemplate.scan_response_custom_field_name || "")
      setFormScanSetReachableIpActive(editingTemplate.scan_set_reachable_ip_active ?? true)
      setFormScanMaxIps(editingTemplate.scan_max_ips?.toString() || "")
      setFormDeployAgentId(editingTemplate.deploy_agent_id || "")
      // Load multi-template entries: prefer deploy_templates, fall back to single legacy fields
      if (editingTemplate.deploy_templates && editingTemplate.deploy_templates.length > 0) {
        setFormDeployTemplateEntries(editingTemplate.deploy_templates.map(t => ({
          _key: generateEntryKey(),
          templateId: t.template_id,
          inventoryId: t.inventory_id,
          path: t.path || '',
          customVariables: t.custom_variables || {},
        })))
      } else if (editingTemplate.deploy_template_id) {
        // Backward compat: convert legacy single fields to single-entry array
        setFormDeployTemplateEntries([{
          _key: generateEntryKey(),
          templateId: editingTemplate.deploy_template_id,
          inventoryId: null,
          path: editingTemplate.deploy_path || '',
          customVariables: editingTemplate.deploy_custom_variables || {},
        }])
      } else {
        setFormDeployTemplateEntries([
          { _key: generateEntryKey(), templateId: null, inventoryId: null, path: '', customVariables: {} }
        ])
      }
      setFormActivateAfterDeploy(editingTemplate.activate_after_deploy ?? true)
      setFormIsGlobal(editingTemplate.is_global)
    } else if (open && !editingTemplate) {
      resetForm()
    }
  }, [open, editingTemplate, resetForm])

  const isFormValid = useCallback(() => {
    if (!formName.trim() || !formJobType) return false
    if (formJobType === "backup" && formWriteTimestampToCustomField && !formTimestampCustomFieldName) return false
    if (formJobType === "backup" && formBackupStartupConfigPath && !formBackupRunningConfigPath) return false
    if (formInventorySource === "inventory" && !formInventoryName) return false
    if (formJobType === "run_commands" && !formCommandTemplate) return false
    if (formJobType === "deploy_agent") {
      if (!formDeployAgentId) return false
      const hasValidEntry = formDeployTemplateEntries.some(e => e.templateId !== null)
      if (!hasValidEntry) return false
    }
    return true
  }, [formName, formJobType, formWriteTimestampToCustomField, formTimestampCustomFieldName, formBackupStartupConfigPath, formBackupRunningConfigPath, formInventorySource, formInventoryName, formCommandTemplate, formDeployAgentId, formDeployTemplateEntries])

  const handleSubmit = async () => {
    const payload = {
      name: formName,
      job_type: formJobType,
      description: formDescription || undefined,
      config_repository_id: formConfigRepoId || undefined,
      inventory_source: formInventorySource,
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
      scan_set_reachable_ip_active: formJobType === "scan_prefixes" ? formScanSetReachableIpActive : undefined,
      scan_max_ips: formJobType === "scan_prefixes" && formScanMaxIps ? parseInt(formScanMaxIps) : undefined,
      // Legacy single-template fields (populated from first entry for backward compat)
      deploy_template_id: formJobType === "deploy_agent" && formDeployTemplateEntries[0]?.templateId ? formDeployTemplateEntries[0].templateId : undefined,
      deploy_agent_id: formJobType === "deploy_agent" ? formDeployAgentId : undefined,
      deploy_path: formJobType === "deploy_agent" && formDeployTemplateEntries[0]?.path ? formDeployTemplateEntries[0].path : undefined,
      deploy_custom_variables: formJobType === "deploy_agent" && formDeployTemplateEntries[0]?.customVariables && Object.keys(formDeployTemplateEntries[0].customVariables).length > 0 ? formDeployTemplateEntries[0].customVariables : undefined,
      activate_after_deploy: formJobType === "deploy_agent" ? formActivateAfterDeploy : undefined,
      // Multi-template entries
      deploy_templates: formJobType === "deploy_agent" ? formDeployTemplateEntries
        .filter(e => e.templateId !== null)
        .map(e => ({
          template_id: e.templateId!,
          inventory_id: e.inventoryId,
          path: e.path || '',
          custom_variables: e.customVariables,
        })) : undefined,
      is_global: formIsGlobal
    }

    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, data: payload })
    } else {
      await createTemplate.mutateAsync(payload)
    }

    onSaved()
    onOpenChange(false)
    resetForm()
  }

  const getJobTypeColor = (jobType: string) => {
    return JOB_TYPE_COLORS[jobType] || 'bg-gray-500'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl sm:!max-w-6xl p-0 gap-0 overflow-hidden w-full">
        {/* Header */}
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

        {/* Form */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Common Fields */}
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

          {/* Config Repository - Only for backup */}
          {formJobType === "backup" && (
            <JobTemplateConfigRepoSection
              formConfigRepoId={formConfigRepoId}
              setFormConfigRepoId={setFormConfigRepoId}
              configRepos={configRepos}
            />
          )}

          {/* Inventory - Not for scan_prefixes or deploy_agent (deploy_agent has per-entry inventory) */}
          {formJobType !== "scan_prefixes" && formJobType !== "deploy_agent" && (
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
              formScanSetReachableIpActive={formScanSetReachableIpActive}
              setFormScanSetReachableIpActive={setFormScanSetReachableIpActive}
              formScanMaxIps={formScanMaxIps}
              setFormScanMaxIps={setFormScanMaxIps}
            />
          )}

          {formJobType === "deploy_agent" && (
            <DeployAgentJobTemplate
              formDeployAgentId={formDeployAgentId}
              setFormDeployAgentId={setFormDeployAgentId}
              formDeployTemplateEntries={formDeployTemplateEntries}
              setFormDeployTemplateEntries={setFormDeployTemplateEntries}
              formActivateAfterDeploy={formActivateAfterDeploy}
              setFormActivateAfterDeploy={setFormActivateAfterDeploy}
              savedInventories={savedInventories}
              loadingInventories={loadingInventories}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-3 bg-gray-50 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              resetForm()
            }}
            className="h-9 px-4 border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || createTemplate.isPending || updateTemplate.isPending}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400 disabled:cursor-not-allowed"
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
  )
}
