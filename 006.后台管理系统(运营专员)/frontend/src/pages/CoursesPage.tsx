import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCourses } from '@/api/admin'
import type { AnyRow, CourseRow, ListResult } from '@/api/types'
import { Badge, StatusBadge } from '@/components/Badge'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { difficultyLabel } from '@/utils/format'

export function CoursesPage() {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResult<CourseRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      getCourses({ keyword, category, difficulty, page, pageSize: 20 })
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
  }, [keyword, category, difficulty, page])

  return (
    <div className="page">
      <PageHeader
        title="课程管理"
        subtitle="查看课程、学习人数与课时结构（只读）"
      />

      {error ? <div className="alert">{error}</div> : null}

      <section className="filter-bar">
        <input
          className="filter-input"
          value={keyword}
          placeholder="搜索课程名称或编码"
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
        />
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value)
            setPage(1)
          }}
        >
          <option value="">全部分类</option>
          <option value="基础语法">基础语法</option>
          <option value="办公自动化">办公自动化</option>
          <option value="数据分析">数据分析</option>
          <option value="趣味编程">趣味编程</option>
        </select>
        <select
          value={difficulty}
          onChange={(event) => {
            setDifficulty(event.target.value)
            setPage(1)
          }}
        >
          <option value="">全部难度</option>
          <option value="beginner">入门</option>
          <option value="intermediate">进阶</option>
          <option value="challenge">挑战</option>
        </select>
      </section>

      <section className="panel">
        <DataTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'courseCode', label: '课程编码' },
            {
              key: 'title',
              label: '课程',
              render: (row) => (
                <Link className="text-link" to={`/courses/${row.id}`}>
                  {String(row.title)}
                </Link>
              ),
            },
            { key: 'category', label: '分类' },
            {
              key: 'difficulty',
              label: '难度',
              render: (row) => (
                <Badge tone="blue">{difficultyLabel(row.difficulty)}</Badge>
              ),
            },
            { key: 'rating', label: '评分', align: 'right' },
            { key: 'learnerCount', label: '学习人数', align: 'right' },
            { key: 'lessonCount', label: '课时数', align: 'right' },
            {
              key: 'status',
              label: '状态',
              render: (row) => <StatusBadge value={row.status} />,
            },
            {
              key: 'action',
              label: '操作',
              render: (row) => (
                <Link className="table-action" to={`/courses/${row.id}`}>
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
