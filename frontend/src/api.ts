import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

export type LoginResponse = {
  access: string
  refresh: string
}

export const authApi = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      } else {
        window.location.reload()
      }
    }
    return Promise.reject(error)
  },
)

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await authApi.post<LoginResponse>('/auth/login/', { username, password })
  localStorage.setItem('access_token', response.data.access)
  localStorage.setItem('refresh_token', response.data.refresh)
  return response.data
}

export function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem('access_token'))
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string') {
      return data
    }
    if (data?.detail && typeof data.detail === 'string') {
      return data.detail
    }
    if (data && typeof data === 'object') {
      const firstValue = Object.values(data)[0]
      if (Array.isArray(firstValue) && firstValue[0]) {
        return String(firstValue[0])
      }
    }
    return error.message
  }
  return 'Unexpected error occurred.'
}
