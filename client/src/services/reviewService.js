import axiosClient from './axiosClient'

export const getMyReviewedBookIds = async () => {
  const res = await axiosClient.get('/reviews/my-reviewed-books')
  return res.data || res || []
}

const reviewService = {
  getMyReviewedBookIds,
  getBookReviews: (bookId, params) => axiosClient.get(`/books/${bookId}/reviews`, { params }),
  createReview: (bookId, data) => axiosClient.post(`/books/${bookId}/reviews`, data),
  updateReview: (id, data) => axiosClient.put(`/reviews/${id}`, data),
  deleteReview: (id) => axiosClient.delete(`/reviews/${id}`),
  adminGetReviews: (params) => axiosClient.get('/admin/reviews', { params }),
  adminChangeReviewStatus: (id, isDelete) => axiosClient.patch(`/admin/reviews/${id}/status`, { isDelete })
}

export default reviewService
