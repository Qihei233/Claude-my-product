import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getQuestion } from '@/api/admin'
import type { AnyRow, QuestionDetailData } from '@/api/types'
import { Badge, StatusBadge } from '@/components/Badge'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { difficultyLabel, formatDateTime } from '@/utils/format'

function renderHints(hints: unknown) {
  if (Array.isArray(hints)) return hints.join('\n')
  if (typeof hints === 'string') {
    try {
      const parsed = JSON.parse(hints)
      return Array.isArray(parsed) ? parsed.join('\n') : hints
    } catch {
      return hints
    }
  }
  return '-'
}

export function QuestionDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<QuestionDetailData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getQuestion(id)
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

  const { question } = data

  return (
    <div className="page">
      <Link to="/questions" className="back-link">
        <ArrowLeft size={15} /> 返回题库
      </Link>
      <PageHeader
        title={`${question.question_code} ${question.title}`}
        subtitle={`创建于 ${formatDateTime(question.created_at)}`}
        actions={
          <div className="badge-row">
            <Badge tone="amber">{difficultyLabel(question.difficulty)}</Badge>
            <StatusBadge value={question.status} />
          </div>
        }
      />

      <section className="panel">
        <div className="panel-head"><h2>题目描述</h2></div>
        <p className="panel-text">{question.description}</p>
        <div className="code-pair">
          <div>
            <span className="code-label">样例输入</span>
            <pre>{question.sample_input || '无'}</pre>
          </div>
          <div>
            <span className="code-label">期望输出</span>
            <pre>{question.sample_output || '无'}</pre>
          </div>
        </div>
      </section>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-head"><h2>初始代码</h2></div>
          <pre className="code-block">{question.initial_code || '（空）'}</pre>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>参考题解</h2></div>
          <pre className="code-block">{question.solution || '（空）'}</pre>
        </section>
      </div>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-head"><h2>提示</h2></div>
          <pre className="code-block">{renderHints(question.hints)}</pre>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>知识点</h2></div>
          <div className="tag-row">
            {data.knowledgePoints.length ? (
              data.knowledgePoints.map((item) => (
                <Badge key={item.id} tone="blue">{item.name}</Badge>
              ))
            ) : (
              <span className="muted">暂无关联知识点</span>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>测试用例</h2></div>
        <DataTable
          columns={[
            { key: 'sort_order', label: '序号' },
            { key: 'is_sample', label: '样例', render: (row) => (row.is_sample ? '是' : '否') },
            {
              key: 'input_text',
              label: '输入',
              render: (row) => <pre className="inline-code">{String(row.input_text)}</pre>,
            },
            {
              key: 'expected_output',
              label: '期望输出',
              render: (row) => <pre className="inline-code">{String(row.expected_output)}</pre>,
            },
          ]}
          rows={data.testCases as unknown as AnyRow[]}
        />
      </section>
    </div>
  )
}
