// Hooks
export { useCredentialManager } from './hooks/use-credential-manager'
export { useTemplateManager } from './hooks/use-template-manager'
export { useVariableManager } from './hooks/use-variable-manager'
export { useNetmikoExecution } from './hooks/use-netmiko-execution'

// UI Components
export { InfoCard } from './ui/info-card'
export { LoadingButton } from './ui/loading-button'
export { CredentialSelector } from './ui/credential-selector'

// Tab Components
export { DeviceSelectionTab } from './tabs/device-selection-tab'
export { VariablesAndTemplatesTab } from './tabs/variables-and-templates-tab'
export { CommandExecutionTab } from './tabs/command-execution-tab'

// Dialog Components
export { TestResultDialog } from './dialogs/test-result-dialog'
export { NautobotDataDialog } from './dialogs/nautobot-data-dialog'
export { ErrorDialog } from './dialogs/error-dialog'

// Other Components
export { ExecutionResults } from './components/execution-results'
export { VariableManagerPanel } from './components/variable-manager-panel'
export { TemplateSelectionPanel } from './components/template-selection-panel'

// Utilities
export {
  validateVariableName,
  prepareVariablesObject,
  parseTemplateError,
  buildCredentialRequestBody,
  formatExecutionResults,
} from './utils/netmiko-utils'

// Types
export type {
  StoredCredential,
  CommandResult,
  TemplateVariable,
  Template,
  ExecutionSummary,
  ErrorDetails,
  TemplateExecutionResult,
  CommandExecutionParams,
  TemplateExecutionParams,
} from './types'
