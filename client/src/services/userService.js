import axiosClient from './axiosClient'

const userService = {
  getAdminUsers: (params = {}) => axiosClient.get('/admin/users', { params }),
  getAdminUserById: (id) => axiosClient.get(`/admin/users/${id}`),
  changeUserStatus: (id, data) => axiosClient.patch(`/admin/users/${id}/status`, data),
  blockUser: (id, data) => axiosClient.patch(`/admin/users/${id}/block`, data),
  restoreUser: (id) => axiosClient.patch(`/admin/users/${id}/restore`),
  getProfile: () => axiosClient.get('/users/profile'),
  updateProfile: (data) => axiosClient.put('/users/profile', data),
  getAccountStatus: () => axiosClient.get('/users/status'),
}

export default userService

