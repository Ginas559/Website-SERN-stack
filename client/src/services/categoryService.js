import axiosClient from './axiosClient'

const categoryService = {
  getPublicAll: () => axiosClient.get('/categories'),
  getPublicById: (id) => axiosClient.get(`/categories/${id}`),
  getAll: (params) => axiosClient.get('/admin/categories', { params }),
  getById: (id) => axiosClient.get(`/admin/categories/${id}`),
  create: (data) => axiosClient.post('/admin/categories', data),
  update: (id, data) => axiosClient.put(`/admin/categories/${id}`, data),
  updateStatus: (id, isDelete) => axiosClient.patch(`/admin/categories/${id}/status`, { isDelete }),
}

export default categoryService
