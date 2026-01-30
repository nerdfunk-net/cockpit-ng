import { z } from 'zod'

// Base schema with common fields
const baseTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().optional(),
  inventory_source: z.enum(["all", "inventory"]),
  inventory_name: z.string().optional(),
  is_global: z.boolean(),
})

// Backup job type schema
const backupTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("backup"),
  config_repository_id: z.number().nullable().optional(),
  backup_running_config_path: z.string().optional(),
  backup_startup_config_path: z.string().optional(),
  write_timestamp_to_custom_field: z.boolean(),
  timestamp_custom_field_name: z.string().optional(),
  parallel_tasks: z.number().min(1, "Must be at least 1").max(50, "Too many parallel tasks"),
}).refine((data) => {
  // Inventory validation
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  // Both backup paths must be specified together
  const hasRunning = !!data.backup_running_config_path
  const hasStartup = !!data.backup_startup_config_path
  if (hasRunning !== hasStartup) {
    return false
  }
  // Custom field required when timestamp enabled
  if (data.write_timestamp_to_custom_field && !data.timestamp_custom_field_name) {
    return false
  }
  return true
}, {
  message: "Invalid field combination",
  path: ["backup_running_config_path"]
})

// Run Commands job type schema
const runCommandsTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("run_commands"),
  command_template_name: z.string().min(1, "Command template is required"),
}).refine((data) => {
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  return true
}, {
  message: "Please select a saved inventory",
  path: ["inventory_name"]
})

// Sync Devices job type schema
const syncDevicesTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("sync_devices"),
  activate_changes_after_sync: z.boolean(),
}).refine((data) => {
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  return true
}, {
  message: "Please select a saved inventory",
  path: ["inventory_name"]
})

// Compare Devices job type schema
const compareDevicesTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("compare_devices"),
}).refine((data) => {
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  return true
}, {
  message: "Please select a saved inventory",
  path: ["inventory_name"]
})

// Cache Devices job type schema
const cacheDevicesTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("cache_devices"),
}).refine((data) => {
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  return true
}, {
  message: "Please select a saved inventory",
  path: ["inventory_name"]
})

// Scan Prefixes job type schema (no inventory)
const scanPrefixesTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  job_type: z.literal("scan_prefixes"),
  description: z.string().optional(),
  scan_resolve_dns: z.boolean(),
  scan_ping_count: z.number().min(1).max(10).optional(),
  scan_timeout_ms: z.number().min(100).max(30000).optional(),
  scan_retries: z.number().min(0).max(5).optional(),
  scan_interval_ms: z.number().min(100).max(5000).optional(),
  scan_custom_field_name: z.string().optional(),
  scan_custom_field_value: z.string().optional(),
  scan_response_custom_field_name: z.string().optional(),
  scan_max_ips: z.number().min(1).max(10000).optional(),
  is_global: z.boolean(),
})

// Discriminated union for all job types
export const jobTemplateSchema = z.discriminatedUnion("job_type", [
  backupTemplateSchema,
  runCommandsTemplateSchema,
  syncDevicesTemplateSchema,
  compareDevicesTemplateSchema,
  cacheDevicesTemplateSchema,
  scanPrefixesTemplateSchema,
])

export type JobTemplateFormData = z.infer<typeof jobTemplateSchema>
