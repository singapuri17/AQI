import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const axiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Attach JWT token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Only redirect to /login on 401 if we are NOT on an auth endpoint
// This prevents redirect loops during login/register flows
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/register')

    if (error.response?.status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().logout()
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
