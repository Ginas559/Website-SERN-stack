import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

let refreshPromise = null

function clearStoredAuth() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
}

function dispatchAuthEvent(eventName, detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }))
  }
}

function extractErrorMessage(error) {
  const baseMessage = error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ.'
  const validationErrors = error.response?.data?.errors
  const firstFieldError = Array.isArray(validationErrors) && validationErrors.length > 0 ? validationErrors[0] : null
  return firstFieldError?.message
    ? `${baseMessage} (${firstFieldError.field || 'param'}: ${firstFieldError.message})`
    : baseMessage
}

function isProtectedTokenFailure(error, baseMessage) {
  const url = String(error.config?.url || '')
  if (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password')
  ) {
    return false
  }
  if (typeof baseMessage === 'string' && baseMessage.includes('Mật khẩu hiện tại')) {
    return false
  }
  return Boolean(localStorage.getItem('accessToken') || localStorage.getItem('user'))
}

async function refreshSessionToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const data = res.data
        if (!data?.accessToken) {
          throw new Error('Không thể làm mới phiên đăng nhập.')
        }
        localStorage.setItem('accessToken', data.accessToken)
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
        }
        dispatchAuthEvent('sern:session-refreshed', { user: data.user || null })
        return data.accessToken
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

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
  async (error) => {
    const status = error.response?.status
    const baseMessage = error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ.'
    const formattedMessage = extractErrorMessage(error)

    if (status === 403 && typeof baseMessage === 'string' && (baseMessage.includes('bị khóa') || baseMessage.includes('khóa'))) {
      clearStoredAuth()
      dispatchAuthEvent('sern:account-blocked', { message: baseMessage })
      const rejectionError = new Error(formattedMessage)
      rejectionError.status = status
      rejectionError.response = error.response
      return Promise.reject(rejectionError)
    }

    if (status === 401 && isProtectedTokenFailure(error, baseMessage)) {
      const originalRequest = error.config
      if (originalRequest && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          const freshToken = await refreshSessionToken()
          originalRequest.headers = originalRequest.headers || {}
          if (typeof originalRequest.headers.set === 'function') {
            originalRequest.headers.set('Authorization', `Bearer ${freshToken}`)
          } else {
            originalRequest.headers.Authorization = `Bearer ${freshToken}`
          }
          return await axiosClient(originalRequest)
        } catch (refreshError) {
          const refreshStatus = refreshError.response?.status
          const refreshMsg = refreshError.response?.data?.message || 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.'
          clearStoredAuth()
          if (refreshStatus === 403 && typeof refreshMsg === 'string' && refreshMsg.includes('khóa')) {
            dispatchAuthEvent('sern:account-blocked', { message: refreshMsg })
          } else {
            dispatchAuthEvent('sern:session-expired', { message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' })
          }
          const refreshErrObj = new Error(refreshMsg)
          refreshErrObj.status = refreshStatus
          refreshErrObj.response = refreshError.response
          return Promise.reject(refreshErrObj)
        }
      }
      clearStoredAuth()
      dispatchAuthEvent('sern:session-expired', { message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' })
    }

    const rejectionError = new Error(formattedMessage)
    rejectionError.status = status
    rejectionError.response = error.response
    return Promise.reject(rejectionError)
  }
)

export default axiosClient
