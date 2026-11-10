import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCourses, fetchProblems } from '@/api/app'
import type { Course, Problem } from '@/types'

interface CatalogContextValue {
  courses: Course[]
  problems: Problem[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getCourse: (courseId: string | undefined) => Course | undefined
  getProblem: (problemId: string | undefined) => Problem | undefined
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [courseList, problemList] = await Promise.all([
        fetchCourses(),
        fetchProblems(),
      ])
      setCourses(courseList)
      setProblems(problemList)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '课程与题库加载失败，请稍后重试',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<CatalogContextValue>(
    () => ({
      courses,
      problems,
      loading,
      error,
      refresh,
      getCourse: (courseId) =>
        courseId ? courses.find((course) => course.id === courseId) : undefined,
      getProblem: (problemId) =>
        problemId
          ? problems.find((problem) => problem.id === problemId)
          : undefined,
    }),
    [courses, problems, loading, error, refresh],
  )

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  )
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalog must be used within CatalogProvider')
  return context
}

/** 把课程按章节顺序摊平成课时列表。 */
export function flattenCourseLessons(course: Course | undefined) {
  if (!course) return []
  return course.chapters.flatMap((chapter) => chapter.lessons)
}

/** 找到某节课的上一节 / 下一节。 */
export function findAdjacentLessons(
  course: Course | undefined,
  lessonId: string | undefined,
) {
  const lessons = flattenCourseLessons(course)
  const index = lessons.findIndex((lesson) => lesson.id === lessonId)
  return {
    lessons,
    index,
    previous: index > 0 ? lessons[index - 1] : undefined,
    next: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : undefined,
  }
}
