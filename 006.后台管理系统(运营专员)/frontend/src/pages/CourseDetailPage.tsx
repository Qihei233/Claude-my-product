import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getCourse } from '@/api/admin'
import type { AnyRow, CourseDetailData } from '@/api/types'
import { Badge, StatusBadge } from '@/components/Badge'
import { DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { difficultyLabel } from '@/utils/format'

export function CourseDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<CourseDetailData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getCourse(id)
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

  return (
    <div className="page">
      <Link to="/courses" className="back-link">
        <ArrowLeft size={15} /> 返回课程列表
      </Link>
      <PageHeader
        title={data.course.title}
        subtitle={`${data.course.courseCode} · ${data.course.category}`}
        actions={<StatusBadge value={data.course.status} />}
      />

      <section className="info-grid">
        <div className="info-card"><span>难度</span><strong>{difficultyLabel(data.course.difficulty)}</strong></div>
        <div className="info-card"><span>评分</span><strong>{data.course.rating}</strong></div>
        <div className="info-card"><span>学习人数</span><strong>{data.course.learnerCount}</strong></div>
        <div className="info-card"><span>课时数</span><strong>{data.course.lessonCount}</strong></div>
        <div className="info-card"><span>总时长</span><strong>{data.course.durationMinutes} 分钟</strong></div>
        <div className="info-card"><span>是否免费</span><strong>{data.course.isFree ? '免费' : '付费'}</strong></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>课程介绍</h2></div>
        <p className="panel-text">{data.course.description}</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>章节与课时</h2></div>
        <div className="chapter-list">
          {data.chapters.map((chapter) => (
            <div key={chapter.id} className="chapter-block">
              <h3>{chapter.title}</h3>
              <ul>
                {chapter.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <span className="lesson-code">{lesson.code}</span>
                    <span className="lesson-title">{lesson.title}</span>
                    <Badge tone={lesson.type === 'practice' ? 'amber' : 'blue'}>
                      {lesson.type === 'practice' ? '练习' : '理论'}
                    </Badge>
                    <span className="lesson-meta">{lesson.durationMinutes} 分钟</span>
                    <span className="lesson-meta">难度 {difficultyLabel(lesson.difficulty)}</span>
                    <StatusBadge value={lesson.status} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-head"><h2>知识点</h2></div>
          <DataTable
            columns={[
              { key: 'name', label: '知识点' },
              { key: 'description', label: '说明' },
              { key: 'difficulty', label: '难度', render: (row) => difficultyLabel(row.difficulty) },
            ]}
            rows={data.knowledgePoints as unknown as AnyRow[]}
          />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>关联题目</h2></div>
          <DataTable
            columns={[
              {
                key: 'question_code',
                label: '题目编码',
                render: (row) => (
                  <Link className="text-link" to={`/questions/${row.id}`}>
                    {String(row.question_code)}
                  </Link>
                ),
              },
              { key: 'title', label: '题目' },
              { key: 'difficulty', label: '难度', render: (row) => difficultyLabel(row.difficulty) },
            ]}
            rows={data.linkedQuestions as unknown as AnyRow[]}
          />
        </section>
      </div>
    </div>
  )
}
