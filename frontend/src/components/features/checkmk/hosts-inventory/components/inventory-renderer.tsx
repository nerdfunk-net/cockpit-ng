import type { ReactNode } from 'react'

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
export const InventoryRenderer = ({
  data,
  depth = 0,
}: {
  data: unknown
  depth?: number
}): ReactNode => {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic text-xs">-</span>
  }

  if (typeof data !== 'object') {
    if (typeof data === 'boolean') {
      return (
        <span className="text-warning-foreground font-medium text-xs">
          {data.toString()}
        </span>
      )
    }
    if (typeof data === 'number') {
      return <span className="text-info-foreground font-medium text-xs">{data}</span>
    }
    if (typeof data === 'string') {
      return <span className="text-success-foreground text-xs">{data}</span>
    }
    return <span className="text-muted-foreground text-xs">{String(data)}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground italic text-xs">empty</span>
    }
    return (
      <div className="space-y-1 w-full">
        {data.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="flex items-start gap-2 w-full">
            <span className="text-muted-foreground text-xs font-medium select-none min-w-[35px]">
              [{index}]
            </span>
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
    // Check if attributes has actual content (not just empty Pairs object)
    const attributesPairs =
      objData.Attributes &&
      ((objData.Attributes as Record<string, unknown>).Pairs as
        | Record<string, unknown>
        | undefined)
    const excludedKeys = [
      'available_ethernet_ports',
      'total_ethernet_ports',
      'total_interfaces',
    ]
    const filteredAttributes = attributesPairs
      ? Object.entries(attributesPairs).filter(([key]) => !excludedKeys.includes(key))
      : []
    const hasAttributes = filteredAttributes.length > 0

    const hasNodes =
      objData.Nodes && Object.keys(objData.Nodes as Record<string, unknown>).length > 0
    const hasTable =
      objData.Table &&
      (objData.Table as Record<string, unknown>).Rows &&
      ((objData.Table as Record<string, unknown>).Rows as unknown[]).length > 0

    return (
      <div className="space-y-3 w-full">
        {hasAttributes ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Attributes</div>
            <div className="space-y-1">
              <InventoryRenderer
                data={Object.fromEntries(filteredAttributes)}
                depth={depth + 1}
              />
            </div>
          </div>
        ) : null}

        {hasNodes ? (
          <div className="space-y-2">
            {Object.entries(objData.Nodes as Record<string, unknown>).map(
              ([key, value]) => (
                <div key={key}>
                  <div className="text-xs font-semibold text-info-foreground mb-1.5">
                    {key}
                  </div>
                  <InventoryRenderer data={value} depth={depth + 1} />
                </div>
              )
            )}
          </div>
        ) : null}

        {hasTable ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Table</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px] border border-border">
                <thead className="bg-muted">
                  <tr>
                    {(() => {
                      const rows = (objData.Table as Record<string, unknown>)
                        .Rows as Record<string, unknown>[]
                      const keyColumns = (objData.Table as Record<string, unknown>)
                        .KeyColumns as string[] | undefined

                      // Collect ALL unique keys from ALL rows (to handle inconsistent structures)
                      const allKeys = new Set<string>()
                      rows.forEach(row => {
                        Object.keys(row).forEach(key => allKeys.add(key))
                      })

                      // Separate key columns from other columns
                      const otherColumns = Array.from(allKeys).filter(
                        k => !keyColumns || !keyColumns.includes(k)
                      )

                      // Render headers: KeyColumns first, then all other columns
                      return (
                        <>
                          {keyColumns?.map(col => (
                            <th
                              key={col}
                              className="border border-border px-2 py-1 text-left font-medium text-muted-foreground"
                            >
                              {col}
                            </th>
                          ))}
                          {otherColumns.map(col => (
                            <th
                              key={col}
                              className="border border-border px-2 py-1 text-left font-medium text-muted-foreground"
                            >
                              {col}
                            </th>
                          ))}
                        </>
                      )
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {(
                    (objData.Table as Record<string, unknown>).Rows as Record<
                      string,
                      unknown
                    >[]
                  ).map((row, idx) => {
                    const rows = (objData.Table as Record<string, unknown>)
                      .Rows as Record<string, unknown>[]
                    const keyColumns = (objData.Table as Record<string, unknown>)
                      .KeyColumns as string[] | undefined

                    // Collect ALL unique keys from ALL rows (same logic as header)
                    const allKeys = new Set<string>()
                    rows.forEach(r => {
                      Object.keys(r).forEach(key => allKeys.add(key))
                    })

                    // Separate key columns from other columns
                    const otherColumns = Array.from(allKeys).filter(
                      k => !keyColumns || !keyColumns.includes(k)
                    )

                    // Render columns in the same order as header: KeyColumns first, then others
                    const orderedColumns = [...(keyColumns || []), ...otherColumns]

                    return (
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={idx} className="hover:bg-muted">
                        {orderedColumns.map(key => (
                          <td key={key} className="border border-border px-2 py-1">
                            <InventoryRenderer data={row[key]} depth={depth + 1} />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // Regular object rendering
  const excludedKeys = [
    'available_ethernet_ports',
    'total_ethernet_ports',
    'total_interfaces',
  ]
  const entries = Object.entries(objData).filter(([key]) => !excludedKeys.includes(key))

  if (entries.length === 0) {
    return <span className="text-muted-foreground italic text-xs">empty</span>
  }

  return (
    <div className="space-y-0.5 w-full">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 w-full">
          <span className="text-xs font-medium text-muted-foreground min-w-[120px] flex-shrink-0">
            {key}:
          </span>
          <div className="flex-1 min-w-0 break-words">
            <InventoryRenderer data={value} depth={depth + 1} />
          </div>
        </div>
      ))}
    </div>
  )
}
