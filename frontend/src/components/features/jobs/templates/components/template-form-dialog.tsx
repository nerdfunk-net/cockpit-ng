'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Edit } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import {
  useIpAddressStatuses,
  useIpAddressTags,
  useCsvImportRepos,
  useCsvExportRepos,
  useCsvFiles,
  useCsvHeaders,
  useNautobotDefaults,
} from '../hooks/use-template-queries'
import {
  useCsvImportNautobotQuery,
  EMPTY_CSV_IMPORT_NAUTOBOT_DATA,
} from '../hooks/use-csv-import-nautobot-query'
import {
  EMPTY_IP_STATUSES,
  EMPTY_IP_TAGS,
  EMPTY_REPOS,
  EMPTY_CSV_FILES,
  EMPTY_HEADERS,
} from '../utils/constants'
import { JobTemplateCommonFields } from './JobTemplateCommonFields'
import { JobTemplateConfigRepoSection } from './JobTemplateConfigRepoSection'
import { JobTemplateInventorySection } from './JobTemplateInventorySection'
import { BackupJobTemplate } from './template-types/BackupJobTemplate'
import { RunCommandsJobTemplate } from './template-types/RunCommandsJobTemplate'
import { SyncDevicesJobTemplate } from './template-types/SyncDevicesJobTemplate'
import { CompareDevicesJobTemplate } from './template-types/CompareDevicesJobTemplate'
import { ScanPrefixesJobTemplate } from './template-types/ScanPrefixesJobTemplate'
import {
  DeployAgentJobTemplate,
  generateEntryKey,
} from './template-types/DeployAgentJobTemplate'
import { MaintainIPAddressesJobTemplate } from './template-types/MaintainIPAddressesJobTemplate'
import { CsvImportJobTemplate } from './template-types/CsvImportJobTemplate'
import { CsvExportJobTemplate } from './template-types/CsvExportJobTemplate'
import { SetPrimaryIpJobTemplate } from './template-types/SetPrimaryIpJobTemplate'
import { GetClientDataJobTemplate } from './template-types/GetClientDataJobTemplate'
import { CsvImportMappingDialog } from './template-types/CsvImportMappingDialog'
import { CsvImportDefaultsPanel } from './csv-import-defaults-panel'
import type { DeployTemplateEntryData } from './template-types/DeployTemplateEntry'
import type {
  JobTemplate,
  JobType,
  GitRepository,
  SavedInventory,
  CommandTemplate,
  CustomField,
} from '../types'
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
  onSaved,
}: TemplateFormDialogProps) {
  const user = useAuthStore(state => state.user)
  const { createTemplate, updateTemplate } = useTemplateMutations()

  // Form state
  const [formName, setFormName] = useState('')
  const [formJobType, setFormJobType] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formConfigRepoId, setFormConfigRepoId] = useState<number | null>(null)
  const [formInventorySource, setFormInventorySource] = useState<'all' | 'inventory'>(
    'all'
  )
  const [formInventoryName, setFormInventoryName] = useState('')
  const [formCommandTemplate, setFormCommandTemplate] = useState('')
  const [formBackupRunningConfigPath, setFormBackupRunningConfigPath] = useState('')
  const [formBackupStartupConfigPath, setFormBackupStartupConfigPath] = useState('')
  const [formWriteTimestampToCustomField, setFormWriteTimestampToCustomField] =
    useState(false)
  const [formTimestampCustomFieldName, setFormTimestampCustomFieldName] = useState('')
  const [formParallelTasks, setFormParallelTasks] = useState(1)
  const [formActivateChangesAfterSync, setFormActivateChangesAfterSync] = useState(true)
  const [formScanResolveDns, setFormScanResolveDns] = useState(false)
  const [formScanPingCount, setFormScanPingCount] = useState('')
  const [formScanTimeoutMs, setFormScanTimeoutMs] = useState('')
  const [formScanRetries, setFormScanRetries] = useState('')
  const [formScanIntervalMs, setFormScanIntervalMs] = useState('')
  const [formScanCustomFieldName, setFormScanCustomFieldName] = useState('')
  const [formScanCustomFieldValue, setFormScanCustomFieldValue] = useState('')
  const [formScanResponseCustomFieldName, setFormScanResponseCustomFieldName] =
    useState('')
  const [formScanSetReachableIpActive, setFormScanSetReachableIpActive] = useState(true)
  const [formScanMaxIps, setFormScanMaxIps] = useState('')
  const [formDeployAgentId, setFormDeployAgentId] = useState('')
  const [formDeployTemplateEntries, setFormDeployTemplateEntries] = useState<
    DeployTemplateEntryData[]
  >([
    {
      _key: generateEntryKey(),
      templateId: null,
      inventoryId: null,
      path: '',
      customVariables: {},
    },
  ])
  const [formActivateAfterDeploy, setFormActivateAfterDeploy] = useState(true)
  // Maintain IP-Addresses
  const [formIpAction, setFormIpAction] = useState('list')
  const [formIpFilterField, setFormIpFilterField] = useState('')
  const [formIpFilterType, setFormIpFilterType] = useState('__eq__')
  const [formIpFilterValue, setFormIpFilterValue] = useState('')
  const [formIpIncludeNull, setFormIpIncludeNull] = useState(false)
  // Mark action options
  const [formIpMarkStatus, setFormIpMarkStatus] = useState('')
  const [formIpMarkTag, setFormIpMarkTag] = useState('')
  const [formIpMarkDescription, setFormIpMarkDescription] = useState('')
  // Remove action options
  const [formIpRemoveSkipAssigned, setFormIpRemoveSkipAssigned] = useState(true)
  // CSV Import
  const [formCsvImportRepoId, setFormCsvImportRepoId] = useState<number | null>(null)
  const [formCsvImportFilePath, setFormCsvImportFilePath] = useState('')
  const [formCsvImportType, setFormCsvImportType] = useState('')
  const [formCsvImportPrimaryKey, setFormCsvImportPrimaryKey] = useState('')
  const [formCsvImportUpdateExisting, setFormCsvImportUpdateExisting] = useState(true)
  const [formCsvImportDelimiter, setFormCsvImportDelimiter] = useState(',')
  const [formCsvImportQuoteChar, setFormCsvImportQuoteChar] = useState('"')
  const [formCsvImportColumnMapping, setFormCsvImportColumnMapping] = useState<
    Record<string, string | null>
  >({})
  const [formCsvMappingDialogOpen, setFormCsvMappingDialogOpen] = useState(false)
  const [csvFileQuery, setCsvFileQuery] = useState('')
  const [formCsvImportFileFilter, setFormCsvImportFileFilter] = useState('')
  const [formCsvImportDefaults, setFormCsvImportDefaults] = useState<
    Record<string, string>
  >({})
  const [formCsvImportFormat, setFormCsvImportFormat] = useState('generic')
  const [formCsvImportAddPrefixes, setFormCsvImportAddPrefixes] = useState(false)
  const [formCsvImportDefaultPrefixLength, setFormCsvImportDefaultPrefixLength] =
    useState('')
  // CSV Export
  const [formCsvExportRepoId, setFormCsvExportRepoId] = useState<number | null>(null)
  const [formCsvExportFilePath, setFormCsvExportFilePath] = useState('')
  const [formCsvExportProperties, setFormCsvExportProperties] = useState<string[]>([])
  const [formCsvExportDelimiter, setFormCsvExportDelimiter] = useState(',')
  const [formCsvExportQuoteChar, setFormCsvExportQuoteChar] = useState('"')
  const [formCsvExportIncludeHeaders, setFormCsvExportIncludeHeaders] = useState(true)
  const [formIsGlobal, setFormIsGlobal] = useState(false)
  // Set Primary IP
  const [formSetPrimaryIpStrategy, setFormSetPrimaryIpStrategy] = useState('')
  const [formSetPrimaryIpAgentId, setFormSetPrimaryIpAgentId] = useState('')
  // Get Client Data
  const [formCollectIpAddress, setFormCollectIpAddress] = useState(true)
  const [formCollectMacAddress, setFormCollectMacAddress] = useState(true)
  const [formCollectHostname, setFormCollectHostname] = useState(true)

  // IP-specific Nautobot data (only fetched when job type is ip_addresses)
  const { data: ipStatuses = EMPTY_IP_STATUSES, isLoading: loadingIpStatuses } =
    useIpAddressStatuses({
      enabled: formJobType === 'ip_addresses',
    })
  const { data: ipTags = EMPTY_IP_TAGS, isLoading: loadingIpTags } = useIpAddressTags({
    enabled: formJobType === 'ip_addresses',
  })

  // CSV Import data (only fetched when job type is csv_import)
  const isCsvImport = formJobType === 'csv_import'
  const { data: csvImportRepos = EMPTY_REPOS } = useCsvImportRepos({
    enabled: isCsvImport,
  })
  const { data: csvFiles = EMPTY_CSV_FILES, isLoading: csvFilesLoading } = useCsvFiles({
    repoId: formCsvImportRepoId,
    query: csvFileQuery,
    enabled: isCsvImport,
  })
  const { data: csvHeaders = EMPTY_HEADERS, isLoading: csvHeadersLoading } =
    useCsvHeaders({
      repoId: formCsvImportRepoId,
      filePath: formCsvImportFilePath || null,
      delimiter: formCsvImportDelimiter,
      quoteChar: formCsvImportQuoteChar,
      enabled: isCsvImport,
    })
  const { data: nautobotDefaults } = useNautobotDefaults({ enabled: isCsvImport })
  const {
    data: csvImportNautobotData = EMPTY_CSV_IMPORT_NAUTOBOT_DATA,
    isLoading: csvImportNautobotLoading,
  } = useCsvImportNautobotQuery({ enabled: isCsvImport })

  // CSV Export data (only fetched when job type is csv_export)
  const isCsvExport = formJobType === 'csv_export'
  const { data: csvExportRepos = EMPTY_REPOS } = useCsvExportRepos({
    enabled: isCsvExport,
  })

  // Pre-fill delimiter/quoteChar from Nautobot defaults when entering csv_import mode.
  // Only applies when creating a new template — never overwrite values loaded from an existing template.
  useEffect(() => {
    if (isCsvImport && nautobotDefaults && !editingTemplate) {
      if (!formCsvImportDelimiter || formCsvImportDelimiter === ',') {
        setFormCsvImportDelimiter(nautobotDefaults.csv_delimiter || ',')
      }
      if (!formCsvImportQuoteChar || formCsvImportQuoteChar === '"') {
        setFormCsvImportQuoteChar(nautobotDefaults.csv_quote_char || '"')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCsvImport, nautobotDefaults])

  const mappedColumnCount = useMemo(
    () => Object.values(formCsvImportColumnMapping).filter(v => v !== null).length,
    [formCsvImportColumnMapping]
  )

  const resetForm = useCallback(() => {
    setFormName('')
    setFormJobType('')
    setFormDescription('')
    setFormConfigRepoId(null)
    setFormInventorySource('all')
    setFormInventoryName('')
    setFormCommandTemplate('')
    setFormBackupRunningConfigPath('')
    setFormBackupStartupConfigPath('')
    setFormWriteTimestampToCustomField(false)
    setFormTimestampCustomFieldName('')
    setFormParallelTasks(1)
    setFormActivateChangesAfterSync(true)
    setFormScanResolveDns(false)
    setFormScanPingCount('')
    setFormScanTimeoutMs('')
    setFormScanRetries('')
    setFormScanIntervalMs('')
    setFormScanCustomFieldName('')
    setFormScanCustomFieldValue('')
    setFormScanResponseCustomFieldName('')
    setFormScanSetReachableIpActive(true)
    setFormScanMaxIps('')
    setFormDeployAgentId('')
    setFormDeployTemplateEntries([
      {
        _key: generateEntryKey(),
        templateId: null,
        inventoryId: null,
        path: '',
        customVariables: {},
      },
    ])
    setFormActivateAfterDeploy(true)
    setFormIpAction('list')
    setFormIpFilterField('')
    setFormIpFilterType('__eq__')
    setFormIpFilterValue('')
    setFormIpIncludeNull(false)
    setFormIpMarkStatus('')
    setFormIpMarkTag('')
    setFormIpMarkDescription('')
    setFormIpRemoveSkipAssigned(true)
    setFormCsvImportRepoId(null)
    setFormCsvImportFilePath('')
    setFormCsvImportType('')
    setFormCsvImportPrimaryKey('')
    setFormCsvImportUpdateExisting(true)
    setFormCsvImportDelimiter(',')
    setFormCsvImportQuoteChar('"')
    setFormCsvImportColumnMapping({})
    setCsvFileQuery('')
    setFormCsvImportFileFilter('')
    setFormCsvImportDefaults({})
    setFormCsvImportFormat('generic')
    setFormCsvImportAddPrefixes(false)
    setFormCsvImportDefaultPrefixLength('')
    setFormCsvExportRepoId(null)
    setFormCsvExportFilePath('')
    setFormCsvExportProperties([])
    setFormCsvExportDelimiter(',')
    setFormCsvExportQuoteChar('"')
    setFormCsvExportIncludeHeaders(true)
    setFormIsGlobal(false)
    setFormSetPrimaryIpStrategy('')
    setFormSetPrimaryIpAgentId('')
    setFormCollectIpAddress(true)
    setFormCollectMacAddress(true)
    setFormCollectHostname(true)
  }, [])

  // Load editing template data
  useEffect(() => {
    if (open && editingTemplate) {
      setFormName(editingTemplate.name)
      setFormJobType(editingTemplate.job_type)
      setFormDescription(editingTemplate.description || '')
      setFormConfigRepoId(editingTemplate.config_repository_id || null)
      setFormInventorySource(editingTemplate.inventory_source)
      setFormInventoryName(editingTemplate.inventory_name || '')
      setFormCommandTemplate(editingTemplate.command_template_name || '')
      setFormBackupRunningConfigPath(editingTemplate.backup_running_config_path || '')
      setFormBackupStartupConfigPath(editingTemplate.backup_startup_config_path || '')
      setFormWriteTimestampToCustomField(
        editingTemplate.write_timestamp_to_custom_field ?? false
      )
      setFormTimestampCustomFieldName(editingTemplate.timestamp_custom_field_name || '')
      setFormParallelTasks(editingTemplate.parallel_tasks || 1)
      setFormActivateChangesAfterSync(
        editingTemplate.activate_changes_after_sync ?? true
      )
      setFormScanResolveDns(editingTemplate.scan_resolve_dns ?? false)
      setFormScanPingCount(editingTemplate.scan_ping_count?.toString() || '')
      setFormScanTimeoutMs(editingTemplate.scan_timeout_ms?.toString() || '')
      setFormScanRetries(editingTemplate.scan_retries?.toString() || '')
      setFormScanIntervalMs(editingTemplate.scan_interval_ms?.toString() || '')
      setFormScanCustomFieldName(editingTemplate.scan_custom_field_name || '')
      setFormScanCustomFieldValue(editingTemplate.scan_custom_field_value || '')
      setFormScanResponseCustomFieldName(
        editingTemplate.scan_response_custom_field_name || ''
      )
      setFormScanSetReachableIpActive(
        editingTemplate.scan_set_reachable_ip_active ?? true
      )
      setFormScanMaxIps(editingTemplate.scan_max_ips?.toString() || '')
      setFormDeployAgentId(editingTemplate.deploy_agent_id || '')
      // Load multi-template entries: prefer deploy_templates, fall back to single legacy fields
      if (
        editingTemplate.deploy_templates &&
        editingTemplate.deploy_templates.length > 0
      ) {
        setFormDeployTemplateEntries(
          editingTemplate.deploy_templates.map(t => ({
            _key: generateEntryKey(),
            templateId: t.template_id,
            inventoryId: t.inventory_id,
            path: t.path || '',
            customVariables: t.custom_variables || {},
          }))
        )
      } else if (editingTemplate.deploy_template_id) {
        // Backward compat: convert legacy single fields to single-entry array
        setFormDeployTemplateEntries([
          {
            _key: generateEntryKey(),
            templateId: editingTemplate.deploy_template_id,
            inventoryId: null,
            path: editingTemplate.deploy_path || '',
            customVariables: editingTemplate.deploy_custom_variables || {},
          },
        ])
      } else {
        setFormDeployTemplateEntries([
          {
            _key: generateEntryKey(),
            templateId: null,
            inventoryId: null,
            path: '',
            customVariables: {},
          },
        ])
      }
      setFormActivateAfterDeploy(editingTemplate.activate_after_deploy ?? true)
      setFormIpAction(editingTemplate.ip_action || 'list')
      setFormIpFilterField(editingTemplate.ip_filter_field || '')
      setFormIpFilterType(editingTemplate.ip_filter_type || '__eq__')
      setFormIpFilterValue(editingTemplate.ip_filter_value || '')
      setFormIpIncludeNull(editingTemplate.ip_include_null ?? false)
      setFormIpMarkStatus(editingTemplate.ip_mark_status || '')
      setFormIpMarkTag(editingTemplate.ip_mark_tag || '')
      setFormIpMarkDescription(editingTemplate.ip_mark_description || '')
      setFormIpRemoveSkipAssigned(editingTemplate.ip_remove_skip_assigned ?? true)
      setFormCsvImportRepoId(editingTemplate.csv_import_repo_id || null)
      // DEBUG: log raw CSV fields from the API response
      console.debug('[CSV_DEBUG][RENDER] editingTemplate raw CSV fields:', {
        csv_import_delimiter: editingTemplate.csv_import_delimiter,
        csv_import_quote_char: editingTemplate.csv_import_quote_char,
        csv_import_primary_key: editingTemplate.csv_import_primary_key,
        csv_import_repo_id: editingTemplate.csv_import_repo_id,
        csv_import_file_path: editingTemplate.csv_import_file_path,
        csv_import_type: editingTemplate.csv_import_type,
        csv_import_update_existing: editingTemplate.csv_import_update_existing,
        csv_import_file_filter: editingTemplate.csv_import_file_filter,
        csv_import_column_mapping: editingTemplate.csv_import_column_mapping,
      })
      setFormCsvImportFilePath(editingTemplate.csv_import_file_path || '')
      setFormCsvImportType(editingTemplate.csv_import_type || '')
      setFormCsvImportPrimaryKey(editingTemplate.csv_import_primary_key || '')
      setFormCsvImportUpdateExisting(editingTemplate.csv_import_update_existing ?? true)
      setFormCsvImportDelimiter(editingTemplate.csv_import_delimiter || ',')
      setFormCsvImportQuoteChar(editingTemplate.csv_import_quote_char || '"')
      setFormCsvImportColumnMapping(editingTemplate.csv_import_column_mapping || {})
      setFormCsvImportFileFilter(editingTemplate.csv_import_file_filter ?? '')
      setFormCsvImportDefaults(editingTemplate.csv_import_defaults ?? {})
      setFormCsvImportFormat(editingTemplate.csv_import_format || 'generic')
      setFormCsvImportAddPrefixes(editingTemplate.csv_import_add_prefixes ?? false)
      setFormCsvImportDefaultPrefixLength(
        editingTemplate.csv_import_default_prefix_length || ''
      )
      console.debug('[CSV_DEBUG][RENDER] form state after loading CSV fields:', {
        formCsvImportDelimiter: editingTemplate.csv_import_delimiter || ',',
        formCsvImportQuoteChar: editingTemplate.csv_import_quote_char || '"',
        formCsvImportPrimaryKey: editingTemplate.csv_import_primary_key || '',
      })
      setFormCsvExportRepoId(editingTemplate.csv_export_repo_id || null)
      setFormCsvExportFilePath(editingTemplate.csv_export_file_path || '')
      setFormCsvExportProperties(editingTemplate.csv_export_properties || [])
      setFormCsvExportDelimiter(editingTemplate.csv_export_delimiter || ',')
      setFormCsvExportQuoteChar(editingTemplate.csv_export_quote_char || '"')
      setFormCsvExportIncludeHeaders(editingTemplate.csv_export_include_headers ?? true)
      setFormSetPrimaryIpStrategy(editingTemplate.set_primary_ip_strategy || '')
      setFormSetPrimaryIpAgentId(editingTemplate.set_primary_ip_agent_id || '')
      setFormCollectIpAddress(editingTemplate.collect_ip_address ?? true)
      setFormCollectMacAddress(editingTemplate.collect_mac_address ?? true)
      setFormCollectHostname(editingTemplate.collect_hostname ?? true)
      setFormIsGlobal(editingTemplate.is_global)
    } else if (open && !editingTemplate) {
      resetForm()
    }
  }, [open, editingTemplate, resetForm])

  // Force inventory_source = 'inventory' when set_primary_ip is selected
  useEffect(() => {
    if (formJobType === 'set_primary_ip') {
      setFormInventorySource('inventory')
    }
  }, [formJobType])

  const isFormValid = useCallback(() => {
    if (!formName.trim() || !formJobType) return false
    if (
      formJobType === 'backup' &&
      formWriteTimestampToCustomField &&
      !formTimestampCustomFieldName
    )
      return false
    if (
      formJobType === 'backup' &&
      formBackupStartupConfigPath &&
      !formBackupRunningConfigPath
    )
      return false
    if (formInventorySource === 'inventory' && !formInventoryName) return false
    if (formJobType === 'run_commands' && !formCommandTemplate) return false
    if (formJobType === 'deploy_agent') {
      if (!formDeployAgentId) return false
      const hasValidEntry = formDeployTemplateEntries.some(e => e.templateId !== null)
      if (!hasValidEntry) return false
    }
    if (formJobType === 'ip_addresses') {
      if (!formIpFilterField.trim() || !formIpFilterValue.trim()) return false
    }
    if (formJobType === 'csv_import') {
      if (
        !formCsvImportRepoId ||
        !formCsvImportFilePath ||
        !formCsvImportType ||
        !formCsvImportPrimaryKey
      )
        return false
    }
    if (formJobType === 'csv_export') {
      if (
        !formCsvExportRepoId ||
        !formCsvExportFilePath ||
        formCsvExportProperties.length === 0
      )
        return false
    }
    if (formJobType === 'set_primary_ip') {
      if (!formSetPrimaryIpStrategy) return false
      if (formSetPrimaryIpStrategy === 'ip_reachable' && !formSetPrimaryIpAgentId)
        return false
      if (!formInventoryName) return false
    }
    return true
  }, [
    formName,
    formJobType,
    formWriteTimestampToCustomField,
    formTimestampCustomFieldName,
    formBackupStartupConfigPath,
    formBackupRunningConfigPath,
    formInventorySource,
    formInventoryName,
    formCommandTemplate,
    formDeployAgentId,
    formDeployTemplateEntries,
    formIpFilterField,
    formIpFilterValue,
    formCsvImportRepoId,
    formCsvImportFilePath,
    formCsvImportType,
    formCsvImportPrimaryKey,
    formCsvExportRepoId,
    formCsvExportFilePath,
    formCsvExportProperties,
    formSetPrimaryIpStrategy,
    formSetPrimaryIpAgentId,
  ])

  const handleSubmit = async () => {
    const payload = {
      name: formName,
      job_type: formJobType,
      description: formDescription || undefined,
      config_repository_id: formConfigRepoId || undefined,
      inventory_source: formInventorySource,
      inventory_name:
        formInventorySource === 'inventory' ? formInventoryName : undefined,
      command_template_name:
        formJobType === 'run_commands' ? formCommandTemplate : undefined,
      backup_running_config_path:
        formJobType === 'backup' ? formBackupRunningConfigPath : undefined,
      backup_startup_config_path:
        formJobType === 'backup' ? formBackupStartupConfigPath : undefined,
      write_timestamp_to_custom_field:
        formJobType === 'backup' ? formWriteTimestampToCustomField : undefined,
      timestamp_custom_field_name:
        formJobType === 'backup' && formWriteTimestampToCustomField
          ? formTimestampCustomFieldName
          : undefined,
      parallel_tasks: formJobType === 'backup' ? formParallelTasks : undefined,
      activate_changes_after_sync:
        formJobType === 'sync_devices' ? formActivateChangesAfterSync : undefined,
      scan_resolve_dns:
        formJobType === 'scan_prefixes' ? formScanResolveDns : undefined,
      scan_ping_count:
        formJobType === 'scan_prefixes' && formScanPingCount
          ? parseInt(formScanPingCount)
          : undefined,
      scan_timeout_ms:
        formJobType === 'scan_prefixes' && formScanTimeoutMs
          ? parseInt(formScanTimeoutMs)
          : undefined,
      scan_retries:
        formJobType === 'scan_prefixes' && formScanRetries
          ? parseInt(formScanRetries)
          : undefined,
      scan_interval_ms:
        formJobType === 'scan_prefixes' && formScanIntervalMs
          ? parseInt(formScanIntervalMs)
          : undefined,
      scan_custom_field_name:
        formJobType === 'scan_prefixes' ? formScanCustomFieldName : undefined,
      scan_custom_field_value:
        formJobType === 'scan_prefixes' ? formScanCustomFieldValue : undefined,
      scan_response_custom_field_name:
        formJobType === 'scan_prefixes' ? formScanResponseCustomFieldName : undefined,
      scan_set_reachable_ip_active:
        formJobType === 'scan_prefixes' ? formScanSetReachableIpActive : undefined,
      scan_max_ips:
        formJobType === 'scan_prefixes' && formScanMaxIps
          ? parseInt(formScanMaxIps)
          : undefined,
      // Legacy single-template fields (populated from first entry for backward compat)
      deploy_template_id:
        formJobType === 'deploy_agent' && formDeployTemplateEntries[0]?.templateId
          ? formDeployTemplateEntries[0].templateId
          : undefined,
      deploy_agent_id: formJobType === 'deploy_agent' ? formDeployAgentId : undefined,
      deploy_path:
        formJobType === 'deploy_agent' && formDeployTemplateEntries[0]?.path
          ? formDeployTemplateEntries[0].path
          : undefined,
      deploy_custom_variables:
        formJobType === 'deploy_agent' &&
        formDeployTemplateEntries[0]?.customVariables &&
        Object.keys(formDeployTemplateEntries[0].customVariables).length > 0
          ? formDeployTemplateEntries[0].customVariables
          : undefined,
      activate_after_deploy:
        formJobType === 'deploy_agent' ? formActivateAfterDeploy : undefined,
      // Multi-template entries
      deploy_templates:
        formJobType === 'deploy_agent'
          ? formDeployTemplateEntries
              .filter(e => e.templateId !== null)
              .map(e => ({
                template_id: e.templateId!,
                inventory_id: e.inventoryId,
                path: e.path || '',
                custom_variables: e.customVariables,
              }))
          : undefined,
      ip_action: formJobType === 'ip_addresses' ? formIpAction : undefined,
      ip_filter_field: formJobType === 'ip_addresses' ? formIpFilterField : undefined,
      ip_filter_type:
        formJobType === 'ip_addresses'
          ? formIpFilterType && formIpFilterType !== '__eq__'
            ? formIpFilterType
            : null
          : undefined,
      ip_filter_value: formJobType === 'ip_addresses' ? formIpFilterValue : undefined,
      ip_include_null: formJobType === 'ip_addresses' ? formIpIncludeNull : undefined,
      ip_mark_status:
        formJobType === 'ip_addresses' && formIpAction === 'mark'
          ? formIpMarkStatus || undefined
          : undefined,
      ip_mark_tag:
        formJobType === 'ip_addresses' && formIpAction === 'mark'
          ? formIpMarkTag || undefined
          : undefined,
      ip_mark_description:
        formJobType === 'ip_addresses' && formIpAction === 'mark'
          ? formIpMarkDescription || undefined
          : undefined,
      ip_remove_skip_assigned:
        formJobType === 'ip_addresses' && formIpAction === 'remove'
          ? formIpRemoveSkipAssigned
          : undefined,
      // CSV Import fields
      csv_import_repo_id:
        formJobType === 'csv_import' ? formCsvImportRepoId || undefined : undefined,
      csv_import_file_path:
        formJobType === 'csv_import' ? formCsvImportFilePath || undefined : undefined,
      csv_import_type:
        formJobType === 'csv_import' ? formCsvImportType || undefined : undefined,
      csv_import_primary_key:
        formJobType === 'csv_import' ? formCsvImportPrimaryKey || undefined : undefined,
      csv_import_update_existing:
        formJobType === 'csv_import' ? formCsvImportUpdateExisting : undefined,
      csv_import_delimiter:
        formJobType === 'csv_import' ? formCsvImportDelimiter || undefined : undefined,
      csv_import_quote_char:
        formJobType === 'csv_import' ? formCsvImportQuoteChar || undefined : undefined,
      csv_import_column_mapping:
        formJobType === 'csv_import' ? formCsvImportColumnMapping : undefined,
      csv_import_file_filter:
        formJobType === 'csv_import' ? formCsvImportFileFilter || undefined : undefined,
      csv_import_defaults:
        formJobType === 'csv_import' && Object.keys(formCsvImportDefaults).length > 0
          ? formCsvImportDefaults
          : undefined,
      csv_import_format:
        formJobType === 'csv_import' ? formCsvImportFormat || undefined : undefined,
      csv_import_add_prefixes:
        formJobType === 'csv_import' ? formCsvImportAddPrefixes : undefined,
      csv_import_default_prefix_length:
        formJobType === 'csv_import' && formCsvImportAddPrefixes
          ? formCsvImportDefaultPrefixLength || undefined
          : undefined,
      // CSV Export fields
      csv_export_repo_id:
        formJobType === 'csv_export' ? formCsvExportRepoId || undefined : undefined,
      csv_export_file_path:
        formJobType === 'csv_export' ? formCsvExportFilePath || undefined : undefined,
      csv_export_properties:
        formJobType === 'csv_export' && formCsvExportProperties.length > 0
          ? formCsvExportProperties
          : undefined,
      csv_export_delimiter:
        formJobType === 'csv_export' ? formCsvExportDelimiter || undefined : undefined,
      csv_export_quote_char:
        formJobType === 'csv_export' ? formCsvExportQuoteChar || undefined : undefined,
      csv_export_include_headers:
        formJobType === 'csv_export' ? formCsvExportIncludeHeaders : undefined,
      set_primary_ip_strategy:
        formJobType === 'set_primary_ip'
          ? formSetPrimaryIpStrategy || undefined
          : undefined,
      set_primary_ip_agent_id:
        formJobType === 'set_primary_ip'
          ? formSetPrimaryIpAgentId || undefined
          : undefined,
      collect_ip_address:
        formJobType === 'get_client_data' ? formCollectIpAddress : undefined,
      collect_mac_address:
        formJobType === 'get_client_data' ? formCollectMacAddress : undefined,
      collect_hostname:
        formJobType === 'get_client_data' ? formCollectHostname : undefined,
      is_global: formIsGlobal,
    }

    // DEBUG: log CSV fields being submitted to the API
    if (formJobType === 'csv_import') {
      console.debug('[CSV_DEBUG][SUBMIT] CSV payload fields:', {
        csv_import_delimiter: payload.csv_import_delimiter,
        csv_import_quote_char: payload.csv_import_quote_char,
        csv_import_primary_key: payload.csv_import_primary_key,
        csv_import_repo_id: payload.csv_import_repo_id,
        csv_import_file_path: payload.csv_import_file_path,
        csv_import_type: payload.csv_import_type,
        csv_import_update_existing: payload.csv_import_update_existing,
        csv_import_file_filter: payload.csv_import_file_filter,
        csv_import_column_mapping: payload.csv_import_column_mapping,
      })
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
              {editingTemplate ? 'Edit Job Template' : 'Create Job Template'}
            </DialogTitle>
            <DialogDescription className="text-blue-50">
              {editingTemplate
                ? 'Update job template settings'
                : 'Create a new reusable job template'}
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
          {formJobType === 'backup' && (
            <JobTemplateConfigRepoSection
              formConfigRepoId={formConfigRepoId}
              setFormConfigRepoId={setFormConfigRepoId}
              configRepos={configRepos}
            />
          )}

          {/* Inventory - Not for scan_prefixes, deploy_agent, ip_addresses, csv_import, or csv_export */}
          {formJobType !== 'scan_prefixes' &&
            formJobType !== 'deploy_agent' &&
            formJobType !== 'ip_addresses' &&
            formJobType !== 'csv_import' &&
            formJobType !== 'csv_export' && (
              <JobTemplateInventorySection
                formInventorySource={formInventorySource}
                setFormInventorySource={setFormInventorySource}
                formInventoryName={formInventoryName}
                setFormInventoryName={setFormInventoryName}
                savedInventories={savedInventories}
                loadingInventories={loadingInventories}
                inventoryRequired={formJobType === 'set_primary_ip'}
              />
            )}

          {/* Job Type Specific Sections */}
          {formJobType === 'backup' && (
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

          {formJobType === 'compare_devices' && <CompareDevicesJobTemplate />}

          {formJobType === 'run_commands' && (
            <RunCommandsJobTemplate
              formCommandTemplate={formCommandTemplate}
              setFormCommandTemplate={setFormCommandTemplate}
              commandTemplates={commandTemplates}
            />
          )}

          {formJobType === 'sync_devices' && (
            <SyncDevicesJobTemplate
              formActivateChangesAfterSync={formActivateChangesAfterSync}
              setFormActivateChangesAfterSync={setFormActivateChangesAfterSync}
            />
          )}

          {formJobType === 'scan_prefixes' && (
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

          {formJobType === 'ip_addresses' && (
            <MaintainIPAddressesJobTemplate
              formIpAction={formIpAction}
              setFormIpAction={setFormIpAction}
              formIpFilterField={formIpFilterField}
              setFormIpFilterField={setFormIpFilterField}
              formIpFilterType={formIpFilterType}
              setFormIpFilterType={setFormIpFilterType}
              formIpFilterValue={formIpFilterValue}
              setFormIpFilterValue={setFormIpFilterValue}
              formIpIncludeNull={formIpIncludeNull}
              setFormIpIncludeNull={setFormIpIncludeNull}
              formIpMarkStatus={formIpMarkStatus}
              setFormIpMarkStatus={setFormIpMarkStatus}
              formIpMarkTag={formIpMarkTag}
              setFormIpMarkTag={setFormIpMarkTag}
              formIpMarkDescription={formIpMarkDescription}
              setFormIpMarkDescription={setFormIpMarkDescription}
              formIpRemoveSkipAssigned={formIpRemoveSkipAssigned}
              setFormIpRemoveSkipAssigned={setFormIpRemoveSkipAssigned}
              ipStatuses={ipStatuses}
              ipTags={ipTags}
              loadingMarkOptions={loadingIpStatuses || loadingIpTags}
            />
          )}

          {formJobType === 'deploy_agent' && (
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

          {formJobType === 'csv_import' && (
            <>
              <CsvImportJobTemplate
                formCsvImportRepoId={formCsvImportRepoId}
                setFormCsvImportRepoId={setFormCsvImportRepoId}
                formCsvImportFilePath={formCsvImportFilePath}
                setFormCsvImportFilePath={setFormCsvImportFilePath}
                formCsvImportType={formCsvImportType}
                setFormCsvImportType={setFormCsvImportType}
                formCsvImportPrimaryKey={formCsvImportPrimaryKey}
                setFormCsvImportPrimaryKey={setFormCsvImportPrimaryKey}
                formCsvImportUpdateExisting={formCsvImportUpdateExisting}
                setFormCsvImportUpdateExisting={setFormCsvImportUpdateExisting}
                formCsvImportDelimiter={formCsvImportDelimiter}
                setFormCsvImportDelimiter={setFormCsvImportDelimiter}
                formCsvImportQuoteChar={formCsvImportQuoteChar}
                setFormCsvImportQuoteChar={setFormCsvImportQuoteChar}
                formCsvImportColumnMapping={formCsvImportColumnMapping}
                formCsvImportFileFilter={formCsvImportFileFilter}
                setFormCsvImportFileFilter={setFormCsvImportFileFilter}
                formCsvImportFormat={formCsvImportFormat}
                setFormCsvImportFormat={setFormCsvImportFormat}
                formCsvImportAddPrefixes={formCsvImportAddPrefixes}
                setFormCsvImportAddPrefixes={setFormCsvImportAddPrefixes}
                formCsvImportDefaultPrefixLength={formCsvImportDefaultPrefixLength}
                setFormCsvImportDefaultPrefixLength={
                  setFormCsvImportDefaultPrefixLength
                }
                csvImportRepos={csvImportRepos}
                csvFiles={csvFiles}
                csvHeaders={csvHeaders}
                csvFilesLoading={csvFilesLoading}
                csvHeadersLoading={csvHeadersLoading}
                mappedColumnCount={mappedColumnCount}
                onOpenMappingDialog={() => setFormCsvMappingDialogOpen(true)}
                fileQuery={csvFileQuery}
                setFileQuery={setCsvFileQuery}
              />
              <CsvImportMappingDialog
                open={formCsvMappingDialogOpen}
                onOpenChange={setFormCsvMappingDialogOpen}
                csvHeaders={csvHeaders}
                importType={formCsvImportType}
                columnMapping={formCsvImportColumnMapping}
                onMappingChange={setFormCsvImportColumnMapping}
              />
              <CsvImportDefaultsPanel
                importType={formCsvImportType}
                defaults={formCsvImportDefaults}
                onDefaultsChange={setFormCsvImportDefaults}
                nautobotData={csvImportNautobotData}
                isLoading={csvImportNautobotLoading}
              />
            </>
          )}

          {formJobType === 'csv_export' && (
            <CsvExportJobTemplate
              formCsvExportRepoId={formCsvExportRepoId}
              setFormCsvExportRepoId={setFormCsvExportRepoId}
              formCsvExportFilePath={formCsvExportFilePath}
              setFormCsvExportFilePath={setFormCsvExportFilePath}
              formCsvExportProperties={formCsvExportProperties}
              setFormCsvExportProperties={setFormCsvExportProperties}
              formCsvExportDelimiter={formCsvExportDelimiter}
              setFormCsvExportDelimiter={setFormCsvExportDelimiter}
              formCsvExportQuoteChar={formCsvExportQuoteChar}
              setFormCsvExportQuoteChar={setFormCsvExportQuoteChar}
              formCsvExportIncludeHeaders={formCsvExportIncludeHeaders}
              setFormCsvExportIncludeHeaders={setFormCsvExportIncludeHeaders}
              csvExportRepos={csvExportRepos}
            />
          )}

          {formJobType === 'set_primary_ip' && (
            <SetPrimaryIpJobTemplate
              formStrategy={formSetPrimaryIpStrategy}
              setFormStrategy={setFormSetPrimaryIpStrategy}
              formAgentId={formSetPrimaryIpAgentId}
              setFormAgentId={setFormSetPrimaryIpAgentId}
            />
          )}

          {formJobType === 'get_client_data' && (
            <GetClientDataJobTemplate
              collectIpAddress={formCollectIpAddress}
              setCollectIpAddress={setFormCollectIpAddress}
              collectMacAddress={formCollectMacAddress}
              setCollectMacAddress={setFormCollectMacAddress}
              collectHostname={formCollectHostname}
              setCollectHostname={setFormCollectHostname}
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
            disabled={
              !isFormValid() || createTemplate.isPending || updateTemplate.isPending
            }
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
