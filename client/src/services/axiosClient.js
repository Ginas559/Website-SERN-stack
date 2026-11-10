import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const baseMessage = error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ.'
    const validationErrors = error.response?.data?.errors
    const firstFieldError = Array.isArray(validationErrors) && validationErrors.length > 0 ? validationErrors[0] : null
    const message = firstFieldError?.message
      ? `${baseMessage} (${firstFieldError.field || 'param'}: ${firstFieldError.message})`
      : baseMessage
    if (status === 403 && typeof baseMessage === 'string' && (baseMessage.includes('bị khóa') || baseMessage.includes('khóa'))) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sern:account-blocked', { detail: { message: baseMessage } }))
      }
    }
    return Promise.reject(new Error(message))
  }
)

export default axiosClient
