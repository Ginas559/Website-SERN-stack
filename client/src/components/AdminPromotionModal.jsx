import { useState } from 'react'

function toInputDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return ''
  }
}

function PromotionModalContent({
  mode = 'create',
  promotion = null,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState(() => {
    if (mode === 'edit' && promotion) {
      return {
        code: promotion.code || '',
        discount_type: promotion.discount_type || 'PERCENT',
        value: promotion.value !== undefined ? String(promotion.value) : '',
        maxDiscountValue: promotion.maxDiscountValue !== null && promotion.maxDiscountValue !== undefined ? String(promotion.maxDiscountValue) : '',
        minimumOrderValue: promotion.minimumOrderValue !== undefined ? String(promotion.minimumOrderValue) : '0',
        quantity: promotion.quantity !== undefined ? String(promotion.quantity) : '100',
        description: promotion.description || '',
        startDate: toInputDate(promotion.startDate),
        expiredAt: toInputDate(promotion.expiredAt),
      }
    }
    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setDate(today.getDate() + 30)

    return {
      code: '',
      discount_type: 'PERCENT',
      value: '',
      maxDiscountValue: '',
      minimumOrderValue: '0',
      quantity: '100',
      description: '',
      startDate: toInputDate(today),
      expiredAt: toInputDate(nextMonth),
    }
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const newErrors = {}
    const cleanCode = formData.code.trim().toUpperCase()
    if (!cleanCode) {
      newErrors.code = 'Vui lòng nhập mã khuyến mãi.'
    } else if (cleanCode.length > 50) {
      newErrors.code = 'Mã khuyến mãi không được vượt quá 50 ký tự.'
    }

    const valNum = Number(formData.value)
    if (!formData.value || isNaN(valNum) || valNum <= 0) {
      newErrors.value = 'Mức giảm phải là số lớn hơn 0.'
    } else if (formData.discount_type === 'PERCENT' && valNum > 100) {
      newErrors.value = 'Mức giảm phần trăm không được vượt quá 100%.'
    }

    if (formData.discount_type === 'PERCENT' && formData.maxDiscountValue) {
      const maxVal = Number(formData.maxDiscountValue)
      if (isNaN(maxVal) || maxVal < 0) {
        newErrors.maxDiscountValue = 'Giảm tối đa không được âm.'
      }
    }

    const minOrder = Number(formData.minimumOrderValue)
    if (isNaN(minOrder) || minOrder < 0) {
      newErrors.minimumOrderValue = 'Giá trị đơn tối thiểu không được âm.'
    }

    const qty = Number(formData.quantity)
    if (!formData.quantity || isNaN(qty) || qty < 1) {
      newErrors.quantity = 'Số lượng phát hành phải từ 1 trở lên.'
    }

    if (formData.description && formData.description.length > 255) {
      newErrors.description = 'Mô tả không được vượt quá 255 ký tự.'
    }

    if (formData.startDate && formData.expiredAt) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.expiredAt)
      if (end < start) {
        newErrors.expiredAt = 'Ngày kết thúc không được trước ngày bắt đầu.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        discount_type: formData.discount_type,
        value: Number(formData.value),
        maxDiscountValue: formData.discount_type === 'PERCENT' && formData.maxDiscountValue ? Number(formData.maxDiscountValue) : null,
        minimumOrderValue: Number(formData.minimumOrderValue) || 0,
        quantity: Number(formData.quantity) || 100,
        description: formData.description ? formData.description.trim() : null,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        expiredAt: formData.expiredAt ? new Date(formData.expiredAt).toISOString() : null,
      }
      await onSave(payload, mode === 'edit' ? promotion.id : null)
      onClose()
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err.message || 'Lỗi khi lưu mã khuyến mãi.',
      }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-box">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">
            {mode === 'edit' ? 'Chỉnh sửa Mã Khuyến Mãi' : 'Thêm Mã Khuyến Mãi Mới'}
          </h2>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {errors.submit && (
          <div className="admin-modal-error-banner">{errors.submit}</div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="admin-modal-form">
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label className="admin-form-label">
                Mã Khuyến Mãi <span className="req">*</span>
              </label>
              <input
                type="text"
                className={`admin-form-input ${errors.code ? 'has-error' : ''}`}
                placeholder="VD: BOOK10, FREESHIP"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
              />
              {errors.code && <span className="admin-form-error">{errors.code}</span>}
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Loại Giảm Giá <span className="req">*</span>
              </label>
              <select
                className="admin-form-select"
                value={formData.discount_type}
                onChange={(e) =>
                  setFormData({ ...formData, discount_type: e.target.value })
                }
              >
                <option value="PERCENT">Giảm theo phần trăm (%)</option>
                <option value="FIXED">Giảm tiền cố định (VNĐ)</option>
              </select>
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label className="admin-form-label">
                Mức Giảm Giá <span className="req">*</span>
              </label>
              <input
                type="number"
                className={`admin-form-input ${errors.value ? 'has-error' : ''}`}
                placeholder={formData.discount_type === 'PERCENT' ? 'VD: 15 (nghĩa là 15%)' : 'VD: 50000'}
                value={formData.value}
                onChange={(e) =>
                  setFormData({ ...formData, value: e.target.value })
                }
              />
              {errors.value && <span className="admin-form-error">{errors.value}</span>}
            </div>

            {formData.discount_type === 'PERCENT' && (
              <div className="admin-form-group">
                <label className="admin-form-label">Giảm Tối Đa (VNĐ)</label>
                <input
                  type="number"
                  className={`admin-form-input ${errors.maxDiscountValue ? 'has-error' : ''}`}
                  placeholder="VD: 50000 (để trống nếu không giới hạn)"
                  value={formData.maxDiscountValue}
                  onChange={(e) =>
                    setFormData({ ...formData, maxDiscountValue: e.target.value })
                  }
                />
                {errors.maxDiscountValue && (
                  <span className="admin-form-error">{errors.maxDiscountValue}</span>
                )}
              </div>
            )}
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label className="admin-form-label">Đơn Hàng Tối Thiểu (VNĐ)</label>
              <input
                type="number"
                className={`admin-form-input ${errors.minimumOrderValue ? 'has-error' : ''}`}
                placeholder="VD: 100000"
                value={formData.minimumOrderValue}
                onChange={(e) =>
                  setFormData({ ...formData, minimumOrderValue: e.target.value })
                }
              />
              {errors.minimumOrderValue && (
                <span className="admin-form-error">{errors.minimumOrderValue}</span>
              )}
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Số Lượng Phát Hành <span className="req">*</span>
              </label>
              <input
                type="number"
                className={`admin-form-input ${errors.quantity ? 'has-error' : ''}`}
                placeholder="VD: 100"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
              />
              {errors.quantity && (
                <span className="admin-form-error">{errors.quantity}</span>
              )}
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label className="admin-form-label">Ngày Bắt Đầu</label>
              <input
                type="date"
                className="admin-form-input"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Ngày Kết Thúc (Hết Hạn)</label>
              <input
                type="date"
                className={`admin-form-input ${errors.expiredAt ? 'has-error' : ''}`}
                value={formData.expiredAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiredAt: e.target.value })
                }
              />
              {errors.expiredAt && (
                <span className="admin-form-error">{errors.expiredAt}</span>
              )}
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Mô Tả Khuyến Mãi</label>
            <textarea
              className={`admin-form-textarea ${errors.description ? 'has-error' : ''}`}
              rows="3"
              placeholder="VD: Giảm 15% cho đơn hàng đầu tiên từ 150.000đ"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            {errors.description && (
              <span className="admin-form-error">{errors.description}</span>
            )}
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
              className="admin-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdminPromotionModal({
  isOpen,
  mode = 'create',
  promotion = null,
  onClose,
  onSave,
}) {
  if (!isOpen) return null

  return (
    <PromotionModalContent
      key={mode === 'edit' && promotion ? promotion.id : 'create'}
      mode={mode}
      promotion={promotion}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

export default AdminPromotionModal
