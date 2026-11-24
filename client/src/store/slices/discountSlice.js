import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import discountService from '../../services/discountService'

export const fetchActiveDiscounts = createAsyncThunk(
  'discount/fetchActiveDiscounts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await discountService.getActiveDiscounts(params)
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const validatePromotion = createAsyncThunk(
  'discount/validatePromotion',
  async ({ code, subtotal, shippingFee = 0 }, { rejectWithValue }) => {
    try {
      const response = await discountService.validatePromotion({ code, subtotal, shippingFee })
      return response.data || response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const initialState = {
  activeDiscounts: [],
  appliedCoupon: null,
  loading: false,
  validating: false,
  error: null,
  successMessage: '',
}

const discountSlice = createSlice({
  name: 'discount',
  initialState,
  reducers: {
    setAppliedCoupon: (state, action) => {
      state.appliedCoupon = action.payload
    },
    clearAppliedCoupon: (state) => {
      state.appliedCoupon = null
      state.error = null
      state.successMessage = ''
    },
    clearCouponFeedback: (state) => {
      state.error = null
      state.successMessage = ''
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveDiscounts.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchActiveDiscounts.fulfilled, (state, action) => {
        state.loading = false
        state.activeDiscounts = Array.isArray(action.payload)
          ? action.payload
          : action.payload?.discounts || []
      })
      .addCase(fetchActiveDiscounts.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(validatePromotion.pending, (state) => {
        state.validating = true
        state.error = null
        state.successMessage = ''
      })
      .addCase(validatePromotion.fulfilled, (state, action) => {
        state.validating = false
        state.appliedCoupon = action.payload
        state.successMessage = action.payload?.message || 'Áp dụng mã khuyến mãi thành công.'
        state.error = null
      })
      .addCase(validatePromotion.rejected, (state, action) => {
        state.validating = false
        state.appliedCoupon = null
        state.error = action.payload
      })
  },
})

export const { setAppliedCoupon, clearAppliedCoupon, clearCouponFeedback } = discountSlice.actions
export default discountSlice.reducer

