import { useState } from 'react'

function AdminUserBlockModal({
  isOpen,
  user = null,
  onClose,
  onConfirmBlock,
}) {
  const [blockReason, setBlockReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen || !user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleanReason = blockReason.trim()
    if (!cleanReason) {
      setError('Vui lòng nhập lý do khóa tài khoản.')
      return
    }
    if (cleanReason.length > 255) {
      setError('Lý do không được vượt quá 255 ký tự.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await onConfirmBlock(user.id, cleanReason)
      setBlockReason('')
      onClose()
    } catch (err) {
      setError(err.message || 'Lỗi khi khóa tài khoản.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-box block-confirm">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title" style={{ color: '#f87171' }}>
            🔒 Xác nhận Khóa Tài Khoản
          </h2>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-modal-form">
          <p className="admin-block-warning-text">
            Bạn đang thực hiện khóa tài khoản của người dùng{' '}
            <strong>{user.full_name || user.username}</strong> (<code>@{user.username}</code>).
            Người dùng này sẽ bị hủy toàn bộ phiên đăng nhập hiện tại và không thể truy cập hệ thống.
          </p>

          <div className="admin-form-group">
            <label className="admin-form-label">
              Lý do khóa tài khoản <span className="req">*</span>
            </label>
            <textarea
              className={`admin-form-textarea ${error ? 'has-error' : ''}`}
              rows="3"
              placeholder="VD: Vi phạm điều khoản sử dụng, gian lận thanh toán..."
              value={blockReason}
              onChange={(e) => {
                setBlockReason(e.target.value)
                if (error) setError('')
              }}
            />
            {error && <span className="admin-form-error">{error}</span>}
          </div>

          <div className="admin-modal-actions">
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="admin-btn-danger"
              disabled={submitting}
            >
              {submitting ? 'Đang xử lý...' : 'Xác nhận khóa tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminUserBlockModal

