function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const raw = String(dateStr).trim()
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
    if (match) {
      const [, year, month, day, hours, minutes] = match
      return `${hours}:${minutes} ${day}/${month}/${year}`
    }
    const d = new Date(raw)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

function AdminUserDetailModal({ isOpen, user = null, onClose }) {
  if (!isOpen || !user) return null

  const isBlocked = Boolean(user.isDelete)

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box user-detail" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-user-detail-header-info">
            <div className="admin-user-avatar-large">
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} />
              ) : (
                <span>{(user.full_name || user.username || 'U')[0].toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="admin-modal-title">
                {user.full_name || user.username}
              </h2>
              <div className="admin-user-username-tag">@{user.username}</div>
            </div>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="admin-user-detail-body">
          <div className="admin-user-detail-grid">
            <div className="admin-user-detail-field">
              <span className="label">Mã định danh (ID):</span>
              <span className="value code">{user.id}</span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Địa chỉ Email:</span>
              <span className="value">{user.email || '—'}</span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Số điện thoại:</span>
              <span className="value">{user.phone_number || '—'}</span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Địa chỉ giao hàng:</span>
              <span className="value">{user.address || 'Chưa cập nhật'}</span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Vai trò hệ thống:</span>
              <span className="value">
                {user.isAdmin ? (
                  <span className="admin-role-badge admin">Quản trị viên (Admin)</span>
                ) : (
                  <span className="admin-role-badge customer">Khách hàng</span>
                )}
              </span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Hạng thành viên:</span>
              <span className="value">
                {user.isVip ? (
                  <span className="admin-badge-vip">⭐ Thành viên VIP</span>
                ) : (
                  <span>Thành viên thường</span>
                )}
              </span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Xác thực tài khoản:</span>
              <span className="value">
                {user.isVerified ? (
                  <span className="admin-verified-tag yes">✓ Đã xác thực email</span>
                ) : (
                  <span className="admin-verified-tag no">✗ Chưa xác thực</span>
                )}
              </span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Trạng thái tài khoản:</span>
              <span className="value">
                {isBlocked ? (
                  <span className="admin-status-badge blocked">🔒 Đang bị khóa</span>
                ) : (
                  <span className="admin-status-badge active">🟢 Hoạt động bình thường</span>
                )}
              </span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Ngày đăng ký:</span>
              <span className="value">{formatDate(user.createdAt)}</span>
            </div>

            <div className="admin-user-detail-field">
              <span className="label">Cập nhật lần cuối:</span>
              <span className="value">{formatDate(user.updatedAt)}</span>
            </div>
          </div>

          {isBlocked && (
            <div className="admin-user-block-info-card">
              <div className="admin-user-block-title">⚠️ Lý do khóa tài khoản:</div>
              <div className="admin-user-block-desc">
                {user.blockReason || 'Không có lý do cụ thể.'}
              </div>
            </div>
          )}
        </div>

        <div className="admin-modal-actions">
          <button type="button" className="admin-btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminUserDetailModal

