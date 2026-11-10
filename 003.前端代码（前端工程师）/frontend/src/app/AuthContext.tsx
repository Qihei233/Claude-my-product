import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useState } from 'react'
import {
  DEMO_SESSION_TOKEN,
  login as apiLogin,
  loginByCode as apiLoginByCode,
  logout as apiLogout,
  register as apiRegister,
  type ApiUser,
} from '@/api/auth'
import {
  changePasswordApi,
  checkReminderApi,
  completeLessonApi,
  completeOnboardingApi,
  fetchMyState,
  markAllMessagesReadApi,
  markMessageReadApi,
  startCourseApi,
  submitProblemApi,
  toggleFavoriteApi,
  updatePhoneApi,
  updatePreferencesApi,
  updateProfileApi,
  uploadAvatarApi,
} from '@/api/app'
import { flattenLessons, getCourse } from '@/data/courses'
import {
  createDemoUser,
  createNewUser,
  defaultPreferences,
  messages,
} from '@/data/mockData'
import type { GoalKey, User, UserPreferences } from '@/types'
import { formatDate } from '@/utils/date'
import { executePython, isProblemSolution } from '@/utils/pythonSimulator'
import { removeStorage, STORAGE_KEYS, readStorage, writeStorage } from '@/utils/storage'

interface CompletionResult {
  alreadyCompleted: boolean
  expGained: number
  nextLessonId?: string
  courseCompleted: boolean
}

interface ProblemResultInfo {
  firstPass: boolean
  stars: number
  expGained: number
  attempts?: number
  accepted?: boolean
  output?: string
  expected?: string | null
  error?: string
  friendlyError?: string
  passedCases?: number
  totalCases?: number
  durationMs?: number
}

export interface RegisterInput {
  accountType: 'phone' | 'email'
  account: string
  code: string
  password: string
}

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  login: (account: string, password: string, rememberMe?: boolean) => Promise<void>
  loginByCode: (
    accountType: 'phone' | 'email',
    account: string,
    code: string,
  ) => Promise<void>
  loginDemo: () => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (profile: {
    nickname: string
    bio: string
    goals: GoalKey[]
  }) => Promise<void>
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>
  completeLesson: (
    courseId: string,
    lessonId: string,
    code?: string,
  ) => Promise<CompletionResult>
  recordProblemResult: (
    problemId: string,
    code: string,
    usedHint?: boolean,
  ) => Promise<ProblemResultInfo>
  toggleFavoriteCourse: (courseId: string) => Promise<boolean>
  toggleFavoriteProblem: (problemId: string) => Promise<boolean>
  markMessageRead: (messageId: string) => Promise<void>
  markAllMessagesRead: () => Promise<void>
  startCourse: (courseId: string) => Promise<string | undefined>
  completeOnboarding: (input: {
    pythonBase: 'zero' | 'basic'
    goals: GoalKey[]
    dailyGoalMinutes?: number
  }) => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>
  changePhone: (phone: string, code: string) => Promise<void>
  changeAvatar: (file: File) => Promise<void>
  refreshState: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): User | null {
  const stored = readStorage<User>(STORAGE_KEYS.user)
  if (!stored?.id) return null
  return {
    ...stored,
    preferences: { ...defaultPreferences, ...stored.preferences },
  }
}

function isDemoSession(): boolean {
  return readStorage<string>(STORAGE_KEYS.token) === DEMO_SESSION_TOKEN
}

function userFromApi(apiUser: ApiUser, previous: User | null): User {
  const base =
    previous && previous.id === apiUser.userId
      ? previous
      : createNewUser(apiUser.nickname)

  return {
    ...base,
    id: apiUser.userId,
    nickname: apiUser.nickname,
    initials: apiUser.nickname.trim().slice(0, 1) || '蛙',
    exp: previous && previous.id === apiUser.userId ? previous.exp : apiUser.exp,
    streakDays:
      previous && previous.id === apiUser.userId
        ? previous.streakDays
        : apiUser.streakDays,
    level: apiUser.level,
    dailyGoalMinutes: apiUser.dailyGoalMinutes,
    onboardingCompleted: apiUser.onboardingCompleted,
  }
}

