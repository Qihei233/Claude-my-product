import { readStorage, STORAGE_KEYS } from '@/utils/storage'

export const DEMO_SESSION_TOKEN = 'demo-session-token'

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
).replace(/\/+$/, '')

export interface ApiUser {
  userId: string
  nickname: string
  avatar: string | null
  phone: string | null
  email: string | null
  role: 'student' | 'admin'
  level: number
  exp: number
  streakDays: number
  dailyGoalMinutes: number
  onboardingCompleted: boolean
}

export interface AuthResult {
  token: string
  expiresAt: string
  user: ApiUser
}

export interface SendCodeRequest {
  accountType: 'phone' | 'email'
  account: string
  purpose: 'register' | 'login' | 'reset_password'
}

export interface SendCodeResult {
  expiresIn: number
  devCode?: string
}

export interface RegisterRequest {
  accountType: 'phone' | 'email'
  account: string
  code: string
  password: string
}

export interface LoginRequest {
  account: string
  password: string
  rememberMe?: boolean
}

export interface LoginCodeRequest {
  accountType: 'phone' | 'email'
  account: string
  code: string
}

export interface ResetPasswordRequest {
  accountType: 'phone' | 'email'
  account: string
  code: string
  password: string
}

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  details?: unknown
}

export class ApiError extends Error {
  status: number
  code: number
  details?: unknown

  constructor(message: string, status = 0, code = 0, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  // token === null 表示明确不带登录态（登录/注册/验证码接口）
  const authToken =
    token === null ? null : (token ?? readStorage<string>(STORAGE_KEYS.token))

  if (authToken && authToken !== DEMO_SESSION_TOKEN) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('网络开小差了，请确认后端已启动（localhost:3001）', 0, 0)
  }

  let payload: ApiEnvelope<T> | null = null
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    payload = null
  }

  if (!response.ok || !payload || payload.code !== 0) {
    throw new ApiError(
      payload?.message || '请求失败，请稍后重试',
      response.status,
      payload?.code ?? response.status,
      payload?.details,
    )
  }

  return payload.data
}

export function sendVerificationCode(input: SendCodeRequest) {
  return request<SendCodeResult>(
    '/api/auth/send-code',
    { method: 'POST', body: JSON.stringify(input) },
    null,
  )
}

export function register(input: RegisterRequest) {
  return request<AuthResult>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ ...input, agreed: true }),
    },
    null,
  )
}

export function login(input: LoginRequest) {
  return request<AuthResult>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify(input) },
    null,
  )
}

export function loginByCode(input: LoginCodeRequest) {
  return request<AuthResult>(
    '/api/auth/login-code',
    { method: 'POST', body: JSON.stringify(input) },
    null,
  )
}

export function resetPassword(input: ResetPasswordRequest) {
  return request<{ ok: boolean }>(
    '/api/auth/reset-password',
    { method: 'POST', body: JSON.stringify(input) },
    null,
  )
}

export function getMe() {
  return request<{ user: ApiUser }>('/api/auth/me')
}

export async function logout() {
  const token = readStorage<string>(STORAGE_KEYS.token)
  if (!token || token === DEMO_SESSION_TOKEN) return
  await request<void>('/api/auth/logout', { method: 'POST' }, token)
}
