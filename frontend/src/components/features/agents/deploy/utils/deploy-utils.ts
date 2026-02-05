// Utility functions for Agents deploy operations

export function validateDeviceSelection(deviceIds: string[]): boolean {
  return deviceIds.length > 0
}

export function validateTemplateSelection(templateId: string): boolean {
  return templateId !== 'none' && templateId !== ''
}

export function validateRepositorySelection(repoId: number | null): boolean {
  return repoId !== null && repoId > 0
}

export function formatDeploymentSummary(total: number, successful: number, failed: number): string {
  return `Total: ${total} | Success: ${successful} | Failed: ${failed}`
}