function completeLessonLocally(
  user: User,
  courseId: string,
  lessonId: string,
): CompletionResult {
  const course = getCourse(courseId)
  if (!course) {
    return { alreadyCompleted: false, expGained: 0, courseCompleted: false }
  }
  const lessons = flattenLessons(course)
  const currentLessonIndex = lessons.findIndex((lesson) => lesson.id === lessonId)
  const existing = user.courseProgress[courseId]
  const completed = new Set(existing?.completedLessons ?? [])
  const alreadyCompleted = completed.has(lessonId)
  if (alreadyCompleted) {
    const next = lessons[currentLessonIndex + 1]
    return {
      alreadyCompleted: true,
      expGained: 0,
      nextLessonId: next?.id,
      courseCompleted: user.completedCourses.includes(courseId),
    }
  }

  completed.add(lessonId)
  const next = lessons[currentLessonIndex + 1]
  const completedAll = lessons.every((lesson) => completed.has(lesson.id))
  const today = formatDate(new Date())
  const chapter = course.chapters.find(
    (item) => item.id === lessons[currentLessonIndex]?.chapterId,
  )
  const chapterCompleted =
    chapter?.lessons.every((lesson) => completed.has(lesson.id)) ?? false
  const achievements = { ...user.achievements }
  if (!achievements['first-code']) achievements['first-code'] = today
  if (!achievements['first-steps']) achievements['first-steps'] = today
  if (chapterCompleted && !achievements['chapter-clear']) {
    achievements['chapter-clear'] = today
  }
  if (completedAll && !achievements['course-graduate']) {
    achievements['course-graduate'] = today
  }

  user.exp += 20
  user.hoursLearned = Number((user.hoursLearned + 0.2).toFixed(1))
  user.completedLessonCount += 1
  user.courseProgress = {
    ...user.courseProgress,
    [courseId]: {
      completedLessons: [...completed],
      currentLessonId: next?.id ?? lessonId,
    },
  }
  if (completedAll) {
    user.completedCourses = Array.from(new Set([...user.completedCourses, courseId]))
  }
  user.achievements = achievements

  return {
    alreadyCompleted: false,
    expGained: 20,
    nextLessonId: next?.id,
    courseCompleted: completedAll,
  }
}

