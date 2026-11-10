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
  getMe,
  login as apiLogin,
  loginByCode as apiLoginByCode,
  logout as apiLogout,
  register as apiRegister,
  type ApiUser,
} from '@/api/auth'
import { flattenLessons, getCourse } from '@/data/courses'
import { createDemoUser, createNewUser, defaultPreferences, messages } from '@/data/mockData'
import type { GoalKey, User, UserPreferences } from '@/types'
import { formatDate } from '@/utils/date'
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
  loginDemo: () => void
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (profile: {
    nickname: string
    bio: string
    goals: GoalKey[]
  }) => void
  updatePreferences: (patch: Partial<UserPreferences>) => void
  completeLesson: (courseId: string, lessonId: string) => CompletionResult
  recordProblemResult: (
    problemId: string,
    passed: boolean,
    usedHint?: boolean,
  ) => ProblemResultInfo
  toggleFavoriteCourse: (courseId: string) => boolean
  toggleFavoriteProblem: (problemId: string) => boolean
  markMessageRead: (messageId: string) => void
  markAllMessagesRead: () => void
  startCourse: (courseId: string) => string | undefined
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
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser)

  useEffect(() => {
    if (user) writeStorage(STORAGE_KEYS.user, user)
    else removeStorage(STORAGE_KEYS.user)
  }, [user])

  // 刷新页面时用真实 token 恢复用户；演示账号不请求后端
  useEffect(() => {
    const token = readStorage<string>(STORAGE_KEYS.token)
    if (!token || token === DEMO_SESSION_TOKEN) return

    let cancelled = false
    getMe()
      .then(({ user: apiUser }) => {
        if (!cancelled) setUser((current) => userFromApi(apiUser, current))
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

  const finishLogin = useCallback((nextUser: User, token: string) => {
    writeStorage(STORAGE_KEYS.token, token)
    setUser(nextUser)
  }, [])

  const login = useCallback(
    async (account: string, password: string, rememberMe = false) => {
      const result = await apiLogin({ account, password, rememberMe })
      finishLogin(userFromApi(result.user, user), result.token)
    },
    [finishLogin, user],
  )

  const loginByCode = useCallback(
    async (accountType: 'phone' | 'email', account: string, code: string) => {
      const result = await apiLoginByCode({ accountType, account, code })
      finishLogin(userFromApi(result.user, user), result.token)
    },
    [finishLogin, user],
  )

  const loginDemo = useCallback(() => {
    finishLogin(createDemoUser(), DEMO_SESSION_TOKEN)
  }, [finishLogin])

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await apiRegister(input)
      finishLogin(userFromApi(result.user, null), result.token)
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
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    ({ nickname, bio, goals }: { nickname: string; bio: string; goals: GoalKey[] }) => {
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
    },
    [],
  )

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setUser((current) =>
      current
        ? { ...current, preferences: { ...current.preferences, ...patch } }
        : current,
    )
  }, [])

  const startCourse = useCallback(
    (courseId: string) => {
      const course = getCourse(courseId)
      if (!course) return undefined
      const lessons = flattenLessons(course)
      const existing = user?.courseProgress[courseId]
      const firstLessonId = existing?.currentLessonId ?? lessons[0]?.id
      if (!existing && user) {
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
    },
    [user],
  )

  const completeLesson = useCallback(
    (courseId: string, lessonId: string): CompletionResult => {
      const course = getCourse(courseId)
      if (!user || !course) {
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
      const chapter = course.chapters.find((item) => item.id === lessons[currentLessonIndex]?.chapterId)
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

      setUser((current) => {
        if (!current) return current
        return {
          ...current,
          exp: current.exp + 20,
          hoursLearned: Number((current.hoursLearned + 0.2).toFixed(1)),
          completedLessonCount: current.completedLessonCount + 1,
          courseProgress: {
            ...current.courseProgress,
            [courseId]: {
              completedLessons: [...completed],
              currentLessonId: next?.id ?? lessonId,
            },
          },
          completedCourses: completedAll
            ? Array.from(new Set([...current.completedCourses, courseId]))
            : current.completedCourses,
          achievements,
        }
      })

      return {
        alreadyCompleted: false,
        expGained: 20,
        nextLessonId: next?.id,
        courseCompleted: completedAll,
      }
    },
    [user],
  )

  const recordProblemResult = useCallback(
    (problemId: string, passed: boolean, usedHint = false): ProblemResultInfo => {
      if (!user) return { firstPass: false, stars: 0, expGained: 0 }
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
      setUser((current) => {
        if (!current) return current
        const currentPrevious = current.problemResults[problemId]
        const currentAttempts = (currentPrevious?.attempts ?? 0) + 1
        return {
          ...current,
          exp: current.exp + (firstPass ? 30 : 0),
          passedProblemCount: current.passedProblemCount + (firstPass ? 1 : 0),
          problemResults: {
            ...current.problemResults,
            [problemId]: {
              attempts: currentAttempts,
              stars,
            },
          },
          achievements,
        }
      })
      return { firstPass, stars, expGained: firstPass ? 30 : 0 }
    },
    [user],
  )

  const toggleFavoriteCourse = useCallback((courseId: string) => {
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
  }, [])

  const toggleFavoriteProblem = useCallback((problemId: string) => {
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
  }, [])

  const markMessageRead = useCallback((messageId: string) => {
    setUser((current) =>
      current && !current.readMessageIds.includes(messageId)
        ? { ...current, readMessageIds: [...current.readMessageIds, messageId] }
        : current,
    )
  }, [])

  const markAllMessagesRead = useCallback(() => {
    setUser((current) =>
      current
        ? { ...current, readMessageIds: messages.map((message) => message.id) }
        : current,
    )
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
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
