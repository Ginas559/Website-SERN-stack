import axiosClient from './axiosClient'

const shipperService = {
  getAssignments: (params = {}) => axiosClient.get('/shipper/assignments', { params }),
  acceptAssignment: (assignmentId) => axiosClient.patch(`/shipper/assignments/${assignmentId}/accept`),
  rejectAssignment: (assignmentId, reason) => axiosClient.patch(`/shipper/assignments/${assignmentId}/reject`, { reason }),
  completeAssignment: (assignmentId, note = '', codCollected = false) => axiosClient.patch(`/shipper/assignments/${assignmentId}/complete`, { note, codCollected }),
}

export default shipperService
