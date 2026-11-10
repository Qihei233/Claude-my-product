import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getUser } from '@/api/admin'
import type { AnyRow, UserDetailData } from '@/api/types'
import { Badge, StatusBadge } from '@/components/Badge'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import {
  formatDate,
  formatDateTime,
  statusLabels,
  text,
} from '@/utils/format'

function Section({
  title,
  columns,
  rows,
}: {
  title: string
  columns: { key: string; label: string; render?: (row: AnyRow) => ReactNode }[]
  rows: AnyRow[]
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      <DataTable columns={columns} rows={rows} emptyText="暂无数据" />
    </section>
  )
}

export function UserDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<UserDetailData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getUser(id)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) return <div className="alert">{error}</div>
  if (!data) return <div className="page">加载中…</div>

  const { user, summary } = data
  const summaryData = (summary ?? {}) as AnyRow

  return (
    <div className="page">
      <Link to="/users" className="back-link">
        <ArrowLeft size={15} /> 返回用户列表
      </Link>
      <PageHeader
        title={`${user.nickname}`}
        subtitle={`用户 ID ${user.id} · 注册于 ${formatDateTime(user.createdAt)}`}
        actions={<StatusBadge value={user.status} />}
      />

      <section className="info-grid">
        <div className="info-card">
          <span>等级 / 经验</span>
          <strong>Lv.{user.level} · {user.exp} EXP</strong>
        </div>
        <div className="info-card">
          <span>连续学习</span>
          <strong>{user.streakDays} 天</strong>
        </div>
        <div className="info-card">
          <span>累计学习</span>
          <strong>{user.studyMinutes} 分钟</strong>
        </div>
        <div className="info-card">
          <span>完成课时</span>
          <strong>{Number(summaryData.completed_lessons) || 0}</strong>
        </div>
        <div className="info-card">
          <span>通过题目</span>
          <strong>{Number(summaryData.passed_questions) || 0}</strong>
        </div>
        <div className="info-card">
          <span>完成课程</span>
          <strong>{Number(summaryData.completed_courses) || 0}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>基础资料</h2>
        </div>
        <div className="detail-list">
          <div><span>手机号</span><strong>{user.phone || '未绑定'}</strong></div>
          <div><span>邮箱</span><strong>{user.email || '未绑定'}</strong></div>
          <div><span>角色</span><strong>{user.role}</strong></div>
          <div><span>Python 基础</span><strong>{user.pythonBase}</strong></div>
          <div><span>最长连续</span><strong>{user.longestStreakDays} 天</strong></div>
          <div><span>每日目标</span><strong>{user.dailyGoalMinutes} 分钟</strong></div>
          <div><span>个人简介</span><strong>{user.bio || '—'}</strong></div>
          <div><span>引导完成</span><Badge tone={user.onboardingCompleted ? 'green' : 'gray'}>{user.onboardingCompleted ? '已完成' : '未完成'}</Badge></div>
          <div><span>最后登录</span><strong>{formatDateTime(user.lastLoginAt)}</strong></div>
        </div>
      </section>

      <div className="panel-grid">
        <Section
          title="课程报名"
          columns={[
            { key: 'title', label: '课程' },
            { key: 'status', label: '状态', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'progress_percent', label: '进度', render: (row) => `${Number(row.progress_percent)}%` },
            { key: 'enrolled_at', label: '报名时间', render: (row) => formatDateTime(row.enrolled_at) },
          ]}
          rows={data.enrollments}
        />
        <Section
          title="课时进度"
          columns={[
            { key: 'course_title', label: '课程' },
            { key: 'lesson_title', label: '课时' },
            { key: 'status', label: '状态', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'progress_percent', label: '进度', render: (row) => `${Number(row.progress_percent)}%` },
            { key: 'updated_at', label: '更新时间', render: (row) => formatDateTime(row.updated_at) },
          ]}
          rows={data.progress}
        />
      </div>

      <Section
        title="提交记录（最近 20 条）"
        columns={[
          { key: 'question_code', label: '题目编码' },
          { key: 'question_title', label: '题目' },
          { key: 'result', label: '结果', render: (row) => <StatusBadge value={row.result} /> },
          { key: 'passed_cases', label: '通过 / 总数', render: (row) => `${row.passed_cases}/${row.total_cases}` },
          { key: 'runtime_ms', label: '耗时(ms)' },
          { key: 'submitted_at', label: '提交时间', render: (row) => formatDateTime(row.submitted_at) },
        ]}
        rows={data.submissions}
      />

      <div className="panel-grid">
        <Section
          title="学习记录（最近 20 条）"
          columns={[
            {
              key: 'record_type',
              label: '类型',
              render: (row) => statusLabels[String(row.record_type)] || text(row.record_type),
            },
            {
              key: 'title',
              label: '内容',
              render: (row) => String(row.lesson_title || row.question_title || '-'),
            },
            { key: 'result', label: '结果', render: (row) => <StatusBadge value={row.result} /> },
            { key: 'created_at', label: '时间', render: (row) => formatDateTime(row.created_at) },
          ]}
          rows={data.records}
        />
        <Section
          title="每日统计（最近 30 天）"
          columns={[
            { key: 'stat_date', label: '日期', render: (row) => formatDate(row.stat_date) },
            { key: 'study_minutes', label: '学习分钟' },
            { key: 'lessons_completed', label: '完成课时' },
            { key: 'questions_passed', label: '通过题目' },
            { key: 'exp_earned', label: '获得经验' },
          ]}
          rows={data.dailyStats}
        />
      </div>

      <div className="panel-grid">
        <Section
          title="已获得成就"
          columns={[
            { key: 'name', label: '成就' },
            { key: 'description', label: '说明' },
            { key: 'unlocked_at', label: '获得时间', render: (row) => formatDateTime(row.unlocked_at) },
          ]}
          rows={data.achievements}
        />
        <Section
          title="兴趣与掌握度"
          columns={[
            { key: 'knowledge_point_name', label: '知识点' },
            { key: 'score', label: '掌握度', render: (row) => `${Math.round(Number(row.score) * 100)}%` },
            { key: 'attempts', label: '尝试次数' },
            { key: 'correct_count', label: '正确次数' },
          ]}
          rows={data.mastery}
        />
      </div>

      <div className="panel-grid">
        <Section
          title="最近消息"
          columns={[
            { key: 'title', label: '标题' },
            { key: 'message_type', label: '类型', render: (row) => statusLabels[String(row.message_type)] || text(row.message_type) },
            { key: 'is_read', label: '已读', render: (row) => (row.is_read ? '是' : '否') },
            { key: 'created_at', label: '时间', render: (row) => formatDateTime(row.created_at) },
          ]}
          rows={data.messages}
        />
        <Section
          title="最近收藏"
          columns={[
            { key: 'target_type', label: '类型', render: (row) => statusLabels[String(row.target_type)] || text(row.target_type) },
            {
              key: 'target',
              label: '内容',
              render: (row) => String(row.course_title || row.question_title || '-'),
            },
            { key: 'created_at', label: '收藏时间', render: (row) => formatDateTime(row.created_at) },
          ]}
          rows={data.favorites}
        />
      </div>
    </div>
  )
}
