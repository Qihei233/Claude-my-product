import { request } from './auth'
import type {
  Achievement,
  Course,
  LearningRecord,
  LeaderboardEntry,
  LessonType,
  Message,
  Problem,
  User,
  UserPreferences,
} from '@/types'

export interface CompletionResult {
  alreadyCompleted: boolean
  expGained: number
  nextLessonId?: string
  courseCompleted: boolean
}

export interface ProblemResultInfo {
  firstPass: boolean
  stars: number
  expGained: number
  attempts: number
}

export interface StartCourseResult {
  courseId: string
  firstLessonId: string
  currentLessonId: string
  progressPercent: number
}

export interface LessonDetailData {
  lesson: {
    id: string
    chapterId: string
    title: string
    type: LessonType
    order: number
    durationMinutes: number
    difficulty: number
  }
  course: { id: string; title: string }
  chapter: { id: string; title: string }
  content: {
    intro: string
    sections: { title: string; body?: string; code?: string }[]
    task: string
    goal: string
    hint: string
    initialCode: string
    estimatedMinutes: number
  }
  progress: { status: string; progressPercent: number }
}

export interface TestCase {
  id: number
  input_text: string
  expected_output: string
  is_sample: number
  sort_order: number
}

export interface ProblemDetailData extends Problem {
  testCases?: TestCase[]
}

export interface RankingData {
  leaderboard: LeaderboardEntry[]
  currentUserRank: LeaderboardEntry | null
  total: number
}

export interface JudgeRunResult {
  status: 'success' | 'error'
  output: string
  error: string
  expected: string | null
  passed: boolean
  durationMs: number
  friendlyError: string
}

export interface JudgeCaseResult {
  input: string
  expected: string
  output: string
  error: string
  passed: boolean
  isSample?: boolean
}

export interface JudgeResult {
  accepted: boolean
  passedCases: number
  totalCases: number
  output: string
  expected: string | null
  error: string
  friendlyError: string
  durationMs: number
  results: JudgeCaseResult[]
  firstFailed?: JudgeCaseResult | null
}

export interface SubmitProblemResult extends ProblemResultInfo, JudgeResult {
  attempts: number
}

export function runProblemApi(problemId: string, code: string) {
  return request<JudgeRunResult>(
    `/api/content/problems/${encodeURIComponent(problemId)}/run`,
    { method: 'POST', body: JSON.stringify({ code }) },
  )
}

export function runLessonApi(lessonId: string, code: string) {
  return request<JudgeResult>(
    `/api/content/lessons/${encodeURIComponent(lessonId)}/run`,
    { method: 'POST', body: JSON.stringify({ code }) },
  )
}

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
).replace(/\/+$/, '')

export function assetUrl(value?: string | null) {
  if (!value) return null
  if (/^https?:\/\//.test(value)) return value
  return `${API_BASE}${value}`
}

export function uploadAvatarApi(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return request<User>('/api/me/avatar', { method: 'POST', body: form })
}

export function fetchMyState() {
  return request<User>('/api/me/state')
}

export function checkReminderApi() {
  return request<{ created: boolean }>('/api/me/reminder-check', {
    method: 'POST',
    body: '{}',
  })
}

export function fetchCourses() {
  return request<Course[]>('/api/content/courses')
}

export function fetchCourse(courseId: string) {
  return request<Course>(`/api/content/courses/${encodeURIComponent(courseId)}`)
}

export function fetchProblems() {
  return request<Problem[]>('/api/content/problems')
}

export function fetchProblem(problemId: string) {
  return request<ProblemDetailData>(
    `/api/content/problems/${encodeURIComponent(problemId)}`,
  )
}

export function fetchDailyQuestion() {
  return request<ProblemDetailData>('/api/content/daily-question')
}

export function fetchLesson(lessonId: string) {
  return request<LessonDetailData>(
    `/api/content/lessons/${encodeURIComponent(lessonId)}`,
  )
}

export function fetchRanking() {
  return request<RankingData>('/api/content/ranking')
}

export function startCourseApi(courseId: string) {
  return request<StartCourseResult>(
    `/api/me/courses/${encodeURIComponent(courseId)}/start`,
    { method: 'POST', body: '{}' },
  )
}

export function completeLessonApi(lessonId: string, code = '') {
  return request<CompletionResult>(
    `/api/me/lessons/${encodeURIComponent(lessonId)}/complete`,
    { method: 'POST', body: JSON.stringify({ code }) },
  )
}

export function submitProblemApi(
  problemId: string,
  input: { code: string; usedHint?: boolean },
) {
  return request<SubmitProblemResult>(
    `/api/me/problems/${encodeURIComponent(problemId)}/attempt`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function toggleFavoriteApi(
  targetType: 'course' | 'question' | 'lesson',
  targetId: string,
) {
  return request<{ added: boolean; targetType: string; targetId: string }>(
    '/api/me/favorites/toggle',
    { method: 'POST', body: JSON.stringify({ targetType, targetId }) },
  )
}

export function markMessageReadApi(messageId: string) {
  return request<{ messageId: string }>(
    `/api/me/messages/${encodeURIComponent(messageId)}/read`,
    { method: 'POST', body: '{}' },
  )
}

export function markAllMessagesReadApi() {
  return request<{ allRead: boolean }>('/api/me/messages/read-all', {
    method: 'POST',
    body: '{}',
  })
}

export function updateProfileApi(input: {
  nickname: string
  bio: string
  goals: string[]
}) {
  return request<User>('/api/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function updatePreferencesApi(patch: Partial<UserPreferences>) {
  return request<User>('/api/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function completeOnboardingApi(input: {
  pythonBase: 'zero' | 'basic'
  goals: string[]
  dailyGoalMinutes?: number
}) {
  return request<User>('/api/me/onboarding', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function changePasswordApi(input: {
  currentPassword: string
  newPassword: string
}) {
  return request<{ ok: boolean }>('/api/me/password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updatePhoneApi(input: { phone: string; code: string }) {
  return request<User>('/api/me/phone', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchRecords(type?: 'lesson' | 'question') {
  const query = type ? `?limit=100&type=${type}` : '?limit=100'
  return request<LearningRecord[]>(`/api/me/records${query}`)
}

export function fetchMessages() {
  return request<Message[]>('/api/me/messages')
}

export function fetchAchievements() {
  return request<Achievement[]>('/api/me/achievements')
}
