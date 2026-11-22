import axiosClient from './axiosClient'

const cartService = {
  getCart: () => axiosClient.get('/cart'),
  addItem: (bookId, quantity = 1) => axiosClient.post('/cart/items', { bookId, quantity }),
  updateQuantity: (bookId, quantity) => axiosClient.put(`/cart/items/${bookId}`, { quantity }),
  removeItem: (bookId) => axiosClient.delete(`/cart/items/${bookId}`),
  clearCart: () => axiosClient.delete('/cart'),
  getSummary: () => axiosClient.get('/cart/summary'),
  validateCart: () => axiosClient.get('/cart/validate'),
}

export default cartService

