import { apiBase, request } from './client'
import type {
  AnyRow,
  CourseDetailData,
  CourseRow,
  ListResult,
  OverviewData,
  QuestionDetailData,
  QuestionRow,
  UserDetailData,
  UserRow,
} from './types'

function qs(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value))
    }
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function login(username: string, password: string) {
  return request<{
    token: string
    admin: { username: string; role: string }
    expiresIn: number
  }>(
    '/api/admin/login',
    { method: 'POST', body: JSON.stringify({ username, password }) },
    false,
  )
}

export function getOverview() {
  return request<OverviewData>('/api/admin/overview')
}

export function getUsers(params: Record<string, unknown> = {}) {
  return request<ListResult<UserRow>>(`/api/admin/users${qs(params)}`)
}

export function getUser(id: string) {
  return request<UserDetailData>(`/api/admin/users/${id}`)
}

export function getCourses(params: Record<string, unknown> = {}) {
  return request<ListResult<CourseRow>>(`/api/admin/courses${qs(params)}`)
}

export function getCourse(id: string) {
  return request<CourseDetailData>(`/api/admin/courses/${id}`)
}

export function getQuestions(params: Record<string, unknown> = {}) {
  return request<ListResult<QuestionRow>>(`/api/admin/questions${qs(params)}`)
}

export function getQuestion(id: string) {
  return request<QuestionDetailData>(`/api/admin/questions/${id}`)
}

export function getRecords(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/records${qs(params)}`)
}

export function getSubmissions(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/submissions${qs(params)}`)
}

export function getProgress(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/progress${qs(params)}`)
}

export function getDailyStats(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/daily-stats${qs(params)}`)
}

export function getMastery(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/mastery${qs(params)}`)
}

export function getLeaderboard() {
  return request<AnyRow[]>('/api/admin/leaderboard')
}

export function getMessages(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/messages${qs(params)}`)
}

export function getFavorites(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/favorites${qs(params)}`)
}

export function getRecommendations(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(
    `/api/admin/recommendations${qs(params)}`,
  )
}

export function getReports(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/reports${qs(params)}`)
}

export function getDailyQuestions(params: Record<string, unknown> = {}) {
  return request<ListResult<AnyRow>>(`/api/admin/daily-questions${qs(params)}`)
}

export async function downloadExport(type: string, params: Record<string, unknown> = {}) {
  const token = sessionStorage.getItem('naiwa_admin_token')
  const response = await fetch(
    `${apiBase()}/api/admin/export/${type}${qs(params)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  )
  if (!response.ok) {
    let message = '导出失败'
    try {
      const payload = (await response.json()) as { message?: string }
      message = payload.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] || `${type}.csv`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
