import type { TemplateVariable } from '../types'

interface CategoryConfig {
  defaults: string[]
  descriptions: Record<string, string>
}

const CATEGORY_VARIABLES: Record<string, CategoryConfig> = {
  agent: {
    defaults: ['devices', 'device_details', 'snmp_mapping', 'path'],
    descriptions: {
      devices: 'List of devices from inventory',
      device_details: 'Detailed device data from Nautobot (per device)',
      snmp_mapping: 'SNMP credential mapping (if enabled)',
      path: 'Deployment path',
    },
  },
  netmiko: {
    defaults: ['devices', 'device_details', 'pre_run.raw', 'pre_run.parsed'],
    descriptions: {
      devices: 'List of test device (single device from Netmiko panel)',
      device_details: 'Detailed device data from Nautobot for test device',
      'pre_run.raw': 'Raw output from pre-run command execution',
      'pre_run.parsed': 'Parsed output from pre-run command (TextFSM)',
    },
  },
  __none__: {
    defaults: [],
    descriptions: {},
  },
}

export function getDefaultVariables(category: string): TemplateVariable[] {
  const config = CATEGORY_VARIABLES[category] ?? CATEGORY_VARIABLES['__none__']!
  return config.defaults.map((name) => ({
    id: `default-${name}`,
    name,
    value: '',
    isDefault: true,
    isAutoFilled: true,
    description: config.descriptions[name] || '',
    requiresExecution: name.startsWith('pre_run.'),  // Mark pre_run variables as requiring execution
    isExecuting: false,
  }))
}

export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_VARIABLES[category] ?? CATEGORY_VARIABLES['__none__']!
}
