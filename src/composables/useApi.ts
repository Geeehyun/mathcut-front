import router from '@/router'
import { useAuthStore } from '@/stores/auth'

function getBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
}

type RequestOptions = {
  retryOnUnauthorized?: boolean
}

async function handleAuthFailure(): Promise<never> {
  const auth = useAuthStore()
  await auth.logout()
  await router.push('/login')
  throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const auth = useAuthStore()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  try {
    const validAccessToken = await auth.ensureValidAccessToken()
    if (validAccessToken) {
      headers.Authorization = `Bearer ${validAccessToken}`
    }
  } catch {
    await handleAuthFailure()
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && options.retryOnUnauthorized !== false) {
    try {
      const refreshedToken = await auth.refreshTokens()
      const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      retryHeaders.Authorization = `Bearer ${refreshedToken}`

      const retryRes = await fetch(`${getBaseUrl()}${path}`, {
        method,
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      if (retryRes.status === 204) return undefined as T

      const retryData = await retryRes.json()
      if (!retryRes.ok) throw new Error(retryData.error || `요청 실패 (${retryRes.status})`)
      return retryData as T
    } catch {
      await handleAuthFailure()
    }
  }

  if (res.status === 204) return undefined as T

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`)
  return data as T
}

export function useApi() {
  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
    post: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
    put: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
    del: (path: string, options?: RequestOptions) => request<void>('DELETE', path, undefined, options),
  }
}
