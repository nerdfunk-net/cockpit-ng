import type { Template, TemplateFilters } from '../types'

/**
 * Get badge variant based on template source
 */
export function getSourceBadgeVariant(source: string): 'default' | 'secondary' | 'outline' {
  switch (source) {
    case 'git':
      return 'default'
    case 'file':
      return 'secondary'
    case 'webeditor':
      return 'outline'
    default:
      return 'secondary'
  }
}

/**
 * Get icon name for template source
 */
export function getSourceIconName(source: string): string {
  switch (source) {
    case 'git':
      return 'GitBranch'
    case 'file':
      return 'Upload'
    case 'webeditor':
      return 'Code'
    default:
      return 'FileCode'
  }
}

/**
 * Filter templates based on search term and filters
 */
export function filterTemplates(
  templates: Template[],
  filters: TemplateFilters
): Template[] {
  return templates.filter(template => {
    const matchesSearch = !filters.search ||
      template.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      template.description?.toLowerCase().includes(filters.search.toLowerCase())

    const matchesCategory = !filters.category ||
      filters.category === '__all__' ||
      template.category === filters.category

    const matchesSource = !filters.source ||
      filters.source === '__all__' ||
      template.source === filters.source

    return matchesSearch && matchesCategory && matchesSource
  })
}

/**
 * Read file content as text
 */
export function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/**
 * Auto-fill template name from filename
 */
export function getTemplateNameFromFile(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}
