import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const TOKEN_KEY = 'mc_token'
const REFRESH_TOKEN_KEY = 'mc_refresh_token'
const USER_KEY = 'mc_user'
const TOKEN_TYPE = 'Bearer'
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000

type AuthSessionPayload = {
  accessToken: string
  refreshToken: string
  userId: number
  nickname: string
}

function getBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9090'
}

function parseJwtExp(token: string): number | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = JSON.parse(window.atob(padded))
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const userId = ref<number | null>(null)
  const nickname = ref<string | null>(null)
  const isLoggedIn = computed(() => !!accessToken.value)
  let refreshPromise: Promise<string> | null = null

  function restoreFromStorage() {
    const token = localStorage.getItem(TOKEN_KEY)
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    const user = localStorage.getItem(USER_KEY)

    if (token) accessToken.value = token
    if (refresh) refreshToken.value = refresh

    if (user) {
      try {
        const parsed = JSON.parse(user)
        userId.value = parsed.userId ?? null
        nickname.value = parsed.nickname ?? null
      } catch {
        // ignore invalid cached user payload
      }
    }
  }

  function setSession(session: AuthSessionPayload) {
    accessToken.value = session.accessToken
    refreshToken.value = session.refreshToken
    userId.value = session.userId
    nickname.value = session.nickname

    localStorage.setItem(TOKEN_KEY, session.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify({
      userId: session.userId,
      nickname: session.nickname,
    }))
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    userId.value = null
    nickname.value = null

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  function getStoredAccessToken() {
    return accessToken.value || localStorage.getItem(TOKEN_KEY)
  }

  function shouldRefreshAccessToken(token: string) {
    const expiresAt = parseJwtExp(token)
    if (!expiresAt) return false
    return expiresAt - Date.now() <= ACCESS_TOKEN_REFRESH_BUFFER_MS
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '로그인에 실패했습니다.')
    setSession(data)
  }

  async function register(email: string, password: string, nick: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nickname: nick }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '회원가입에 실패했습니다.')
  }

  async function refreshTokens(): Promise<string> {
    if (refreshPromise) return refreshPromise

    const token = refreshToken.value || localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!token) {
      clearSession()
      throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
    }

    refreshPromise = (async () => {
      const res = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      })
      const data = await res.json()
      if (!res.ok) {
        clearSession()
        throw new Error(data.error || '세션이 만료되었습니다. 다시 로그인해주세요.')
      }
      setSession(data)
      return data.accessToken as string
    })()

    try {
      return await refreshPromise
    } finally {
      refreshPromise = null
    }
  }

  async function ensureValidAccessToken(): Promise<string | null> {
    const token = getStoredAccessToken()
    if (!token) return null
    if (!shouldRefreshAccessToken(token)) return token
    return refreshTokens()
  }

  async function logout() {
    const token = getStoredAccessToken()
    clearSession()

    try {
      if (token) {
        await fetch(`${getBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `${TOKEN_TYPE} ${token}` },
        })
      }
    } catch {
      // best-effort server logout; local session is already cleared
    }
  }

  return {
    accessToken,
    refreshToken,
    userId,
    nickname,
    isLoggedIn,
    restoreFromStorage,
    setSession,
    clearSession,
    login,
    register,
    refreshTokens,
    ensureValidAccessToken,
    logout,
  }
})
