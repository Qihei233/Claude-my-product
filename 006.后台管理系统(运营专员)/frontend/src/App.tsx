import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/UsersPage'
import { UserDetailPage } from '@/pages/UserDetailPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { QuestionsPage } from '@/pages/QuestionsPage'
import { QuestionDetailPage } from '@/pages/QuestionDetailPage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { ListPage } from '@/pages/ListPage'
import { listConfigs } from '@/pages/listConfigs'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetailPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="questions/:id" element={<QuestionDetailPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="records" element={<ListPage config={listConfigs.records} />} />
        <Route
          path="submissions"
          element={<ListPage config={listConfigs.submissions} />}
        />
        <Route path="progress" element={<ListPage config={listConfigs.progress} />} />
        <Route
          path="daily-stats"
          element={<ListPage config={listConfigs['daily-stats']} />}
        />
        <Route path="mastery" element={<ListPage config={listConfigs.mastery} />} />
        <Route path="messages" element={<ListPage config={listConfigs.messages} />} />
        <Route
          path="favorites"
          element={<ListPage config={listConfigs.favorites} />}
        />
        <Route
          path="recommendations"
          element={<ListPage config={listConfigs.recommendations} />}
        />
        <Route path="reports" element={<ListPage config={listConfigs.reports} />} />
        <Route
          path="daily-questions"
          element={<ListPage config={listConfigs['daily-questions']} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
