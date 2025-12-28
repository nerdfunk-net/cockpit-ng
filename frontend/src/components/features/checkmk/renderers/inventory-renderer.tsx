import React from 'react'

/**
 * Helper component to render CheckMK inventory data structure
 * 
 * Handles the hierarchical structure of CheckMK inventory data with:
 * - Primitive types (strings, numbers, booleans, null/undefined)
 * - Arrays with indexed display
 * - CheckMK inventory nodes (Attributes, Nodes, Table)
 * - Regular objects with key-value pairs
 * 
 * @param data - The inventory data to render
 * @param depth - Current recursion depth (for internal use)
 */
export const InventoryRenderer = ({ data, depth = 0 }: { data: unknown; depth?: number }): React.ReactNode => {
  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">-</span>
  }

  if (typeof data !== 'object') {
    if (typeof data === 'boolean') {
      return <span className="text-purple-600 font-medium">{data.toString()}</span>
    }
    if (typeof data === 'number') {
      return <span className="text-blue-600 font-medium">{data}</span>
    }
    if (typeof data === 'string') {
      return <span className="text-green-600">{data}</span>
    }
    return <span className="text-gray-500">{String(data)}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-400 italic">empty</span>
    }
    return (
      <div className="space-y-2 w-full">
        {data.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="flex items-start gap-3 w-full">
            <span className="text-gray-500 font-medium select-none min-w-[40px]">[{index}]</span>
            <div className="flex-1 min-w-0">
              <InventoryRenderer data={item} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Handle CheckMK inventory structure
  const objData = data as Record<string, unknown>

  // Check if this is a CheckMK inventory node (has Attributes, Nodes, Table)
  if ('Attributes' in objData || 'Nodes' in objData || 'Table' in objData) {
    const hasAttributes = objData.Attributes && (objData.Attributes as Record<string, unknown>).Pairs
    const hasNodes = objData.Nodes && Object.keys(objData.Nodes as Record<string, unknown>).length > 0
    const hasTable = objData.Table && (objData.Table as Record<string, unknown>).Rows &&
                     ((objData.Table as Record<string, unknown>).Rows as unknown[]).length > 0

    return (
      <div className="space-y-4 w-full">
        {hasAttributes ? (
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">Attributes</div>
            <div className="space-y-1 pl-4 border-l-2 border-blue-200">
              <InventoryRenderer data={(objData.Attributes as Record<string, unknown>).Pairs} depth={depth + 1} />
            </div>
          </div>
        ) : null}

        {hasNodes ? (
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">Subsections</div>
            <div className="space-y-3 pl-4">
              {Object.entries(objData.Nodes as Record<string, unknown>).map(([key, value]) => (
                <div key={key} className="border-l-2 border-purple-200 pl-4">
                  <div className="font-semibold text-purple-700 mb-2">{key}</div>
                  <InventoryRenderer data={value} depth={depth + 1} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {hasTable ? (
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">Table</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    {(() => {
                      const keyColumns = (objData.Table as Record<string, unknown>).KeyColumns as string[] | undefined
                      if (keyColumns) {
                        return keyColumns.map((col) => (
                          <th key={col} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700">
                            {col}
                          </th>
                        ))
                      }
                      return null
                    })()}
                    {(() => {
                      const rows = (objData.Table as Record<string, unknown>).Rows as Record<string, unknown>[]
                      const keyColumns = (objData.Table as Record<string, unknown>).KeyColumns as string[] | undefined
                      if (rows[0]) {
                        return Object.keys(rows[0])
                          .filter(k => !keyColumns || !keyColumns.includes(k))
                          .map((col) => (
                            <th key={col} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700">
                              {col}
                            </th>
                          ))
                      }
                      return null
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {((objData.Table as Record<string, unknown>).Rows as Record<string, unknown>[]).map((row, idx) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.entries(row).map(([key, value]) => (
                        <td key={key} className="border border-gray-300 px-2 py-1">
                          <InventoryRenderer data={value} depth={depth + 1} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // Regular object rendering
  const entries = Object.entries(objData)
  if (entries.length === 0) {
    return <span className="text-gray-400 italic">empty</span>
  }

  return (
    <div className="space-y-1 w-full">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-3 w-full">
          <span className="font-medium text-gray-700 min-w-[120px] flex-shrink-0">{key}:</span>
          <div className="flex-1 min-w-0 break-words">
            <InventoryRenderer data={value} depth={depth + 1} />
          </div>
        </div>
      ))}
    </div>
  )
}
