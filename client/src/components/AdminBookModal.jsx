import { useState } from 'react'

function BookModalContent({ mode, book, categories = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: mode === 'edit' && book ? (book.title || '') : '',
    author: mode === 'edit' && book ? (book.author || '') : '',
    price: mode === 'edit' && book && book.price !== undefined ? String(book.price) : '',
    purchase_price: mode === 'edit' && book && book.purchase_price !== undefined ? String(book.purchase_price) : '',
    discount: mode === 'edit' && book && book.discount !== undefined ? String(book.discount) : '0',
    quantity: mode === 'edit' && book && book.quantity !== undefined ? String(book.quantity) : '0',
    publication_date: mode === 'edit' && book && book.publication_date ? book.publication_date.slice(0, 10) : '',
    image: mode === 'edit' && book ? (book.image || '') : '',
    description: mode === 'edit' && book ? (book.description || '') : '',
    categoryIds: mode === 'edit' && book ? (book.categories || []).map((c) => c.id) : [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCategoryToggle = (catId) => {
    setFormData((prev) => {
      const exists = prev.categoryIds.includes(catId)
      const nextCategoryIds = exists
        ? prev.categoryIds.filter((id) => id !== catId)
        : [...prev.categoryIds, catId]
      return { ...prev, categoryIds: nextCategoryIds }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!formData.title.trim()) {
      setError('Tiêu đề sách không được để trống.')
      return
    }
    if (!formData.author.trim()) {
      setError('Tên tác giả không được để trống.')
      return
    }
    const priceNum = Number(formData.price)
    if (!priceNum || priceNum <= 0) {
      setError('Giá bán sách phải lớn hơn 0.')
      return
    }
    const discountNum = Number(formData.discount || 0)
    if (discountNum < 0 || discountNum > 100) {
      setError('Tỉ lệ giảm giá phải từ 0% đến 100%.')
      return
    }
    const quantityNum = Number(formData.quantity || 0)
    if (quantityNum < 0) {
      setError('Số lượng tồn kho không được nhỏ hơn 0.')
      return
    }
    const purchaseNum = Number(formData.purchase_price || 0)
    if (purchaseNum < 0) {
      setError('Giá nhập kho không được nhỏ hơn 0.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        price: priceNum,
        purchase_price: purchaseNum,
        discount: discountNum,
        quantity: quantityNum,
        publication_date: formData.publication_date || null,
        image: formData.image.trim() || null,
        description: formData.description.trim() || null,
        categoryIds: formData.categoryIds,
      }
      await onSave(payload, book?.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Không thể lưu ấn phẩm.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{mode === 'edit' ? 'Chỉnh sửa ấn phẩm' : 'Thêm ấn phẩm mới'}</h3>
          <button type="button" className="admin-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="admin-modal-form">
          {error && <div className="admin-form-error">{error}</div>}
          <div className="admin-form-row">
            <div className="admin-form-group flex-2">
              <label>Tiêu đề sách *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="VD: Nhà Giả Kim"
                required
              />
            </div>
            <div className="admin-form-group flex-1">
              <label>Tác giả *</label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleChange}
                placeholder="VD: Paulo Coelho"
                required
              />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Giá bán (VNĐ) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="VD: 79000"
                min="1"
                required
              />
            </div>
            <div className="admin-form-group">
              <label>Giá nhập (VNĐ)</label>
              <input
                type="number"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={handleChange}
                placeholder="VD: 50000"
                min="0"
              />
            </div>
            <div className="admin-form-group">
              <label>Giảm giá (%)</label>
              <input
                type="number"
                name="discount"
                value={formData.discount}
                onChange={handleChange}
                placeholder="0 - 100"
                min="0"
                max="100"
              />
            </div>
            <div className="admin-form-group">
              <label>Tồn kho</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="VD: 100"
                min="0"
              />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group flex-2">
              <label>Link ảnh bìa (URL)</label>
              <input
                type="text"
                name="image"
                value={formData.image}
                onChange={handleChange}
                placeholder="https://..."
              />
            </div>
            <div className="admin-form-group flex-1">
              <label>Ngày xuất bản</label>
              <input
                type="date"
                name="publication_date"
                value={formData.publication_date}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="admin-form-group">
            <label>Phân loại thể loại</label>
            <div className="admin-category-selector">
              {categories.length === 0 ? (
                <span className="admin-text-muted">Chưa có thể loại nào trong hệ thống.</span>
              ) : (
                categories.map((cat) => {
                  const isChecked = formData.categoryIds.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`admin-tag-checkbox ${isChecked ? 'selected' : ''}`}
                      onClick={() => handleCategoryToggle(cat.id)}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {cat.name}
                    </button>
                  )
                })
              )}
            </div>
          </div>
          <div className="admin-form-group">
            <label>Tóm tắt / Giới thiệu</label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              placeholder="Giới thiệu nội dung, cốt truyện hoặc thông điệp của cuốn sách..."
            />
          </div>
          <div className="admin-modal-actions">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="admin-btn-primary" disabled={submitting}>
              {submitting ? 'Đang lưu...' : mode === 'edit' ? 'Cập nhật' : 'Thêm ấn phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdminBookModal({ isOpen, mode, book, categories = [], onClose, onSave }) {
  if (!isOpen) return null

  return (
    <BookModalContent
      key={mode === 'edit' && book ? book.id : 'create'}
      mode={mode}
      book={book}
      categories={categories}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

export default AdminBookModal
