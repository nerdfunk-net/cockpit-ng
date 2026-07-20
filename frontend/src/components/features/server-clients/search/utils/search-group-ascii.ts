import {
  isSearchGroup,
  SEARCH_FIELD_LABELS,
  type SearchGroup,
  type SearchRule,
} from '../types'

function formatRuleValue(rule: SearchRule): string {
  if (Array.isArray(rule.value)) return rule.value.join(', ')
  return String(rule.value)
}

function groupLabel(group: SearchGroup, isRoot: boolean): string {
  const combinator = group.combinator.toUpperCase()
  const base = isRoot ? `ROOT (${combinator})` : `GROUP (${combinator})`
  return group.not ? `NOT ${base}` : base
}

/**
 * Generates an ASCII tree visualization of a SearchGroup, for use in
 * save/load/manage saved-search dialogs.
 */
export function generateSearchGroupAscii(group: SearchGroup): string {
  const lines: string[] = [groupLabel(group, true)]

  if (group.rules.length === 0) {
    lines.push('  (empty)')
    return lines.join('\n')
  }

  const renderItem = (
    item: SearchRule | SearchGroup,
    prefix: string,
    isLast: boolean
  ) => {
    const connector = isLast ? '└─ ' : '├─ '
    const extension = isLast ? '   ' : '│  '

    if (isSearchGroup(item)) {
      lines.push(`${prefix}${connector}${groupLabel(item, false)}`)
      if (item.rules.length === 0) {
        lines.push(`${prefix}${extension}   (empty group)`)
      } else {
        item.rules.forEach((subItem, idx) => {
          renderItem(subItem, `${prefix}${extension}`, idx === item.rules.length - 1)
        })
      }
    } else {
      const fieldLabel = SEARCH_FIELD_LABELS[item.field] ?? item.field
      lines.push(`${prefix}${connector}${fieldLabel} ${item.op} ${formatRuleValue(item)}`)
    }
  }

  group.rules.forEach((item, idx) => {
    renderItem(item, '', idx === group.rules.length - 1)
  })

  return lines.join('\n')
}
