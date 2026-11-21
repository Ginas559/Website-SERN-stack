function AdminConfirmModal({ isOpen, title, message, confirmLabel = 'Xác nhận', danger = false, onCancel, onConfirm }) {
  if (!isOpen) return null

  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onCancel}>
      <div className="admin-modal-box block-confirm" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-header">
          <h2 className="admin-modal-title" style={danger ? { color: '#f87171' } : undefined}>{title}</h2>
          <button type="button" className="admin-modal-close" onClick={onCancel}>&times;</button>
        </div>
        <p className="admin-block-warning-text">{message}</p>
        <div className="admin-modal-actions">
          <button type="button" className="admin-btn-secondary" onClick={onCancel}>Hủy bỏ</button>
          <button type="button" className={danger ? 'admin-btn-danger' : 'admin-btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default AdminConfirmModal
