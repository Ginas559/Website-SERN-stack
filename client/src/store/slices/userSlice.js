import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import userService from '../../services/userService'

export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await userService.getProfile()
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateUserProfile = createAsyncThunk(
  'user/updateProfile',
  async (data, { rejectWithValue }) => {
    try {
      const response = await userService.updateProfile(data)
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchAccountStatus = createAsyncThunk(
  'user/fetchAccountStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await userService.getAccountStatus()
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const initialState = {
  profile: null,
  status: null,
  loading: false,
  updating: false,
  error: null,
  successMessage: '',
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setProfile: (state, action) => {
      state.profile = action.payload
    },
    clearUserState: (state) => {
      state.profile = null
      state.status = null
      state.loading = false
      state.updating = false
      state.error = null
      state.successMessage = ''
    },
    clearUserFeedback: (state) => {
      state.error = null
      state.successMessage = ''
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false
        state.profile = action.payload
        state.error = null
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.updating = true
        state.error = null
        state.successMessage = ''
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.updating = false
        state.profile = action.payload
        state.successMessage = 'Cập nhật thông tin cá nhân thành công.'
        state.error = null
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.updating = false
        state.error = action.payload
      })
      .addCase(fetchAccountStatus.fulfilled, (state, action) => {
        state.status = action.payload
      })
  },
})

export const { setProfile, clearUserState, clearUserFeedback } = userSlice.actions
export default userSlice.reducer

