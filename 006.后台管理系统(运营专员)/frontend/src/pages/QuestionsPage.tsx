import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getQuestions } from '@/api/admin'
import type { AnyRow, ListResult, QuestionRow } from '@/api/types'
import { Badge, StatusBadge } from '@/components/Badge'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { difficultyLabel } from '@/utils/format'

export function QuestionsPage() {
  const [keyword, setKeyword] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResult<QuestionRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      getQuestions({ keyword, difficulty, status, page, pageSize: 20 })
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
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [keyword, difficulty, status, page])

  return (
    <div className="page">
      <PageHeader title="题库管理" subtitle="查看题目、测试用例与通过率（只读）" />
      {error ? <div className="alert">{error}</div> : null}

      <section className="filter-bar">
        <input
          className="filter-input"
          value={keyword}
          placeholder="搜索题目名称或编码"
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
        />
        <select
          value={difficulty}
          onChange={(event) => {
            setDifficulty(event.target.value)
            setPage(1)
          }}
        >
          <option value="">全部难度</option>
          <option value="1">难度 1</option>
          <option value="2">难度 2</option>
          <option value="3">难度 3</option>
          <option value="4">难度 4</option>
          <option value="5">难度 5</option>
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
      </section>

      <section className="panel">
        <DataTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'code', label: '题目编码' },
            {
              key: 'title',
              label: '题目',
              render: (row) => (
                <Link className="text-link" to={`/questions/${row.id}`}>
                  {String(row.title)}
                </Link>
              ),
            },
            {
              key: 'difficulty',
              label: '难度',
              render: (row) => (
                <Badge tone="amber">{difficultyLabel(row.difficulty)}</Badge>
              ),
            },
            { key: 'attempts', label: '提交次数', align: 'right' },
            { key: 'accepted', label: '通过次数', align: 'right' },
            { key: 'passRate', label: '通过率', align: 'right', render: (row) => `${row.passRate}%` },
            {
              key: 'status',
              label: '状态',
              render: (row) => <StatusBadge value={row.status} />,
            },
            {
              key: 'action',
              label: '操作',
              render: (row) => (
                <Link className="table-action" to={`/questions/${row.id}`}>
                  详情
                </Link>
              ),
            },
          ]}
          rows={(data?.list ?? []) as unknown as AnyRow[]}
          loading={loading}
        />
        {data ? (
          <Pagination
            page={page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={setPage}
          />
        ) : null}
      </section>
    </div>
  )
}
