export interface ListResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface OverviewData {
  stats: {
    users: number
    usersToday: number
    active7: number
    courses: number
    lessons: number
    questions: number
    submissions: number
    submissionsToday: number
    passRate: number
  }
  trend: { date: string; users: number; studyMinutes: number }[]
  topCourses: {
    id: string
    courseCode: string
    title: string
    category: string
    learnerCount: number
    lessonCount: number
  }[]
  recentUsers: UserRow[]
}

export interface UserRow {
  id: string
  nickname: string
  phone: string | null
  email: string | null
  role: string
  status: string
  level: number
  exp: number
  streakDays: number
  studyMinutes: number
  onboardingCompleted: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface UserDetailData {
  user: UserRow & {
    pythonBase: string
    longestStreakDays: number
    dailyGoalMinutes: number
    bio: string
    preferences: Record<string, unknown>
  }
  summary: Record<string, unknown> | null
  enrollments: Record<string, unknown>[]
  progress: Record<string, unknown>[]
  submissions: Record<string, unknown>[]
  records: Record<string, unknown>[]
  dailyStats: Record<string, unknown>[]
  achievements: Record<string, unknown>[]
  interests: Record<string, unknown>[]
  mastery: Record<string, unknown>[]
  messages: Record<string, unknown>[]
  favorites: Record<string, unknown>[]
}

export interface CourseRow {
  id: string
  courseCode: string
  title: string
  category: string
  difficulty: string
  rating: number
  learnerCount: number
  lessonCount: number
  durationMinutes: number
  status: string
  createdAt: string
}

export interface CourseDetailData {
  course: CourseRow & {
    description: string
    isFree: boolean
  }
  chapters: {
    id: string
    title: string
    lessons: {
      id: string
      code: string
      title: string
      type: string
      durationMinutes: number
      difficulty: number
      status: string
    }[]
  }[]
  knowledgePoints: {
    id: number
    name: string
    description: string
    difficulty: number
  }[]
  linkedQuestions: {
    id: number
    question_code: string
    title: string
    difficulty: number
  }[]
}

export interface QuestionRow {
  id: string
  code: string
  title: string
  difficulty: number
  status: string
  attempts: number
  accepted: number
  passRate: number
}

export interface QuestionDetailData {
  question: {
    id: number
    question_code: string
    title: string
    description: string
    difficulty: number
    sample_input: string
    sample_output: string
    initial_code: string
    hints: unknown
    solution: string
    status: string
    created_at: string
  }
  testCases: {
    id: number
    input_text: string
    expected_output: string
    is_sample: number
    sort_order: number
  }[]
  knowledgePoints: { id: number; name: string }[]
}

export type AnyRow = Record<string, unknown>
