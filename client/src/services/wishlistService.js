import axiosClient from './axiosClient'

const wishlistService = {
  getWishlist: () => axiosClient.get('/wishlist'),
  addItem: (bookId) => axiosClient.post('/wishlist/items', { bookId }),
  removeItem: (bookId) => axiosClient.delete(`/wishlist/items/${bookId}`),
  clearWishlist: () => axiosClient.delete('/wishlist'),
}

export default wishlistService

