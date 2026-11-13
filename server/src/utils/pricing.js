const SHIPPING_RULE = Object.freeze({
    freeThreshold: 250000,
    standardFee: 25000
});

const SUPPORTED_PAYMENT_METHODS = Object.freeze(["COD", "VNPAY"]);

function calculateDiscountedUnitPrice(price, discount = 0) {
    const rawPrice = Math.max(0, Number(price) || 0);
    const rate = Math.max(0, Math.min(100, Number(discount) || 0));
    if (rate <= 0) return rawPrice;
    return Math.round(rawPrice * (1 - rate / 100));
}

function calculateShippingFee(subtotal, rule = SHIPPING_RULE) {
    const safeSubtotal = Math.max(0, Number(subtotal) || 0);
    if (safeSubtotal === 0 || safeSubtotal >= rule.freeThreshold) {
        return 0;
    }
    return rule.standardFee;
}

function calculateSelectedItemsTotals(items = []) {
    let subtotal = 0;
    let totalQuantity = 0;
    const lineItems = [];

    for (const item of items) {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = calculateDiscountedUnitPrice(item.price, item.discount);
        const lineTotal = unitPrice * qty;

        subtotal += lineTotal;
        totalQuantity += qty;
        lineItems.push({
            bookId: item.book_id ?? item.bookId ?? item.id,
            quantity: qty,
            unitPrice,
            total: lineTotal
        });
    }

    return { subtotal, totalQuantity, lineItems };
}

function isShippingPromotion(discount) {
    const cleanCode = String(discount?.code || "").trim().toUpperCase();
    return cleanCode.startsWith("FREESHIP");
}

module.exports = {
    SHIPPING_RULE,
    SUPPORTED_PAYMENT_METHODS,
    calculateDiscountedUnitPrice,
    calculateShippingFee,
    calculateSelectedItemsTotals,
    isShippingPromotion
};

