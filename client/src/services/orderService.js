import axiosClient from './axiosClient'

const orderService = {
  createOrder: (data) => axiosClient.post('/orders', data),
  getPaymentUrl: (orderId, returnUrl) => axiosClient.post(`/orders/${orderId}/payment-url`, { returnUrl }),
  verifyPaymentReturn: (searchString) => {
    const cleanQuery = searchString.startsWith('?') ? searchString.slice(1) : searchString
    return axiosClient.get(`/orders/vnpay/return?${cleanQuery}`)
  },
  getUserOrders: (params = {}) => axiosClient.get('/orders', { params }),
  getOrderDetails: (orderId) => axiosClient.get(`/orders/${orderId}`),
  cancelOrder: (orderId, reason = '') => axiosClient.patch(`/orders/${orderId}/cancel`, { reason }),
  reorder: (orderId) => axiosClient.post(`/orders/${orderId}/reorder`),
  getAdminOrders: (params = {}) => axiosClient.get('/orders/admin', { params }),
  updateOrderStatus: (orderId, data) => axiosClient.patch(`/orders/${orderId}/status`, data),
}

export default orderService
