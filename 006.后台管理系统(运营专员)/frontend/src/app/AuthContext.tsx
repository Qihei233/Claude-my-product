import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ADMIN_KEY, TOKEN_KEY } from '@/api/client'
import { login as apiLogin } from '@/api/admin'

interface AdminUser {
  username: string
  role: string
}

interface AuthValue {
  admin: AdminUser | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

function loadAdmin(): AdminUser | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(loadAdmin)

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password)
    sessionStorage.setItem(TOKEN_KEY, result.token)
    sessionStorage.setItem(ADMIN_KEY, JSON.stringify(result.admin))
    setAdmin(result.admin)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(ADMIN_KEY)
    setAdmin(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ admin, isAuthenticated: Boolean(admin), login, logout }),
    [admin, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