function recordProblemLocally(
  user: User,
  problemId: string,
  passed: boolean,
  usedHint = false,
): ProblemResultInfo {
  const previous = user.problemResults[problemId]
  const attempts = (previous?.attempts ?? 0) + 1
  const firstPass = passed && !previous?.stars
  const earnedStars = passed
    ? previous?.stars && previous.stars > 0
      ? previous.stars
      : attempts === 1
        ? 3
        : usedHint
          ? 1
          : 2
    : (previous?.stars ?? 0)
  const stars = earnedStars
  const achievements = { ...user.achievements }
  if (stars === 3 && !achievements['one-shot']) {
    achievements['one-shot'] = formatDate(new Date())
  }
  user.exp += firstPass ? 30 : 0
  user.passedProblemCount += firstPass ? 1 : 0
  user.problemResults = {
    ...user.problemResults,
    [problemId]: { attempts, stars },
  }
  user.achievements = achievements
  return { firstPass, stars, expGained: firstPass ? 30 : 0 }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser)

  useEffect(() => {
    if (user) writeStorage(STORAGE_KEYS.user, user)
    else removeStorage(STORAGE_KEYS.user)
  }, [user])

  const refreshState = useCallback(async () => {
    if (isDemoSession()) return
    const token = readStorage<string>(STORAGE_KEYS.token)
    if (!token) return
    const state = await fetchMyState()
    setUser(state)
  }, [])

  // 刷新页面时用真实 token 恢复完整用户状态
  useEffect(() => {
    const token = readStorage<string>(STORAGE_KEYS.token)
    if (!token || token === DEMO_SESSION_TOKEN) return

    let cancelled = false
    fetchMyState()
      .then((state) => {
        if (!cancelled) setUser(state)
      })
      .catch(() => {
        if (!cancelled) {
          removeStorage(STORAGE_KEYS.token)
          setUser(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  // 站内学习提醒：每次会话检查一次，条件满足时由后端创建提醒消息。
  useEffect(() => {
    if (!user || isDemoSession()) return
    if (sessionStorage.getItem('naiwa_reminder_checked')) return
    sessionStorage.setItem('naiwa_reminder_checked', '1')
    checkReminderApi()
      .then((result) => {
        if (result.created) void refreshState()
      })
      .catch(() => {
        // 提醒属于增强功能，失败时静默处理
      })
  }, [user?.id, refreshState])

  const finishLogin = useCallback(async (nextUser: User, token: string) => {
    writeStorage(STORAGE_KEYS.token, token)
    setUser(nextUser)
    if (token !== DEMO_SESSION_TOKEN) {
      try {
        const state = await fetchMyState()
        setUser(state)
      } catch {
        // 基础用户信息仍然可用，后续操作会再次提示错误
      }
    }
  }, [])

  const login = useCallback(
    async (account: string, password: string, rememberMe = false) => {
      const result = await apiLogin({ account, password, rememberMe })
      await finishLogin(userFromApi(result.user, user), result.token)
    },
    [finishLogin, user],
  )

  const loginByCode = useCallback(
    async (accountType: 'phone' | 'email', account: string, code: string) => {
      const result = await apiLoginByCode({ accountType, account, code })
      await finishLogin(userFromApi(result.user, user), result.token)
    },
    [finishLogin, user],
  )

  const loginDemo = useCallback(async () => {
    await finishLogin(createDemoUser(), DEMO_SESSION_TOKEN)
  }, [finishLogin])

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await apiRegister(input)
      await finishLogin(userFromApi(result.user, null), result.token)
    },
    [finishLogin],
  )

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // 后端不可用时也要清除本地登录态
    }
    removeStorage(STORAGE_KEYS.token)
    sessionStorage.removeItem('naiwa_reminder_checked')
    sessionStorage.removeItem('naiwa_default_home_done')
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async ({
      nickname,
      bio,
      goals,
    }: {
      nickname: string
      bio: string
      goals: GoalKey[]
    }) => {
      if (isDemoSession()) {
        setUser((current) =>
          current
            ? {
                ...current,
                nickname,
                initials: nickname.slice(0, 1),
                bio,
                goals,
              }
            : current,
        )
        return
      }
      const state = await updateProfileApi({ nickname, bio, goals })
      setUser(state)
    },
    [],
  )

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      if (isDemoSession()) {
        setUser((current) =>
          current
            ? { ...current, preferences: { ...current.preferences, ...patch } }
            : current,
        )
        return
      }
      const state = await updatePreferencesApi(patch)
      setUser(state)
    },
    [],
  )

  const startCourse = useCallback(
    async (courseId: string) => {
      if (isDemoSession()) {
        const course = getCourse(courseId)
        if (!course || !user) return undefined
        const lessons = flattenLessons(course)
        const existing = user.courseProgress[courseId]
        const firstLessonId = existing?.currentLessonId ?? lessons[0]?.id
        if (!existing) {
          setUser((current) =>
            current
              ? {
                  ...current,
                  courseProgress: {
                    ...current.courseProgress,
                    [courseId]: {
                      completedLessons: [],
                      currentLessonId: firstLessonId,
                    },
                  },
                }
              : current,
          )
        }
        return firstLessonId
      }

      const result = await startCourseApi(courseId)
      await refreshState()
      return result.firstLessonId
    },
    [user, refreshState],
  )

  const completeLesson = useCallback(
    async (
      courseId: string,
      lessonId: string,
      code = '',
    ): Promise<CompletionResult> => {
      if (isDemoSession()) {
        if (!user) {
          return { alreadyCompleted: false, expGained: 0, courseCompleted: false }
        }
        const nextUser = structuredClone(user)
        const result = completeLessonLocally(nextUser, courseId, lessonId)
        setUser(nextUser)
        return result
      }

      const result = await completeLessonApi(lessonId, code)
      await refreshState()
      return result
    },
    [user, refreshState],
  )

  const recordProblemResult = useCallback(
    async (
      problemId: string,
      code: string,
      usedHint = false,
    ): Promise<ProblemResultInfo> => {
      if (isDemoSession()) {
        if (!user) return { firstPass: false, stars: 0, expGained: 0 }
        const runResult = executePython(code)
        const passed =
          runResult.status === 'success' && isProblemSolution(problemId, code)
        const nextUser = structuredClone(user)
        const result = recordProblemLocally(nextUser, problemId, passed, usedHint)
        setUser(nextUser)
        return {
          ...result,
          accepted: passed,
          output: runResult.output,
          friendlyError: runResult.friendlyError,
        }
      }

      const result = await submitProblemApi(problemId, { code, usedHint })
      await refreshState()
      return result
    },
    [user, refreshState],
  )

  const toggleFavoriteCourse = useCallback(
    async (courseId: string) => {
      if (isDemoSession()) {
        let added = false
        setUser((current) => {
          if (!current) return current
          const exists = current.favoriteCourses.includes(courseId)
          added = !exists
          return {
            ...current,
            favoriteCourses: exists
              ? current.favoriteCourses.filter((id) => id !== courseId)
              : [...current.favoriteCourses, courseId],
          }
        })
        return added
      }

      const result = await toggleFavoriteApi('course', courseId)
      await refreshState()
      return result.added
    },
    [refreshState],
  )

  const toggleFavoriteProblem = useCallback(
    async (problemId: string) => {
      if (isDemoSession()) {
        let added = false
        setUser((current) => {
          if (!current) return current
          const exists = current.favoriteProblems.includes(problemId)
          added = !exists
          return {
            ...current,
            favoriteProblems: exists
              ? current.favoriteProblems.filter((id) => id !== problemId)
              : [...current.favoriteProblems, problemId],
          }
        })
        return added
      }

      const result = await toggleFavoriteApi('question', problemId)
      await refreshState()
      return result.added
    },
    [refreshState],
  )

  const markMessageRead = useCallback(async (messageId: string) => {
    if (isDemoSession()) {
      setUser((current) =>
        current && !current.readMessageIds.includes(messageId)
          ? { ...current, readMessageIds: [...current.readMessageIds, messageId] }
          : current,
      )
      return
    }

    setUser((current) =>
      current && !current.readMessageIds.includes(messageId)
        ? {
            ...current,
            readMessageIds: [...current.readMessageIds, messageId],
            unreadMessageCount: Math.max(0, (current.unreadMessageCount ?? 1) - 1),
          }
        : current,
    )
    try {
      await markMessageReadApi(messageId)
    } catch {
      // 静默失败，下次刷新状态会恢复
    }
  }, [])

  const markAllMessagesRead = useCallback(async () => {
    if (isDemoSession()) {
      setUser((current) =>
        current
          ? {
              ...current,
              readMessageIds: messages.map((message) => message.id),
              unreadMessageCount: 0,
            }
          : current,
      )
      return
    }

    await markAllMessagesReadApi()
    await refreshState()
  }, [refreshState])

  const completeOnboarding = useCallback(
    async (input: {
      pythonBase: 'zero' | 'basic'
      goals: GoalKey[]
      dailyGoalMinutes?: number
    }) => {
      if (isDemoSession()) {
        setUser((current) =>
          current
            ? {
                ...current,
                goals: input.goals,
                pythonBase: input.pythonBase,
                dailyGoalMinutes: input.dailyGoalMinutes ?? current.dailyGoalMinutes,
                onboardingCompleted: true,
              }
            : current,
        )
        return
      }
      const state = await completeOnboardingApi(input)
      setUser(state)
    },
    [],
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (isDemoSession()) {
        throw new Error('演示账号不支持修改密码，请注册真实账号')
      }
      await changePasswordApi({ currentPassword, newPassword })
    },
    [],
  )

  const changePhone = useCallback(
    async (phone: string, code: string) => {
      if (isDemoSession()) {
        throw new Error('演示账号不支持更换手机号，请注册真实账号')
      }
      const state = await updatePhoneApi({ phone, code })
      setUser(state)
    },
    [],
  )

  const changeAvatar = useCallback(async (file: File) => {
    if (isDemoSession()) {
      throw new Error('演示账号不支持上传头像，请注册真实账号')
    }
    const state = await uploadAvatarApi(file)
    setUser(state)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      loginByCode,
      loginDemo,
      register,
      logout,
      updateProfile,
      updatePreferences,
      completeLesson,
      recordProblemResult,
      toggleFavoriteCourse,
      toggleFavoriteProblem,
      markMessageRead,
      markAllMessagesRead,
      startCourse,
      completeOnboarding,
      changePassword,
      changePhone,
      changeAvatar,
      refreshState,
    }),
    [
      user,
      login,
      loginByCode,
      loginDemo,
      register,
      logout,
      updateProfile,
      updatePreferences,
      completeLesson,
      recordProblemResult,
      toggleFavoriteCourse,
      toggleFavoriteProblem,
      markMessageRead,
      markAllMessagesRead,
      startCourse,
      completeOnboarding,
      changePassword,
      changePhone,
      changeAvatar,
      refreshState,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
