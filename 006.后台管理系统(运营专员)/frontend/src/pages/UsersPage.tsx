import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { downloadExport, getUsers } from '@/api/admin'
import type { AnyRow, ListResult, UserRow } from '@/api/types'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/Badge'
import { formatDateTime } from '@/utils/format'

export function UsersPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResult<UserRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      getUsers({ keyword, status, start, end, page, pageSize: 20 })
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
  }, [keyword, status, start, end, page])

  const onExport = async () => {
    try {
      await downloadExport('users', { keyword, status, start, end })
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="用户管理"
        subtitle="查看系统注册用户与学习概况（手机号、邮箱已脱敏）"
        actions={
          <button type="button" className="secondary-button" onClick={onExport}>
            <Download size={15} /> 导出 CSV
          </button>
        }
      />

      {error ? <div className="alert">{error}</div> : null}

      <section className="filter-bar">
        <input
          className="filter-input"
          value={keyword}
          placeholder="搜索昵称 / 手机号 / 邮箱"
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="disabled">已禁用</option>
        </select>
        <label className="date-field">
          注册时间
          <input
            type="date"
            value={start}
            onChange={(event) => {
              setStart(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <span className="date-sep">至</span>
        <input
          type="date"
          value={end}
          onChange={(event) => {
            setEnd(event.target.value)
            setPage(1)
          }}
        />
      </section>

      <section className="panel">
        <DataTable
          columns={[
            { key: 'id', label: 'ID' },
            {
              key: 'nickname',
              label: '昵称',
              render: (row) => (
                <Link className="text-link" to={`/users/${row.id}`}>
                  {String(row.nickname)}
                </Link>
              ),
            },
            { key: 'phone', label: '手机号' },
            { key: 'email', label: '邮箱' },
            { key: 'level', label: '等级', align: 'center' },
            {
              key: 'status',
              label: '状态',
              render: (row) => <StatusBadge value={row.status} />,
            },
            {
              key: 'createdAt',
              label: '注册时间',
              render: (row) => formatDateTime(row.createdAt),
            },
            {
              key: 'lastLoginAt',
              label: '最后登录',
              render: (row) => formatDateTime(row.lastLoginAt),
            },
            {
              key: 'action',
              label: '操作',
              render: (row) => (
                <Link className="table-action" to={`/users/${row.id}`}>
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
