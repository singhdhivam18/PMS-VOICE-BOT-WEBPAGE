import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000/api')
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('voiceops_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = null
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const refreshToken = localStorage.getItem('voiceops_refresh')
    if (error.response?.status === 401 && original && !original._retried && refreshToken && !original.url?.includes('/auth/token/')) {
      original._retried = true
      try {
        refreshing ||= axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh: refreshToken })
        const { data } = await refreshing
        localStorage.setItem('voiceops_access', data.access)
        if (data.refresh) localStorage.setItem('voiceops_refresh', data.refresh)
        refreshing = null
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch (refreshError) {
        refreshing = null
        localStorage.removeItem('voiceops_access')
        localStorage.removeItem('voiceops_refresh')
        if (window.location.pathname !== '/login') window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  },
)

export async function fetchAll(endpoint) {
  const rows = []
  let next = endpoint
  while (next) {
    const response = await api.get(next)
    const data = response.data
    if (Array.isArray(data)) {
      rows.push(...data)
      next = null
    } else {
      rows.push(...(data.results || []))
      next = data.next || null
    }
  }
  return rows
}
