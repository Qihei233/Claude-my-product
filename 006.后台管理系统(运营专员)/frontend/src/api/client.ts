const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3101'
).replace(/\/+$/, '')

export const TOKEN_KEY = 'naiwa_admin_token'
export const ADMIN_KEY = 'naiwa_admin_user'

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface Envelope<T> {
  code: number
  message: string
  data: T
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('无法连接后台服务，请确认后端已启动（localhost:3101）')
  }

  let payload: Envelope<T> | null = null
  try {
    payload = (await response.json()) as Envelope<T>
  } catch {
    payload = null
  }

  if (!response.ok || !payload || payload.code !== 0) {
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(ADMIN_KEY)
    }
    throw new ApiError(
      payload?.message || '请求失败，请稍后重试',
      response.status,
    )
  }

  return payload.data
}

export function apiBase() {
  return API_BASE
}
