import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  Code2,
  FileText,
  Lightbulb,
  ListChecks,
  LogOut,
  Send,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { useAuth } from '@/app/AuthContext'

const groups = [
  {
    title: '概览',
    items: [{ to: '/', label: '数据概览', icon: BarChart3, end: true }],
  },
  {
    title: '用户与内容',
    items: [
      { to: '/users', label: '用户管理', icon: Users },
      { to: '/courses', label: '课程管理', icon: BookOpen },
      { to: '/questions', label: '题库管理', icon: Code2 },
    ],
  },
  {
    title: '学习数据',
    items: [
      { to: '/records', label: '学习记录', icon: ListChecks },
      { to: '/submissions', label: '提交记录', icon: Send },
      { to: '/progress', label: '课时进度', icon: Target },
      { to: '/daily-stats', label: '每日统计', icon: CalendarDays },
      { to: '/mastery', label: '掌握度', icon: Lightbulb },
      { to: '/leaderboard', label: '周排行榜', icon: Trophy },
    ],
  },
  {
    title: '运营数据',
    items: [
      { to: '/messages', label: '消息', icon: Bell },
      { to: '/favorites', label: '收藏', icon: Bookmark },
      { to: '/recommendations', label: '推荐', icon: Lightbulb },
      { to: '/reports', label: '学习报告', icon: FileText },
      { to: '/daily-questions', label: '每日一题', icon: CalendarDays },
    ],
  },
]

export function Layout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-frog">🐸</span>
          <div>
            <strong>奶蛙后台</strong>
            <small>运营管理控制台</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group.title} className="nav-group">
              <span className="nav-group-title">{group.title}</span>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={'end' in item ? item.end : false}
                    className={({ isActive }) =>
                      `nav-item${isActive ? ' is-active' : ''}`
                    }
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">奶蛙 Python 学习平台 · 后台管理</div>
          <div className="topbar-right">
            <span className="admin-chip">管理员 · {admin?.username}</span>
            <button
              type="button"
              className="logout-button"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              <LogOut size={15} /> 退出
            </button>
          </div>
        </header>
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
