import { useState, useEffect, useCallback } from 'react'
import storePolicyService from '../services/storePolicyService'
import { DEFAULT_SHIPPING_RULE, invalidateShippingRuleCache } from '../utils/pricing'

function formatVnd(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

function evaluatePolicyRisks(fee, threshold) {
  if (
    !Number.isInteger(fee) ||
    fee < 0 ||
    fee > 10000000 ||
    !Number.isInteger(threshold) ||
    threshold < 0 ||
    threshold > 1000000000
  ) {
    return { severity: 'none', risks: [] }
  }

  const risks = []
  let severity = 'none'
  const markSeverity = (level) => {
    if (level === 'danger') {
      severity = 'danger'
    } else if (level === 'warning' && severity === 'none') {
      severity = 'warning'
    }
  }

  if (fee === 0 || threshold === 0) {
    markSeverity('danger')
    risks.push('Đang áp dụng Freeship 0 đ cho toàn bộ đơn hàng mới — cửa hàng sẽ tự chịu 100% chi phí vận chuyển.')
  }
  if (fee > 0 && fee < 10000) {
    markSeverity('danger')
    risks.push(`Phí giao hàng tiêu chuẩn (${formatVnd(fee)}) quá thấp (dưới 10.000 đ) — dễ gây bù lỗ phí vận chuyển hoặc do gõ thiếu số 0.`)
  } else if (fee > 100000) {
    markSeverity('danger')
    risks.push(`Phí giao hàng tiêu chuẩn (${formatVnd(fee)}) quá cao (trên 100.000 đ) — dễ làm khách hàng hủy đơn hoặc do gõ thừa số 0.`)
  } else if (fee >= 50000) {
    markSeverity('warning')
    risks.push(`Phí giao hàng tiêu chuẩn (${formatVnd(fee)}) cao hơn mặt bằng phổ thông (25.000 đ - 45.000 đ).`)
  }

  if (fee > 0 && threshold > 0 && fee >= threshold) {
    markSeverity('danger')
    risks.push(`Phí giao hàng (${formatVnd(fee)}) đang lớn hơn hoặc bằng ngưỡng miễn phí ship (${formatVnd(threshold)}), gây mâu thuẫn chính sách.`)
  }

  if (threshold > 0 && threshold < 100000) {
    markSeverity('danger')
    risks.push(`Ngưỡng miễn phí ship (${formatVnd(threshold)}) quá rẻ (dưới 100.000 đ) — đơn sách nhỏ cũng được freeship, có nguy cơ hụt lợi nhuận.`)
  } else if (threshold > 2000000) {
    markSeverity('warning')
    risks.push(`Ngưỡng miễn phí ship (${formatVnd(threshold)}) quá cao (trên 2.000.000 đ) — khách hàng rất khó đạt freeship, có thể giảm tỷ lệ chốt đơn.`)
  } else if (threshold >= 100000 && threshold < 150000) {
    markSeverity('warning')
    risks.push(`Ngưỡng miễn phí ship (${formatVnd(threshold)}) thấp hơn đáng kể so với mức mặc định (250.000 đ).`)
  }

  return { severity, risks }
}

function AdminShippingPolicyCard({ onShowToast }) {
  const [standardFee, setStandardFee] = useState(String(DEFAULT_SHIPPING_RULE.standardFee))
  const [freeThreshold, setFreeThreshold] = useState(String(DEFAULT_SHIPPING_RULE.freeThreshold))
  const [savedSnapshot, setSavedSnapshot] = useState({
    standardFee: DEFAULT_SHIPPING_RULE.standardFee,
    freeThreshold: DEFAULT_SHIPPING_RULE.freeThreshold,
    updatedAt: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState(null)

  const applyPolicyState = useCallback((policy) => {
    const nextFee = Number(policy?.standardFee ?? DEFAULT_SHIPPING_RULE.standardFee)
    const nextThreshold = Number(policy?.freeThreshold ?? DEFAULT_SHIPPING_RULE.freeThreshold)
    const nextUpdatedAt = policy?.updatedAt || null
    setStandardFee(String(nextFee))
    setFreeThreshold(String(nextThreshold))
    setPendingConfirm(null)
    setSavedSnapshot({
      standardFee: nextFee,
      freeThreshold: nextThreshold,
      updatedAt: nextUpdatedAt,
    })
  }, [])

  const fetchLatestPolicy = useCallback(() => {
    setLoading(true)
    setFormError('')
    return storePolicyService
      .getAdminShippingPolicy()
      .then((res) => {
        const policy = res?.data || res
        applyPolicyState(policy)
        invalidateShippingRuleCache(policy)
      })
      .catch((err) => {
        setFormError(err.message || 'Không thể tải chính sách vận chuyển hiện hành.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [applyPolicyState])

  useEffect(() => {
    let active = true
    storePolicyService
      .getAdminShippingPolicy()
      .then((res) => {
        if (!active) return
        const policy = res?.data || res
        applyPolicyState(policy)
        invalidateShippingRuleCache(policy)
      })
      .catch((err) => {
        if (!active) return
        setFormError(err.message || 'Không thể tải chính sách vận chuyển hiện hành.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [applyPolicyState])

  const parsedFee = standardFee === '' ? NaN : Number(standardFee)
  const parsedThreshold = freeThreshold === '' ? NaN : Number(freeThreshold)
  const isDirty =
    parsedFee !== savedSnapshot.standardFee ||
    parsedThreshold !== savedSnapshot.freeThreshold
  const isDefaultInForm =
    parsedFee === DEFAULT_SHIPPING_RULE.standardFee &&
    parsedThreshold === DEFAULT_SHIPPING_RULE.freeThreshold
  const isFreeshipInForm = parsedFee === 0 && parsedThreshold === 0
  const liveRisk = evaluatePolicyRisks(parsedFee, parsedThreshold)

  const handleResetToSaved = () => {
    setFormError('')
    setPendingConfirm(null)
    setStandardFee(String(savedSnapshot.standardFee))
    setFreeThreshold(String(savedSnapshot.freeThreshold))
  }

  const handleApplyDefaultPreset = () => {
    setFormError('')
    setPendingConfirm(null)
    setStandardFee(String(DEFAULT_SHIPPING_RULE.standardFee))
    setFreeThreshold(String(DEFAULT_SHIPPING_RULE.freeThreshold))
  }

  const handleApplyFreeShipPreset = () => {
    setFormError('')
    setPendingConfirm(null)
    setStandardFee('0')
    setFreeThreshold('0')
  }

  const commitPolicyUpdate = async (targetFee = parsedFee, targetThreshold = parsedThreshold) => {
    setSaving(true)
    try {
      const res = await storePolicyService.updateAdminShippingPolicy({
        standardFee: targetFee,
        freeThreshold: targetThreshold,
        expectedUpdatedAt: savedSnapshot.updatedAt,
      })
      const updated = res?.data || res
      applyPolicyState(updated)
      invalidateShippingRuleCache(updated)
      if (onShowToast) {
        onShowToast(res?.message || 'Cập nhật chính sách vận chuyển toàn shop thành công.', 'success')
      }
    } catch (err) {
      setPendingConfirm(null)
      const status = err?.status || err?.response?.status
      const message = err?.message || err?.response?.data?.message || 'Không thể cập nhật chính sách vận chuyển.'
      setFormError(message)
      if (onShowToast) {
        onShowToast(message, 'error')
      }
      if (status === 409) {
        fetchLatestPolicy()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setPendingConfirm(null)

    if (!Number.isInteger(parsedFee) || parsedFee < 0 || parsedFee > 10000000) {
      setFormError('Phí giao hàng tiêu chuẩn phải là số nguyên từ 0 đến 10.000.000đ.')
      return
    }

    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1000000000) {
      setFormError('Ngưỡng miễn phí vận chuyển phải là số nguyên từ 0 đến 1.000.000.000đ.')
      return
    }

    const evaluation = evaluatePolicyRisks(parsedFee, parsedThreshold)
    if (evaluation.risks.length > 0) {
      setPendingConfirm({
        standardFee: parsedFee,
        freeThreshold: parsedThreshold,
        severity: evaluation.severity,
        risks: evaluation.risks,
      })
      return
    }

    await commitPolicyUpdate(parsedFee, parsedThreshold)
  }

  const isGlobalFreeShip = savedSnapshot.standardFee === 0 || savedSnapshot.freeThreshold === 0
  const feePreviewText =
    Number.isInteger(parsedFee) && parsedFee >= 0
      ? `Hiển thị: ${formatVnd(parsedFee)}${parsedFee === 0 ? ' (Miễn phí toàn shop)' : ''}`
      : 'Vui lòng nhập số nguyên không âm'
  const thresholdPreviewText =
    Number.isInteger(parsedThreshold) && parsedThreshold >= 0
      ? `Hiển thị: ${formatVnd(parsedThreshold)}${parsedThreshold === 0 ? ' (Freeship mọi đơn hàng)' : ''}`
      : 'Vui lòng nhập số nguyên không âm'

  return (
    <section className="admin-policy-card">
      <div className="admin-policy-header">
        <div>
          <h3 className="admin-policy-title">🚚 Chính sách vận chuyển &amp; Freeship toàn shop</h3>
          <p className="admin-policy-subtitle">
            {loading
              ? 'Đang tải cấu hình từ SQL Server...'
              : isGlobalFreeShip
                ? 'Đang áp dụng: Miễn phí vận chuyển cho toàn bộ đơn hàng'
                : `Đang áp dụng: Phí chuẩn ${formatVnd(savedSnapshot.standardFee)} • Miễn phí ship cho đơn từ ${formatVnd(savedSnapshot.freeThreshold)}`}
          </p>
        </div>
        <div className="admin-policy-presets">
          <button
            type="button"
            className="admin-policy-preset-btn admin-policy-default-btn"
            disabled={loading || saving || isDefaultInForm}
            onClick={handleApplyDefaultPreset}
          >
            ↺ Mặc định ({formatVnd(DEFAULT_SHIPPING_RULE.standardFee)} / {formatVnd(DEFAULT_SHIPPING_RULE.freeThreshold)})
          </button>
          <button
            type="button"
            className="admin-policy-preset-btn"
            disabled={loading || saving || isFreeshipInForm}
            onClick={handleApplyFreeShipPreset}
          >
            ⚡ Freeship toàn shop (0đ)
          </button>
        </div>
      </div>

      <form className="admin-policy-form" onSubmit={handleSubmit}>
        <div className="admin-policy-fields">
          <label className="admin-policy-field">
            <span>Phí giao hàng tiêu chuẩn (VNĐ)</span>
            <input
              type="number"
              min="0"
              max="10000000"
              step="1000"
              value={standardFee}
              disabled={loading || saving}
              onChange={(e) => {
                setFormError('')
                setPendingConfirm(null)
                setStandardFee(e.target.value)
              }}
            />
            <small className="admin-policy-hint">{feePreviewText}</small>
          </label>

          <label className="admin-policy-field">
            <span>Ngưỡng đơn hàng miễn phí ship (VNĐ)</span>
            <input
              type="number"
              min="0"
              max="1000000000"
              step="10000"
              value={freeThreshold}
              disabled={loading || saving}
              onChange={(e) => {
                setFormError('')
                setPendingConfirm(null)
                setFreeThreshold(e.target.value)
              }}
            />
            <small className="admin-policy-hint">{thresholdPreviewText}</small>
          </label>
        </div>

        <div className="admin-policy-actions">
          {isDirty && (
            <button
              type="button"
              className="admin-btn-reset-filters"
              disabled={saving}
              onClick={handleResetToSaved}
            >
              Hoàn tác
            </button>
          )}
          <button
            type="submit"
            className="admin-policy-save-btn"
            disabled={loading || saving || !isDirty}
          >
            {saving ? 'Đang lưu...' : 'Lưu chính sách'}
          </button>
        </div>
      </form>

      {isDirty && liveRisk.risks.length > 0 && (
        <div className={`admin-policy-alert ${liveRisk.severity}`}>
          <strong>
            {liveRisk.severity === 'danger'
              ? '🚨 Cảnh báo rủi ro ảnh hưởng doanh thu cửa hàng:'
              : '⚠️ Lưu ý mức phí/ngưỡng khác thường:'}
          </strong>
          <ul>
            {liveRisk.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {formError && <p className="admin-policy-error">{formError}</p>}

      {pendingConfirm && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            if (!saving) {
              setPendingConfirm(null)
            }
          }}
        >
          <div
            className="admin-modal-box block-confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2
                className="admin-modal-title"
                style={{ color: pendingConfirm.severity === 'danger' ? '#f87171' : '#f3c57e' }}
              >
                {pendingConfirm.severity === 'danger'
                  ? '🚨 Xác nhận thay đổi rủi ro cao'
                  : '⚠️ Xác nhận cập nhật chính sách'}
              </h2>
              <button
                type="button"
                className="admin-modal-close"
                disabled={saving}
                onClick={() => setPendingConfirm(null)}
              >
                &times;
              </button>
            </div>

            <div className="admin-modal-form">
              <div className="admin-policy-modal-compare">
                <div className="admin-policy-compare-box">
                  <span className="admin-policy-compare-label">Đang áp dụng</span>
                  <span>Phí chuẩn: <strong>{formatVnd(savedSnapshot.standardFee)}</strong></span>
                  <span>Freeship từ: <strong>{formatVnd(savedSnapshot.freeThreshold)}</strong></span>
                </div>
                <div className="admin-policy-compare-box next">
                  <span className="admin-policy-compare-label">Sắp thay đổi thành</span>
                  <span>Phí chuẩn: <strong>{formatVnd(pendingConfirm.standardFee)}</strong></span>
                  <span>Freeship từ: <strong>{formatVnd(pendingConfirm.freeThreshold)}</strong></span>
                </div>
              </div>

              <div className={`admin-policy-alert ${pendingConfirm.severity}`} style={{ marginTop: 0 }}>
                <strong>Các điểm cần kiểm tra kỹ trước khi áp dụng:</strong>
                <ul>
                  {pendingConfirm.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>

              <p className="admin-policy-modal-note">
                Thay đổi chỉ áp dụng cho giỏ hàng và các đơn hàng tạo mới sau thời điểm lưu; toàn bộ đơn đã đặt trước đó vẫn giữ nguyên số tiền ban đầu.
              </p>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn-reset-filters"
                  disabled={saving}
                  onClick={() => setPendingConfirm(null)}
                >
                  Hủy, để sửa lại
                </button>
                <button
                  type="button"
                  className={pendingConfirm.severity === 'danger' ? 'admin-btn-danger' : 'admin-policy-save-btn'}
                  disabled={saving}
                  onClick={() => commitPolicyUpdate(pendingConfirm.standardFee, pendingConfirm.freeThreshold)}
                >
                  {saving ? 'Đang lưu...' : 'Tôi hiểu rủi ro, Xác nhận lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AdminShippingPolicyCard
