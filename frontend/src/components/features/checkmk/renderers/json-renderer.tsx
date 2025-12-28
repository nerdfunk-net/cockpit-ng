import React from 'react'

/**
 * Helper component to render structured JSON data with color grouping
 * 
 * Displays JSON data with visual grouping at the top level using different color shades.
 * Handles all JSON data types with appropriate formatting:
 * - Primitives: color-coded (purple for booleans, blue for numbers, green for strings)
 * - Arrays: indexed list display
 * - Objects: key-value pairs with visual grouping
 * 
 * @param data - The JSON data to render
 * @param depth - Current recursion depth (0 = top level with color groups)
 * @param groupIndex - Color group index for nested items (internal use)
 */
export const JsonRenderer = ({ data, depth = 0, groupIndex = 0 }: { data: unknown; depth?: number; groupIndex?: number }): React.ReactNode => {
  if (data === null) return <span className="text-gray-400 italic">null</span>
  if (data === undefined) return <span className="text-gray-400 italic">undefined</span>

  if (typeof data === 'boolean') {
    return <span className="text-purple-600 font-medium">{data.toString()}</span>
  }

  if (typeof data === 'number') {
    return <span className="text-blue-600 font-medium">{data}</span>
  }

  if (typeof data === 'string') {
    return <span className="text-green-600">{data}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-400">[ ]</span>
    }
    return (
      <div className="space-y-2 w-full">
        {data.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="flex items-start gap-3 w-full">
            <span className="text-gray-500 font-medium select-none min-w-[40px]">[{index}]</span>
            <div className="flex-1 min-w-0">
              <JsonRenderer data={item} depth={depth + 1} groupIndex={groupIndex} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return <span className="text-gray-400">{'{}'}</span>
    }

    // Color palette for groups - different shades of blue
    const bgColors = [
      'bg-blue-50/50',
      'bg-sky-50/50',
      'bg-cyan-50/50',
      'bg-indigo-50/50',
    ]

    const borderColors = [
      'border-blue-100',
      'border-sky-100',
      'border-cyan-100',
      'border-indigo-100',
    ]

    return (
      <div className={depth === 0 ? 'space-y-2' : 'space-y-2 w-full'}>
        {entries.map(([key, value], index) => {
          const currentGroupIndex = depth === 0 ? index % bgColors.length : groupIndex
          const bgColor = depth === 0 ? bgColors[currentGroupIndex] : ''
          const borderColor = depth === 0 ? borderColors[currentGroupIndex] : ''

          return (
            <div
              key={key}
              className={`flex items-start gap-4 w-full ${depth === 0 ? `p-3 rounded-lg border ${bgColor} ${borderColor}` : ''}`}
            >
              <span className={`font-semibold text-gray-700 flex-shrink-0 break-words ${depth === 0 ? 'w-[240px]' : 'min-w-[160px]'}`}>{key}:</span>
              <div className="flex-1 min-w-0 break-words">
                <JsonRenderer data={value} depth={depth + 1} groupIndex={currentGroupIndex} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return <span className="text-gray-500">{String(data)}</span>
}
