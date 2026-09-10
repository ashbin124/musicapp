import axios from 'axios'
import { API_BASE_URL } from '../config'

const ACCESS_KEY = 'wavebox.access'
const REFRESH_KEY = 'wavebox.refresh'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
})

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function setTokens(tokens) {
  if (tokens.access) localStorage.setItem(ACCESS_KEY, tokens.access)
  if (tokens.refresh) localStorage.setItem(REFRESH_KEY, tokens.refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const refresh = localStorage.getItem(REFRESH_KEY)
    if (error.response?.status === 401 && refresh && !original?._retry) {
      original._retry = true
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
          refresh,
        })
        setTokens(response.data)
        original.headers.Authorization = `Bearer ${response.data.access}`
        return api(original)
      } catch {
        clearTokens()
        window.dispatchEvent(new Event('wavebox:auth-expired'))
      }
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error, fallback = 'Something went wrong.') {
  if (!navigator.onLine) return 'You appear to be offline.'
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.detail) return data.detail
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0]
    if (Array.isArray(first)) return first[0]
    if (typeof first === 'string') return first
  }
  return fallback
}
