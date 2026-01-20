import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ReactNode } from 'react'

interface Column<T> {
  header: string
  accessor: keyof T | ((item: T) => ReactNode)
  className?: string
}

interface RBACDataTableProps<T extends { id: number }> {
  data: T[]
  columns: Column<T>[]
  actions?: (item: T) => ReactNode
  emptyMessage?: string
}

export function RBACDataTable<T extends { id: number }>({
  data,
  columns,
  actions,
  emptyMessage = 'No data available',
}: RBACDataTableProps<T>) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.header} className={col.className}>
                {col.header}
              </TableHead>
            ))}
            {actions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id}>
                {columns.map((col) => (
                  <TableCell key={col.header} className={col.className}>
                    {typeof col.accessor === 'function'
                      ? col.accessor(item)
                      : String(item[col.accessor])}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="text-right">
                    {actions(item)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
