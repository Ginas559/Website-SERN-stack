import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import wishlistService from '../../services/wishlistService'

export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    try {
      return await wishlistService.getWishlist()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const addToWishlist = createAsyncThunk(
  'wishlist/addToWishlist',
  async (bookId, { rejectWithValue }) => {
    try {
      return await wishlistService.addItem(bookId)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const removeFromWishlist = createAsyncThunk(
  'wishlist/removeFromWishlist',
  async (bookId, { rejectWithValue }) => {
    try {
      return await wishlistService.removeItem(bookId)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const clearWishlist = createAsyncThunk(
  'wishlist/clearWishlist',
  async (_, { rejectWithValue }) => {
    try {
      return await wishlistService.clearWishlist()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const syncGuestWishlist = createAsyncThunk(
  'wishlist/syncGuestWishlist',
  async (_, { rejectWithValue }) => {
    try {
      const raw = localStorage.getItem('guestWishlist')
      if (raw) {
        const guestItems = JSON.parse(raw)
        if (Array.isArray(guestItems) && guestItems.length > 0) {
          for (const item of guestItems) {
            const bId = item.bookId || item.id
            if (bId) {
              await wishlistService.addItem(bId)
            }
          }
        }
        localStorage.removeItem('guestWishlist')
      }
      return await wishlistService.getWishlist()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const initialState = {
  items: [],
  totalItems: 0,
  loading: false,
  error: null,
}

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    clearWishlistState: (state) => {
      state.items = []
      state.totalItems = 0
      state.error = null
    },
    setWishlistItems: (state, action) => {
      state.items = action.payload || []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload?.items || []
        state.totalItems = action.payload?.totalItems || 0
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(addToWishlist.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addToWishlist.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload?.items || []
        state.totalItems = action.payload?.totalItems || 0
      })
      .addCase(addToWishlist.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(removeFromWishlist.pending, (state) => {
        state.error = null
      })
      .addCase(removeFromWishlist.fulfilled, (state, action) => {
        state.items = action.payload?.items || []
        state.totalItems = action.payload?.totalItems || 0
      })
      .addCase(removeFromWishlist.rejected, (state, action) => {
        state.error = action.payload
      })
      .addCase(clearWishlist.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(clearWishlist.fulfilled, (state) => {
        state.loading = false
        state.items = []
        state.totalItems = 0
      })
      .addCase(clearWishlist.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(syncGuestWishlist.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(syncGuestWishlist.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload?.items || []
        state.totalItems = action.payload?.totalItems || 0
      })
      .addCase(syncGuestWishlist.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearWishlistState, setWishlistItems } = wishlistSlice.actions
export default wishlistSlice.reducer

