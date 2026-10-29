import { useState } from 'react'

function CategoryModalContent({ mode, category, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: mode === 'edit' && category ? (category.name || '') : '',
    description: mode === 'edit' && category ? (category.description || '') : '',
    image: mode === 'edit' && category ? (category.image || '') : '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!formData.name.trim()) {
      setError('Tên thể loại không được để trống.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        image: formData.image.trim() || null,
      }
      await onSave(payload, category?.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Không thể lưu thể loại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal admin-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{mode === 'edit' ? 'Chỉnh sửa thể loại' : 'Thêm thể loại mới'}</h3>
          <button type="button" className="admin-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="admin-modal-form">
          {error && <div className="admin-form-error">{error}</div>}
          <div className="admin-form-group">
            <label>Tên thể loại *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="VD: Văn học cổ điển"
              required
            />
          </div>
          <div className="admin-form-group">
            <label>Mô tả thể loại</label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              placeholder="Mô tả đặc trưng, phong cách hoặc phạm trù của thể loại..."
            />
          </div>
          <div className="admin-form-group">
            <label>Link biểu tượng / Ảnh (URL)</label>
            <input
              type="text"
              name="image"
              value={formData.image}
              onChange={handleChange}
              placeholder="https://..."
            />
          </div>
          <div className="admin-modal-actions">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="admin-btn-primary" disabled={submitting}>
              {submitting ? 'Đang lưu...' : mode === 'edit' ? 'Cập nhật' : 'Thêm thể loại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdminCategoryModal({ isOpen, mode, category, onClose, onSave }) {
  if (!isOpen) return null

  return (
    <CategoryModalContent
      key={mode === 'edit' && category ? category.id : 'create'}
      mode={mode}
      category={category}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

export default AdminCategoryModal
