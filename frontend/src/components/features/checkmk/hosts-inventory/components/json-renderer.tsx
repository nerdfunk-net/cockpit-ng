import type { ReactNode } from 'react'

/**
 * Helper component to render structured JSON data with visual grouping
 *
 * Displays JSON data with visual grouping at the top level.
 * Handles all JSON data types with appropriate formatting:
 * - Primitives: token-coded (warning for booleans, info for numbers, success for strings)
 * - Arrays: indexed list display
 * - Objects: key-value pairs with visual grouping
 *
 * @param data - The JSON data to render
 * @param depth - Current recursion depth (0 = top level with grouping)
 */
export const JsonRenderer = ({
  data,
  depth = 0,
}: {
  data: unknown
  depth?: number
}): ReactNode => {
  if (data === null) return <span className="text-muted-foreground italic">null</span>
  if (data === undefined)
    return <span className="text-muted-foreground italic">undefined</span>

  if (typeof data === 'boolean') {
    return <span className="text-warning-foreground font-medium">{data.toString()}</span>
  }

  if (typeof data === 'number') {
    return <span className="text-info-foreground font-medium">{data}</span>
  }

  if (typeof data === 'string') {
    return <span className="text-success-foreground">{data}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground">[ ]</span>
    }
    return (
      <div className="space-y-2 w-full">
        {data.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="flex items-start gap-3 w-full">
            <span className="text-muted-foreground font-medium select-none min-w-[40px]">
              [{index}]
            </span>
            <div className="flex-1 min-w-0">
              <JsonRenderer data={item} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return <span className="text-muted-foreground">{'{}'}</span>
    }

    return (
      <div className={depth === 0 ? 'space-y-2' : 'space-y-2 w-full'}>
        {entries.map(([key, value]) => (
          <div
            key={key}
            className={`flex items-start gap-4 w-full ${depth === 0 ? 'p-3 rounded-lg border bg-muted/50 border-border' : ''}`}
          >
            <span
              className={`font-semibold text-muted-foreground flex-shrink-0 break-words ${depth === 0 ? 'w-[240px]' : 'min-w-[160px]'}`}
            >
              {key}:
            </span>
            <div className="flex-1 min-w-0 break-words">
              <JsonRenderer data={value} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return <span className="text-muted-foreground">{String(data)}</span>
}
