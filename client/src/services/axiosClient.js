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
    const message = error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ.'
    if (status === 403 && typeof message === 'string' && (message.includes('bị khóa') || message.includes('khóa'))) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sern:account-blocked', { detail: { message } }))
      }
    }
    return Promise.reject(new Error(message))
  }
)

export default axiosClient
