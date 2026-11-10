import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  Code2,
  Send,
  UserPlus,
  Users,
} from 'lucide-react'
import { getOverview } from '@/api/admin'
import type { AnyRow, OverviewData } from '@/api/types'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { formatDateTime } from '@/utils/format'

export function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getOverview()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError('')
        }
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

  const stats = data?.stats
  const maxUsers = Math.max(1, ...(data?.trend.map((item) => item.users) ?? [1]))
  const maxMinutes = Math.max(
    1,
    ...(data?.trend.map((item) => item.studyMinutes) ?? [1]),
  )

  const cards = [
    { label: '总用户数', value: stats?.users, icon: Users, tone: 'blue' },
    { label: '今日新增', value: stats?.usersToday, icon: UserPlus, tone: 'green' },
    { label: '近 7 日活跃', value: stats?.active7, icon: Activity, tone: 'purple' },
    { label: '课程数', value: stats?.courses, icon: BookOpen, tone: 'orange' },
    { label: '课时数', value: stats?.lessons, icon: BookOpen, tone: 'blue' },
    { label: '题目数', value: stats?.questions, icon: Code2, tone: 'purple' },
    { label: '提交总数', value: stats?.submissions, icon: Send, tone: 'green' },
    { label: '全站通过率', value: stats ? `${stats.passRate}%` : '-', icon: Activity, tone: 'orange' },
  ]

  return (
    <div className="page">
      <PageHeader
        title="数据概览"
        subtitle="只读数据 · 不会修改数据库中的任何内容"
      />

      {error ? <div className="alert">{error}</div> : null}

      <section className="stat-grid">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <article key={card.label} className={`stat-card tone-${card.tone}`}>
              <span className="stat-icon">
                <Icon size={19} />
              </span>
              <div>
                <span className="stat-label">{card.label}</span>
                <strong>{loading ? '…' : card.value ?? 0}</strong>
              </div>
            </article>
          )
        })}
      </section>

      <section className="panel-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>近 7 日新增用户</h2>
          </div>
          <div className="bar-chart">
            {(data?.trend ?? []).map((item) => (
              <div key={item.date} className="bar-column">
                <span className="bar-value">{item.users}</span>
                <div
                  className="bar users-bar"
                  style={{ height: `${Math.max(4, (item.users / maxUsers) * 120)}px` }}
                />
                <span className="bar-label">{item.date.slice(5)}</span>
              </div>
            ))}
            {loading && !data ? <p className="muted">加载中…</p> : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>近 7 日学习时长（分钟）</h2>
          </div>
          <div className="bar-chart">
            {(data?.trend ?? []).map((item) => (
              <div key={item.date} className="bar-column">
                <span className="bar-value">{item.studyMinutes}</span>
                <div
                  className="bar minutes-bar"
                  style={{
                    height: `${Math.max(4, (item.studyMinutes / maxMinutes) * 120)}px`,
                  }}
                />
                <span className="bar-label">{item.date.slice(5)}</span>
              </div>
            ))}
            {loading && !data ? <p className="muted">加载中…</p> : null}
          </div>
        </div>
      </section>

      <section className="panel-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>热门课程 Top 5</h2>
            <Link to="/courses" className="text-link">全部课程 →</Link>
          </div>
          <DataTable
            columns={[
              { key: 'title', label: '课程' },
              { key: 'category', label: '分类' },
              { key: 'lessonCount', label: '课时数', align: 'right' },
              { key: 'learnerCount', label: '学习人数', align: 'right' },
            ]}
            rows={(data?.topCourses ?? []) as unknown as AnyRow[]}
            loading={loading}
          />
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>最近注册用户</h2>
            <Link to="/users" className="text-link">全部用户 →</Link>
          </div>
          <DataTable
            columns={[
              {
                key: 'nickname',
                label: '用户',
                render: (row) => (
                  <Link className="text-link" to={`/users/${row.id}`}>
                    {String(row.nickname)}
                  </Link>
                ),
              },
              { key: 'level', label: '等级', align: 'right' },
              {
                key: 'createdAt',
                label: '注册时间',
                render: (row) => formatDateTime(row.createdAt),
              },
            ]}
            rows={(data?.recentUsers ?? []) as unknown as AnyRow[]}
            loading={loading}
          />
        </div>
      </section>
    </div>
  )
}
