import axiosClient from './axiosClient'

const bookService = {
  getAll: (params) => axiosClient.get('/books', { params }),
  getById: (id) => axiosClient.get(`/books/${id}`),
  getAdminBooks: (params) => axiosClient.get('/admin/books', { params }),
  create: (data) => axiosClient.post('/admin/books', data),
  update: (id, data) => axiosClient.put(`/admin/books/${id}`, data),
  updateStatus: (id, isDelete) => axiosClient.patch(`/admin/books/${id}/status`, { isDelete }),
}

export default bookService
