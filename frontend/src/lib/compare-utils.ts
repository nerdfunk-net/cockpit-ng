/**
 * Compare Utilities
 * Shared utility functions for diff comparison features
 */

import type { DiffLine, ComparisonResult } from '@/types/git'

/**
 * Get CSS class for left-side diff lines based on line type
 */
export function getLeftLineClass(type: DiffLine['type'] | string): string {
  switch (type) {
    case 'delete': return 'bg-red-50 text-red-900'
    case 'replace': return 'bg-yellow-50 text-yellow-900'
    case 'equal': return 'bg-white'
    case 'empty': return 'bg-gray-50'
    default: return 'bg-white'
  }
}

/**
 * Get CSS class for right-side diff lines based on line type
 */
export function getRightLineClass(type: DiffLine['type'] | string): string {
  switch (type) {
    case 'insert': return 'bg-green-50 text-green-900'
    case 'replace': return 'bg-yellow-50 text-yellow-900'
    case 'equal': return 'bg-white'
    case 'empty': return 'bg-gray-50'
    default: return 'bg-white'
  }
}

/**
 * Export diff as a downloadable patch file
 */
export function exportDiffAsText(
  result: ComparisonResult,
  filename?: string
): void {
  if (!result) return

  const diffContent = result.diff_lines.join('\n')
  const header = `--- ${result.left_file}\n+++ ${result.right_file}\n`

  const blob = new Blob([header + diffContent], {
    type: 'text/plain'
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `diff-${Date.now()}.patch`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Format a commit message by truncating if too long
 */
export function formatCommitMessage(
  message: string,
  maxLength: number = 50
): string {
  if (!message) return ''
  return message.length > maxLength
    ? message.substring(0, maxLength) + '...'
    : message
}

/**
 * Get statistics from diff lines
 */
export function getDiffStats(diffLines: DiffLine[]): {
  additions: number
  deletions: number
  changes: number
  total: number
} {
  const stats = diffLines.reduce((acc, line) => {
    if (line.type === 'insert') acc.additions++
    if (line.type === 'delete') acc.deletions++
    if (line.type === 'replace') acc.changes++
    return acc
  }, { additions: 0, deletions: 0, changes: 0 })

  return {
    ...stats,
    total: stats.additions + stats.deletions + stats.changes
  }
}

/**
 * Filter diff lines to hide unchanged lines
 */
export function filterUnchangedLines(
  diffLines: DiffLine[],
  hideUnchanged: boolean
): DiffLine[] {
  if (!hideUnchanged) return diffLines
  return diffLines.filter(line => line.type !== 'equal')
}

/**
 * Find all diff sections (groups of changed lines)
 */
export function findDiffSections(diffLines: DiffLine[]): number[] {
  const sections: number[] = []
  diffLines.forEach((line, index) => {
    if (line.type !== 'equal') {
      sections.push(index)
    }
  })
  return sections
}

/**
 * Scroll to a specific diff line
 */
export function scrollToDiffLine(index: number, containerId?: string): void {
  const container = containerId
    ? document.getElementById(containerId)
    : document

  const element = container?.querySelector(`[data-line-index="${index}"]`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
