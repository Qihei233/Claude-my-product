import type { ReactNode } from 'react'
import type { AnyRow } from '@/api/types'

export interface Column {
  key: string
  label: string
  render?: (row: AnyRow) => ReactNode
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps {
  columns: Column[]
  rows: AnyRow[]
  loading?: boolean
  emptyText?: string
}

export function DataTable({
  columns,
  rows,
  loading = false,
  emptyText = '暂无数据',
}: DataTableProps) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.align ? { textAlign: column.align } : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                加载中…
              </td>
            </tr>
          ) : rows.length ? (
            rows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={column.align ? { textAlign: column.align } : undefined}
                  >
                    {column.render
                      ? column.render(row)
                      : String(row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
