import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { downloadExport } from '@/api/admin'
import type { AnyRow, ListResult } from '@/api/types'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'

export interface FilterDef {
  name: string
  label: string
  options: { value: string; label: string }[]
}

export interface ListConfig {
  title: string
  subtitle?: string
  fetcher: (params: Record<string, unknown>) => Promise<ListResult<AnyRow>>
  columns: Column[]
  filters?: FilterDef[]
  keywordPlaceholder?: string
  exportType?: string
}

export function ListPage({ config }: { config: ListConfig }) {
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResult<AnyRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      config
        .fetcher({ keyword, ...filters, page, pageSize: 20 })
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
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [config, keyword, filters, page])

  const onExport = async () => {
    if (!config.exportType) return
    try {
      await downloadExport(config.exportType, { keyword, ...filters })
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          config.exportType ? (
            <button type="button" className="secondary-button" onClick={onExport}>
              <Download size={15} /> 导出 CSV
            </button>
          ) : undefined
        }
      />

      {error ? <div className="alert">{error}</div> : null}

      <section className="filter-bar">
        <input
          className="filter-input"
          value={keyword}
          placeholder={config.keywordPlaceholder || '搜索关键词'}
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
        />
        {(config.filters ?? []).map((filter) => (
          <select
            key={filter.name}
            value={filters[filter.name] || ''}
            aria-label={filter.label}
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                [filter.name]: event.target.value,
              }))
              setPage(1)
            }}
          >
            <option value="">{filter.label}（全部）</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
      </section>

      <section className="panel">
        <DataTable
          columns={config.columns}
          rows={data?.list ?? []}
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
