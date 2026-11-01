import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import cartService from '../../services/cartService'

export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { rejectWithValue }) => {
    try {
      return await cartService.getCart()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async ({ bookId, quantity = 1 }, { rejectWithValue }) => {
    try {
      return await cartService.addItem(bookId, quantity)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async ({ bookId, quantity }, { rejectWithValue }) => {
    try {
      return await cartService.updateQuantity(bookId, quantity)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async (bookId, { rejectWithValue }) => {
    try {
      return await cartService.removeItem(bookId)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async (_, { rejectWithValue }) => {
    try {
      return await cartService.clearCart()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const validateCart = createAsyncThunk(
  'cart/validateCart',
  async (_, { rejectWithValue }) => {
    try {
      return await cartService.validateCart()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const syncGuestCart = createAsyncThunk(
  'cart/syncGuestCart',
  async (_, { rejectWithValue }) => {
    try {
      const raw = localStorage.getItem('guestCart')
      if (raw) {
        const guestItems = JSON.parse(raw)
        if (Array.isArray(guestItems) && guestItems.length > 0) {
          for (const item of guestItems) {
            const bId = item.bookId || item.id
            const qty = Math.max(1, Number(item.quantity) || 1)
            if (bId) {
              await cartService.addItem(bId, qty)
            }
          }
        }
        localStorage.removeItem('guestCart')
      }
      return await cartService.getCart()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const initialState = {
  items: [],
  total: 0,
  totalQuantity: 0,
  loading: false,
  error: null,
  validationResult: null,
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCartState: (state) => {
      state.items = []
      state.total = 0
      state.totalQuantity = 0
      state.error = null
      state.validationResult = null
    },
    setCartItems: (state, action) => {
      state.items = action.payload || []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload?.items || []
        state.total = action.payload?.total || 0
        state.totalQuantity = action.payload?.totalQuantity || 0
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(addToCart.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload?.items || []
        state.total = action.payload?.total || 0
        state.totalQuantity = action.payload?.totalQuantity || 0
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(updateCartItem.pending, (state) => {
        state.error = null
      })
      .addCase(updateCartItem.fulfilled, (state, action) => {
        state.items = action.payload?.items || []
        state.total = action.payload?.total || 0
        state.totalQuantity = action.payload?.totalQuantity || 0
      })
      .addCase(updateCartItem.rejected, (state, action) => {
        state.error = action.payload
      })
      .addCase(removeFromCart.pending, (state) => {
        state.error = null
      })
      .addCase(removeFromCart.fulfilled, (state, action) => {
        state.items = action.payload?.items || []
        state.total = action.payload?.total || 0
        state.totalQuantity = action.payload?.totalQuantity || 0
      })
      .addCase(removeFromCart.rejected, (state, action) => {
        state.error = action.payload
      })
      .addCase(clearCart.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(clearCart.fulfilled, (state) => {
        state.loading = false
        state.items = []
        state.total = 0
        state.totalQuantity = 0
      })
      .addCase(clearCart.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(validateCart.pending, (state) => {
        state.error = null
      })
      .addCase(validateCart.fulfilled, (state, action) => {
        state.validationResult = action.payload
      })
      .addCase(validateCart.rejected, (state, action) => {
        state.error = action.payload
      })
      .addCase(syncGuestCart.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(syncGuestCart.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload?.items || []
        state.total = action.payload?.total || 0
        state.totalQuantity = action.payload?.totalQuantity || 0
      })
      .addCase(syncGuestCart.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearCartState, setCartItems } = cartSlice.actions
export default cartSlice.reducer

