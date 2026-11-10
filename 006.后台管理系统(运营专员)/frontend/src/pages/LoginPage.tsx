import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, LoaderCircle, UserRound } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('请输入管理员账号和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span>🐸</span>
          <div>
            <h1>奶蛙后台管理系统</h1>
            <p>奶蛙 Python 学习平台 · 运营控制台</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <label>
            <span>管理员账号</span>
            <div className="input-wrap">
              <UserRound size={17} />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入管理员账号"
                autoComplete="username"
              />
            </div>
          </label>
          <label>
            <span>密码</span>
            <div className="input-wrap">
              <KeyRound size={17} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? <LoaderCircle size={17} className="spin" /> : null}
            {loading ? '登录中…' : '登录后台'}
          </button>
        </form>

        <p className="login-note">
          默认账号由后端 <code>.env</code> 配置（当前：admin / admin123）。
        </p>
      </div>
    </div>
  )
}
