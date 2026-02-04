// Query key factory pattern
// Hierarchical structure enables targeted cache invalidation

export const queryKeys = {
  // CheckMK
  checkmk: {
    all: ['checkmk'] as const,
    hosts: (filters?: { folder?: string; name?: string }) =>
      filters
        ? ([...queryKeys.checkmk.all, 'hosts', filters] as const)
        : ([...queryKeys.checkmk.all, 'hosts'] as const),
    host: (id: string) => [...queryKeys.checkmk.all, 'host', id] as const,
    syncStatus: () => [...queryKeys.checkmk.all, 'sync-status'] as const,
    pendingChanges: () => [...queryKeys.checkmk.all, 'pending-changes'] as const,
    activationStatus: (activationId: string) => [...queryKeys.checkmk.all, 'activation-status', activationId] as const,
  },

  // Git Repositories
  git: {
    all: ['git'] as const,
    repositories: () => [...queryKeys.git.all, 'repositories'] as const,
    repository: (id: number) => [...queryKeys.git.all, 'repository', id] as const,
    status: (id: number) => [...queryKeys.git.repository(id), 'status'] as const,
    tree: (repoId: number | null) =>
      [...queryKeys.git.all, 'tree', repoId] as const,
    directoryFiles: (repoId: number | null, path: string) =>
      [...queryKeys.git.all, 'directoryFiles', repoId, path] as const,
    fileHistory: (repoId: number | null, filePath: string | null) =>
      [...queryKeys.git.all, 'fileHistory', repoId, filePath] as const,
    fileDiff: (repoId: number | null, commit1: string | null, commit2: string | null, filePath: string | null) =>
      [...queryKeys.git.all, 'fileDiff', repoId, commit1, commit2, filePath] as const,
    fileCompare: (repoId: number | null, filePath1: string | null, filePath2: string | null) =>
      [...queryKeys.git.all, 'fileCompare', repoId, filePath1, filePath2] as const,
    fileContent: (repoId: number | null, filePath: string | null) =>
      [...queryKeys.git.all, 'fileContent', repoId, filePath] as const,
  },

  // Celery Jobs
  jobs: {
    all: ['jobs'] as const,

    // List with all filter combinations
    list: (params?: {
      page?: number
      page_size?: number
      status?: string | string[]
      job_type?: string | string[]
      triggered_by?: string | string[]
      template_id?: string | string[]
    }) =>
      params
        ? ([...queryKeys.jobs.all, 'list', params] as const)
        : ([...queryKeys.jobs.all, 'list'] as const),

    // Individual job detail
    detail: (id: number | string) => [...queryKeys.jobs.all, 'detail', id] as const,

    // Progress endpoint (for backup jobs)
    progress: (id: number) => [...queryKeys.jobs.all, 'progress', id] as const,

    // Templates
    templates: () => [...queryKeys.jobs.all, 'templates'] as const,
    template: (id: number) => [...queryKeys.jobs.templates(), id] as const,

    // Template dependencies
    jobTypes: () => [...queryKeys.jobs.all, 'job-types'] as const,
    configRepos: (category?: string) =>
      category
        ? ([...queryKeys.jobs.all, 'config-repos', category] as const)
        : ([...queryKeys.jobs.all, 'config-repos'] as const),
    savedInventories: () => [...queryKeys.jobs.all, 'saved-inventories'] as const,
    commandTemplates: () => [...queryKeys.jobs.all, 'command-templates'] as const,
    customFields: (contentType?: string) =>
      contentType
        ? ([...queryKeys.jobs.all, 'custom-fields', contentType] as const)
        : ([...queryKeys.jobs.all, 'custom-fields'] as const),

    // Schedules
    schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,
    schedule: (id: number) => [...queryKeys.jobs.schedules(), id] as const,

    // Scheduler debug
    schedulerDebug: () => [...queryKeys.jobs.all, 'scheduler-debug'] as const,
  },

  // Nautobot
  nautobot: {
    all: ['nautobot'] as const,
    devices: (filters?: { location?: string; role?: string }) =>
      filters
        ? ([...queryKeys.nautobot.all, 'devices', filters] as const)
        : ([...queryKeys.nautobot.all, 'devices'] as const),
    device: (id: string) => [...queryKeys.nautobot.all, 'device', id] as const,

    // Dropdown data (static-ish, cache for 5 minutes)
    dropdowns: () => [...queryKeys.nautobot.all, 'dropdowns'] as const,
    locations: () => [...queryKeys.nautobot.all, 'locations'] as const,
    roles: () => [...queryKeys.nautobot.all, 'roles'] as const,
    deviceTypes: () => [...queryKeys.nautobot.all, 'device-types'] as const,
    platforms: () => [...queryKeys.nautobot.all, 'platforms'] as const,
    statuses: (type?: string) =>
      type
        ? ([...queryKeys.nautobot.all, 'statuses', type] as const)
        : ([...queryKeys.nautobot.all, 'statuses'] as const),
    softwareVersions: () => [...queryKeys.nautobot.all, 'software-versions'] as const,
    interfaceTypes: () => [...queryKeys.nautobot.all, 'interface-types'] as const,
    namespaces: () => [...queryKeys.nautobot.all, 'namespaces'] as const,
    defaults: () => [...queryKeys.nautobot.all, 'defaults'] as const,

    // Dynamic data (short cache or no cache)
    tags: (contentType: string) => [...queryKeys.nautobot.all, 'tags', contentType] as const,
    customFields: (contentType: string) => [...queryKeys.nautobot.all, 'custom-fields', contentType] as const,
    customFieldChoices: (fieldKey: string) => [...queryKeys.nautobot.all, 'custom-field-choices', fieldKey] as const,
    vlans: (filters?: { location?: string; global?: boolean }) =>
      filters
        ? ([...queryKeys.nautobot.all, 'vlans', filters] as const)
        : ([...queryKeys.nautobot.all, 'vlans'] as const),
  },

  // Network
  network: {
    all: ['network'] as const,

    // Backup
    backupDevices: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.network.all, 'backup-devices', filters] as const)
        : ([...queryKeys.network.all, 'backup-devices'] as const),
    backupHistory: (deviceId: string) =>
      [...queryKeys.network.all, 'backup-history', deviceId] as const,
  },

  // CSV Updates (Nautobot tool)
  csvUpdates: {
    all: ['csv-updates'] as const,
    validation: (objectType: string, csvHash: string) =>
      ['csv-updates', 'validation', objectType, csvHash] as const,
  },

  // Inventory
  inventory: {
    all: ['inventory'] as const,
    list: () => [...queryKeys.inventory.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.inventory.all, 'detail', id] as const,
    preview: () => [...queryKeys.inventory.all, 'preview'] as const,
    byName: (name: string) => [...queryKeys.inventory.all, 'by-name', name] as const,
    byId: (id: number) => [...queryKeys.inventory.all, 'by-id', id] as const,
    fieldOptions: () => [...queryKeys.inventory.all, 'field-options'] as const,
    fieldValues: (fieldName: string) => [...queryKeys.inventory.all, 'field-values', fieldName] as const,
    customFields: () => [...queryKeys.inventory.all, 'custom-fields'] as const,
  },

  // Compliance
  compliance: {
    all: ['compliance'] as const,
    rules: () => [...queryKeys.compliance.all, 'rules'] as const,
    checks: (deviceId?: string) =>
      deviceId
        ? ([...queryKeys.compliance.all, 'checks', deviceId] as const)
        : ([...queryKeys.compliance.all, 'checks'] as const),
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    nautobot: () => [...queryKeys.settings.all, 'nautobot'] as const,
    checkmk: () => [...queryKeys.settings.all, 'checkmk'] as const,
    credentials: () => [...queryKeys.settings.all, 'credentials'] as const,
    git: () => [...queryKeys.settings.all, 'git'] as const,
    celery: () => [...queryKeys.settings.all, 'celery'] as const,
  },

  // Celery
  celery: {
    all: ['celery'] as const,

    // Status
    status: () => [...queryKeys.celery.all, 'status'] as const,

    // Settings
    settings: () => [...queryKeys.celery.all, 'settings'] as const,

    // Workers
    workers: () => [...queryKeys.celery.all, 'workers'] as const,

    // Schedules
    schedules: () => [...queryKeys.celery.all, 'schedules'] as const,

    // Queues
    queues: () => [...queryKeys.celery.all, 'queues'] as const,

    // Task status
    task: (taskId: string) => [...queryKeys.celery.all, 'task', taskId] as const,
  },

  // Cache
  cache: {
    all: ['cache'] as const,

    // Settings
    settings: () => [...queryKeys.cache.all, 'settings'] as const,

    // Statistics
    stats: () => [...queryKeys.cache.all, 'stats'] as const,

    // Entries
    entries: (includeExpired?: boolean) =>
      includeExpired
        ? ([...queryKeys.cache.all, 'entries', { includeExpired }] as const)
        : ([...queryKeys.cache.all, 'entries'] as const),

    // Namespace
    namespace: (namespace: string) => [...queryKeys.cache.all, 'namespace', namespace] as const,
  },

  // Credentials
  credentials: {
    all: ['credentials'] as const,
    list: (filters?: { source?: string; includeExpired?: boolean; git?: boolean }) =>
      filters
        ? ([...queryKeys.credentials.all, 'list', filters] as const)
        : ([...queryKeys.credentials.all, 'list'] as const),
    detail: (id: number) => [...queryKeys.credentials.all, 'detail', id] as const,
  },

  // Check IP Tool
  checkIp: {
    all: ['checkIp'] as const,
    task: (taskId: string) => [...queryKeys.checkIp.all, 'task', taskId] as const,
    settings: () => [...queryKeys.checkIp.all, 'settings'] as const,
  },

  // RBAC (Role-Based Access Control)
  rbac: {
    all: ['rbac'] as const,

    // Users
    users: () => [...queryKeys.rbac.all, 'users'] as const,
    user: (id: number) => [...queryKeys.rbac.all, 'user', id] as const,
    userRoles: (userId: number) => [...queryKeys.rbac.all, 'user', userId, 'roles'] as const,
    userPermissions: (userId: number) => [...queryKeys.rbac.all, 'user', userId, 'permissions'] as const,

    // Roles
    roles: () => [...queryKeys.rbac.all, 'roles'] as const,
    role: (id: number) => [...queryKeys.rbac.all, 'role', id] as const,
    rolePermissions: (roleId: number) => [...queryKeys.rbac.all, 'role', roleId, 'permissions'] as const,

    // Permissions
    permissions: () => [...queryKeys.rbac.all, 'permissions'] as const,
  },

  // Common Settings
  commonSettings: {
    all: ['commonSettings'] as const,
    snmpMapping: () => [...queryKeys.commonSettings.all, 'snmpMapping'] as const,
  },

  // Nautobot Settings
  nautobotSettings: {
    all: ['nautobotSettings'] as const,
    settings: () => [...queryKeys.nautobotSettings.all, 'settings'] as const,
    defaults: () => [...queryKeys.nautobotSettings.all, 'defaults'] as const,
    offboarding: () => [...queryKeys.nautobotSettings.all, 'offboarding'] as const,
    options: () => [...queryKeys.nautobotSettings.all, 'options'] as const,
    customFields: () => [...queryKeys.nautobotSettings.all, 'customFields'] as const,
    customFieldChoices: (fieldName: string) =>
      [...queryKeys.nautobotSettings.customFields(), 'choices', fieldName] as const,
  },

  // CheckMK Settings
  checkmkSettings: {
    all: ['checkmkSettings'] as const,
    settings: () => [...queryKeys.checkmkSettings.all, 'settings'] as const,
    yaml: () => [...queryKeys.checkmkSettings.all, 'yaml'] as const,
    checkmkYaml: () => [...queryKeys.checkmkSettings.yaml(), 'checkmk'] as const,
    queriesYaml: () => [...queryKeys.checkmkSettings.yaml(), 'queries'] as const,
  },

  // Compliance Settings
  complianceSettings: {
    all: ['complianceSettings'] as const,
    regexPatterns: () =>
      [...queryKeys.complianceSettings.all, 'regexPatterns'] as const,
    loginCredentials: () =>
      [...queryKeys.complianceSettings.all, 'loginCredentials'] as const,
    snmpMappings: () =>
      [...queryKeys.complianceSettings.all, 'snmpMappings'] as const,
  },
}
