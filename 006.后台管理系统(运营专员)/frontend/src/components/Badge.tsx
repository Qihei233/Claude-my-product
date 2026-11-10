import type { ReactNode } from 'react'
import { statusLabels, statusTone } from '@/utils/format'

export function Badge({
  tone = 'gray',
  children,
}: {
  tone?: string
  children: ReactNode
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StatusBadge({ value }: { value: unknown }) {
  const status = String(value || '')
  return (
    <Badge tone={statusTone(status)}>
      {statusLabels[status] || status || '-'}
    </Badge>
  )
}
