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
    list: (filters?: { status?: string }) =>
      filters
        ? ([...queryKeys.jobs.all, 'list', filters] as const)
        : ([...queryKeys.jobs.all, 'list'] as const),
    detail: (id: string) => [...queryKeys.jobs.all, 'detail', id] as const,
    templates: () => [...queryKeys.jobs.all, 'templates'] as const,
    schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,
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
    list: (filters?: { git?: boolean }) =>
      filters
        ? ([...queryKeys.credentials.all, 'list', filters] as const)
        : ([...queryKeys.credentials.all, 'list'] as const),
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
