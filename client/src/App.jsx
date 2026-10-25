import { useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('resetToken') || ''
if (resetToken) window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const accessToken = localStorage.getItem('accessToken')
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(data?.message || 'Đã xảy ra lỗi.')
  return data
}

function App() {
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login')
  const [form, setForm] = useState({
    username: '', fullName: '', email: '', phone: '', address: '',
    password: '', confirmPassword: '', currentPassword: '', newPassword: '', token: resetToken,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const changeMode = (nextMode) => {
    setMode(nextMode)
    setMessage('')
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const path = mode === 'register' ? '/auth/register'
        : mode === 'forgot' ? '/auth/forgot-password'
          : mode === 'reset' ? '/auth/reset-password'
            : mode === 'change' ? '/auth/change-password' : '/auth/login'
      const payload = mode === 'register'
        ? { username: form.username, fullName: form.fullName, email: form.email, phone: form.phone, address: form.address, password: form.password, confirmPassword: form.confirmPassword }
        : mode === 'forgot'
          ? { email: form.email }
          : mode === 'reset'
            ? { token: form.token, password: form.password, confirmPassword: form.confirmPassword }
            : mode === 'change'
              ? { currentPassword: form.currentPassword, newPassword: form.newPassword, confirmPassword: form.confirmPassword }
              : { email: form.email, password: form.password }
      const data = await request(path, { method: 'POST', body: JSON.stringify(payload) })
      if (mode === 'forgot') {
        setMessage(data.message)
      } else if (mode === 'reset' || mode === 'change') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        setUser(null)
        setMode('login')
        setForm({ ...form, password: '', confirmPassword: '', currentPassword: '', newPassword: '', token: '' })
        if (mode === 'reset') window.history.replaceState({}, '', window.location.pathname)
        setMessage(data.message)
      } else if (mode === 'register') {
        setMode('login')
        setForm({ ...form, password: '', confirmPassword: '' })
        setMessage(data.message || 'Đăng ký thành công.')
      } else {
        setUser(data.user)
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('user', JSON.stringify(data.user))
        setMessage('Đăng nhập thành công.')
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    request('/auth/logout', { method: 'POST' }).catch(() => {})
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setUser(null)
    setMessage('Bạn đã đăng xuất.')
  }

  if (user) {
    return (
      <main className="page">
        <section className="card welcome">
          <span className="eyebrow">SERN BOOKSTORE</span>
          <h1>Xin chào, {user.fullName}</h1>
          <p>Bạn đang đăng nhập với vai trò <strong>{user.role || (user.isAdmin ? 'Admin' : 'Customer')}</strong>.</p>
          <button onClick={() => changeMode('change')}>Đổi mật khẩu</button>
          <button className="secondary" onClick={logout}>Đăng xuất</button>
          {mode === 'change' && (
            <form onSubmit={submit}>
              <label>Mật khẩu hiện tại<input type="password" name="currentPassword" value={form.currentPassword} onChange={update} required /></label>
              <label>Mật khẩu mới<input type="password" name="newPassword" value={form.newPassword} onChange={update} required minLength="8" /></label>
              <label>Xác nhận mật khẩu<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} required minLength="8" /></label>
              <button type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}</button>
            </form>
          )}
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="intro">
        <span className="eyebrow">SERN BOOKSTORE</span>
        <h1>Mở cánh cửa<br /><em>tri thức.</em></h1>
        <p>Hệ thống bán sách trực tuyến sử dụng SQL Server, Express, React và Node.js.</p>
      </section>
      <section className="card auth-card">
        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Đăng nhập</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Đăng ký</button>
        </div>
        <h2>{mode === 'register' ? 'Tạo tài khoản' : mode === 'forgot' ? 'Quên mật khẩu' : mode === 'reset' ? 'Đặt lại mật khẩu' : 'Chào mừng trở lại'}</h2>
        <p className="muted">{mode === 'login' ? 'Đăng nhập để tiếp tục mua sắm.' : 'Nhập thông tin để tiếp tục.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Họ và tên<input name="fullName" value={form.fullName} onChange={update} required minLength="2" /></label>}
          {mode === 'register' && <label>Username<input name="username" value={form.username} onChange={update} required minLength="3" /></label>}
          {mode === 'register' && <label>Số điện thoại<input name="phone" value={form.phone} onChange={update} required /></label>}
          {mode === 'register' && <label>Địa chỉ<input name="address" value={form.address} onChange={update} required minLength="2" /></label>}
          {mode === 'reset' && !resetToken && <label>Mã đặt lại mật khẩu<input name="token" value={form.token} onChange={update} required autoComplete="off" /></label>}
          {mode !== 'reset' && <label>Email<input type="email" name="email" value={form.email} onChange={update} required /></label>}
          {mode !== 'forgot' && <label>Mật khẩu<input type="password" name="password" value={form.password} onChange={update} required minLength="8" /></label>}
          {(mode === 'register' || mode === 'reset') && <label>Xác nhận mật khẩu<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} required minLength="8" /></label>}
          <button type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : mode === 'register' ? 'Tạo tài khoản' : mode === 'forgot' ? 'Gửi yêu cầu' : mode === 'reset' ? 'Đổi mật khẩu' : 'Đăng nhập'}</button>
        </form>
        {mode === 'login' && <button className="link" onClick={() => changeMode('forgot')}>Quên mật khẩu?</button>}
        {(mode === 'forgot' || mode === 'reset') && <button className="link" onClick={() => changeMode('login')}>Quay lại đăng nhập</button>}
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  )
}

export default App
