import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react'
import { sendVerificationCode } from '@/api/auth'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { InfoBanner } from '@/components/ui/InfoBanner'
import { useAuth } from '@/app/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { cn } from '@/utils/cn'

type LoginMode = 'password' | 'code'

const isValidAccount = (value: string) =>
  /^1[3-9]\d{9}$/.test(value.trim()) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const accountTypeOf = (value: string): 'phone' | 'email' =>
  /^1[3-9]\d{9}$/.test(value.trim()) ? 'phone' : 'email'

export function LoginPage() {
  const { login, loginByCode, loginDemo } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const returnUrlParam = searchParams.get('returnUrl')
  const returnUrl = returnUrlParam?.startsWith('/') && !returnUrlParam.startsWith('//')
    ? returnUrlParam
    : '/'
  const reason = (location.state as { reason?: string } | null)?.reason

  const [mode, setMode] = useState<LoginMode>('password')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [accountError, setAccountError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (!countdown) return
    const timer = window.setInterval(() => setCountdown((current) => current - 1), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  const finishLogin = async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'password') {
        await login(account.trim(), password, remember)
      } else {
        await loginByCode(accountTypeOf(account), account.trim(), code)
      }
      showToast('登录成功，继续你的 Python 之旅吧～')
      navigate(returnUrl, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setAccountError('')
    if (!isValidAccount(account)) {
      setAccountError('请输入正确的手机号或邮箱')
      return
    }
    if (mode === 'password' && !password) {
      setError('请输入密码')
      return
    }
    if (mode === 'code' && !/^\d{6}$/.test(code)) {
      setError('验证码不正确，请重新输入')
      return
    }
    void finishLogin()
  }

  const handleDemo = () => {
    loginDemo()
    showToast('已进入演示账号：小林同学')
    navigate(returnUrl, { replace: true })
  }

  const sendCode = async () => {
    setError('')
    setAccountError('')
    if (!isValidAccount(account)) {
      setAccountError('先填写正确的手机号或邮箱，再获取验证码')
      return
    }
    try {
      const result = await sendVerificationCode({
        accountType: accountTypeOf(account),
        account: account.trim(),
        purpose: 'login',
      })
      setCountdown(60)
      showToast(
        result.devCode
          ? `验证码已发送（开发环境：${result.devCode}）`
          : '验证码已发送，请查收',
        'info',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请稍后重试')
    }
  }

  return (
    <div className="auth-page page-container">
      <div className="auth-layout">
        <aside className="auth-aside">
          <div className="auth-frog-frame">
            <img src="/frog/sideways-glance.png" alt="奶蛙歪着头陪你登录" />
          </div>
          <h1>又见面啦，学习搭子。</h1>
          <p>
            慢慢来，每个小白都能学会 Python。
            <br />
            你上次写下的那一行，奶蛙还记得。
          </p>
          <ul className="auth-assurance-list">
            <li>免费学习</li>
            <li>进度自动保存</li>
            <li>随时继续</li>
          </ul>
        </aside>

        <section className="auth-card" aria-labelledby="login-title">
          <h2 id="login-title">欢迎回到奶蛙</h2>
          <p className="auth-card-subtitle">登录后，接着上次的进度继续。</p>

          {reason && !error && <InfoBanner className="auth-banner">{reason}</InfoBanner>}
          {error && (
            <InfoBanner tone="error" className="auth-banner">
              {error}
            </InfoBanner>
          )}

          <div className="auth-tabs" role="tablist" aria-label="登录方式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              className={cn('auth-tab', mode === 'password' && 'is-active')}
              onClick={() => {
                setMode('password')
                setError('')
              }}
            >
              密码登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'code'}
              className={cn('auth-tab', mode === 'code' && 'is-active')}
              onClick={() => {
                setMode('code')
                setError('')
              }}
            >
              验证码登录
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <Field
              label="手机号或邮箱"
              name="account"
              placeholder="请输入手机号或邮箱"
              autoComplete="username"
              value={account}
              error={accountError}
              leading={<Smartphone size={17} />}
              onChange={(event) => {
                setAccount(event.target.value)
                if (accountError) setAccountError('')
              }}
            />

            {mode === 'password' ? (
              <Field
                label="密码"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                autoComplete="current-password"
                value={password}
                leading={<LockKeyhole size={17} />}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (error) setError('')
                }}
                trailing={
                  <button
                    type="button"
                    className="input-icon-button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
            ) : (
              <Field
                label="6 位验证码"
                name="code"
                inputMode="numeric"
                maxLength={6}
                placeholder="请输入 6 位验证码"
                autoComplete="one-time-code"
                value={code}
                leading={<ShieldCheck size={17} />}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  if (error) setError('')
                }}
                trailing={
                  <button
                    type="button"
                    className="input-code-button"
                    disabled={countdown > 0}
                    onClick={sendCode}
                  >
                    {countdown ? `${countdown}s 后重发` : '获取验证码'}
                  </button>
                }
              />
            )}

            <div className="auth-form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>记住我</span>
              </label>
              <Link to="/forget" className="auth-inline-link">
                忘记密码？
              </Link>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={
                !account.trim() || (mode === 'password' ? !password : !code)
              }
              className="auth-submit"
            >
              {mode === 'password' ? '登 录' : '验证码登录'}
            </Button>
          </form>

          <p className="auth-switch">
            还没有账号？{' '}
            <Link to="/register" className="auth-strong-link">
              免费注册 →
            </Link>
          </p>

          <button type="button" className="demo-login-link" onClick={handleDemo}>
            第一次来？使用演示账号体验 →
          </button>

          <p className="auth-security-note">
            <ShieldCheck size={15} /> 你的学习记录，会被好好保存。
          </p>
        </section>
      </div>
    </div>
  )
}
