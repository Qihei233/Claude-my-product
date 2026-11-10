interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pages: number[] = []
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)
  for (let index = start; index <= end; index += 1) pages.push(index)

  return (
    <div className="pagination">
      <span className="pagination-total">共 {total} 条 · 第 {page}/{totalPages} 页</span>
      <div className="pagination-buttons">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          上一页
        </button>
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            className={item === page ? 'is-active' : ''}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  )
}
