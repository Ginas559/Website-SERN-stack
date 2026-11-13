import { useEffect, useState } from 'react'
import orderService from '../services/orderService'

export const DEFAULT_SHIPPING_RULE = Object.freeze({
  freeThreshold: 250000,
  standardFee: 25000,
})

const SHIPPING_RULE_CACHE_TTL_MS = 30000
const FOCUS_SYNC_COOLDOWN_MS = 2000

let cachedShippingRule = null
let cacheLoadedAt = 0
let shippingRulePromise = null
const shippingRuleListeners = new Set()

function normalizeShippingRule(rule) {
  const freeThreshold = Number(rule?.freeThreshold)
  const standardFee = Number(rule?.standardFee)
  if (!Number.isFinite(freeThreshold) || freeThreshold < 0 || !Number.isFinite(standardFee) || standardFee < 0) {
    return DEFAULT_SHIPPING_RULE
  }
  return { freeThreshold, standardFee }
}

function notifyShippingRuleListeners(rule) {
  shippingRuleListeners.forEach((listener) => {
    try {
      listener(rule)
    } catch {
      return
    }
  })
}

export function invalidateShippingRuleCache(nextRule = null) {
  shippingRulePromise = null
  if (nextRule) {
    const normalized = normalizeShippingRule(nextRule)
    cachedShippingRule = normalized
    cacheLoadedAt = Date.now()
    notifyShippingRuleListeners(normalized)
    return normalized
  }
  cachedShippingRule = null
  cacheLoadedAt = 0
  return null
}

export function loadShippingRule({ force = false } = {}) {
  const now = Date.now()
  if (!force && cachedShippingRule && now - cacheLoadedAt < SHIPPING_RULE_CACHE_TTL_MS) {
    return Promise.resolve(cachedShippingRule)
  }
  if (!shippingRulePromise) {
    shippingRulePromise = orderService
      .getShippingRule()
      .then((res) => {
        const rawRule = res?.data || res
        const normalized = normalizeShippingRule(rawRule)
        cachedShippingRule = normalized
        cacheLoadedAt = Date.now()
        shippingRulePromise = null
        notifyShippingRuleListeners(normalized)
        return normalized
      })
      .catch(() => {
        shippingRulePromise = null
        return cachedShippingRule || DEFAULT_SHIPPING_RULE
      })
  }
  return shippingRulePromise
}

export function useShippingRule() {
  const [shippingRule, setShippingRule] = useState(() => cachedShippingRule || DEFAULT_SHIPPING_RULE)

  useEffect(() => {
    let active = true
    const handleRuleUpdate = (nextRule) => {
      if (active) {
        setShippingRule(nextRule)
      }
    }
    shippingRuleListeners.add(handleRuleUpdate)
    loadShippingRule().then((rule) => {
      if (active) {
        setShippingRule(rule)
      }
    })
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      if (Date.now() - cacheLoadedAt >= FOCUS_SYNC_COOLDOWN_MS) {
        loadShippingRule({ force: true })
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    }
    return () => {
      active = false
      shippingRuleListeners.delete(handleRuleUpdate)
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      }
    }
  }, [])

  return shippingRule
}

export function calculateDiscountedUnitPrice(price, discount = 0) {
  const rawPrice = Math.max(0, Number(price) || 0)
  const rate = Math.max(0, Math.min(100, Number(discount) || 0))
  if (rate <= 0) return rawPrice
  return Math.round((rawPrice * (100 - rate)) / 100)
}

export function calculateSelectedItemsTotals(items = []) {
  let selectedCount = 0
  let subtotal = 0

  items.forEach((item) => {
    const unitPrice = calculateDiscountedUnitPrice(item.price, item.discount)
    const qty = Math.max(1, Number(item.quantity) || 1)
    selectedCount += qty
    subtotal += unitPrice * qty
  })

  return { selectedCount, subtotal }
}

export function calculateShippingFee(subtotal, shippingRule = DEFAULT_SHIPPING_RULE) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0)
  const normalizedRule = normalizeShippingRule(shippingRule)
  if (safeSubtotal === 0 || safeSubtotal >= normalizedRule.freeThreshold) {
    return 0
  }
  return normalizedRule.standardFee
}

export function getPaymentMethodLabel(paymentMethod, variant = 'full') {
  const normalized = String(paymentMethod || 'COD').trim().toUpperCase()
  if (normalized === 'VNPAY') {
    if (variant === 'compact') return 'VNPAY'
    if (variant === 'checkout') return 'Cổng thanh toán VNPAY'
    return 'VNPAY Sandbox'
  }
  if (normalized === 'BANK') {
    return variant === 'compact' ? 'Chuyển khoản' : 'Chuyển khoản (Ngừng hỗ trợ)'
  }
  return variant === 'compact' ? 'COD' : 'Thanh toán khi nhận hàng (COD)'
}
