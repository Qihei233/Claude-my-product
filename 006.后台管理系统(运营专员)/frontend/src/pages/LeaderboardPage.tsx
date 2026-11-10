import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeaderboard } from '@/api/admin'
import type { AnyRow } from '@/api/types'
import { Badge } from '@/components/Badge'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'

export function LeaderboardPage() {
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getLeaderboard()
      .then((result) => {
        if (!cancelled) setRows(result as unknown as AnyRow[])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <PageHeader title="周排行榜" subtitle="基于近 7 天学习统计的只读榜单" />
      {error ? <div className="alert">{error}</div> : null}
      <section className="panel">
        <DataTable
          columns={[
            { key: 'rank', label: '名次', align: 'center' },
            {
              key: 'nickname',
              label: '用户',
              render: (row) => (
                <Link className="text-link" to={`/users/${row.userId}`}>
                  {String(row.nickname)}
                </Link>
              ),
            },
            {
              key: 'level',
              label: '等级',
              align: 'center',
              render: (row) => <Badge tone="blue">Lv.{String(row.level)}</Badge>,
            },
            { key: 'weekStudyMinutes', label: '本周学习分钟', align: 'right' },
            { key: 'weekQuestionsPassed', label: '本周通过题目', align: 'right' },
            { key: 'weekExp', label: '本周经验', align: 'right' },
          ]}
          rows={rows}
          loading={loading}
          emptyText="本周暂无学习数据"
        />
      </section>
    </div>
  )
}
