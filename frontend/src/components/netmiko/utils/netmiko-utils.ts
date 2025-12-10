import type { TemplateVariable, ErrorDetails } from '../types'

/**
 * Validates a Jinja2 variable name
 * Variable names must be alphanumeric with underscores, cannot start with a number
 */
export function validateVariableName(name: string): boolean {
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  return validPattern.test(name)
}

/**
 * Prepares variables object for API submission
 * Only includes valid variable names
 */
export function prepareVariablesObject(
  variables: TemplateVariable[]
): Record<string, string> {
  const varsObject: Record<string, string> = {}
  variables.forEach(v => {
    if (v.name && validateVariableName(v.name)) {
      varsObject[v.name] = v.value
    }
  })
  return varsObject
}

/**
 * Parses template rendering errors to extract useful information
 */
export function parseTemplateError(error: unknown): ErrorDetails {
  const errorMessage = (error as Error)?.message || 'Unknown error'
  const details: string[] = []

  // Check if it's a 400 Bad Request with template rendering error
  if (errorMessage.includes('400') && errorMessage.includes('detail')) {
    try {
      // Extract the detail from the error message
      const detailMatch = errorMessage.match(/"detail":"([^"]+)"/)
      if (detailMatch && detailMatch[1]) {
        const detailMessage = detailMatch[1]

        // Parse the detail message for available variables
        const availableVarsMatch = detailMessage.match(/Available variables: (.+)$/)
        const errorDescMatch = detailMessage.match(/^([^.]+)/)

        if (errorDescMatch) {
          details.push(`Error: ${errorDescMatch[1]}`)
        }

        if (availableVarsMatch) {
          details.push(`Available variables: ${availableVarsMatch[1]}`)
        }
      }
    } catch {
      details.push(`Error message: ${errorMessage}`)
    }
  } else {
    details.push(`Error message: ${errorMessage}`)
  }

  return {
    title: 'Template Rendering Failed',
    message: 'The template could not be rendered. Please check the details below:',
    details
  }
}

/**
 * Builds request body for credential authentication
 */
export function buildCredentialRequestBody(
  baseBody: Record<string, unknown>,
  selectedCredentialId: string,
  username: string,
  password: string
): Record<string, unknown> {
  const requestBody = { ...baseBody }

  if (selectedCredentialId === 'manual') {
    requestBody.username = username
    requestBody.password = password
  } else if (selectedCredentialId !== 'manual') {
    requestBody.credential_id = parseInt(selectedCredentialId)
  }

  return requestBody
}

/**
 * Formats execution results for display
 */
export function formatExecutionResults(
  results: Array<{
    device_id: string
    device_name: string
    success: boolean
    rendered_content?: string
    output?: string
    error?: string
  }>,
  dryRun: boolean
) {
  return results.map(r => ({
    device: r.device_name,
    success: r.success,
    output: dryRun
      ? `[DRY RUN - Rendered Commands]\n\n${r.rendered_content || ''}`
      : r.output || r.rendered_content || '',
    error: r.error
  }))
}
