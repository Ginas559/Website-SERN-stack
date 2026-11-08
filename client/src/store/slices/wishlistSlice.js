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
      await wishlistService.addItem(bookId)
      return await wishlistService.getWishlist()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const removeFromWishlist = createAsyncThunk(
  'wishlist/removeFromWishlist',
  async (bookId, { rejectWithValue }) => {
    try {
      await wishlistService.removeItem(bookId)
      return await wishlistService.getWishlist()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const clearWishlist = createAsyncThunk(
  'wishlist/clearWishlist',
  async (_, { rejectWithValue }) => {
    try {
      await wishlistService.clearWishlist()
      return { items: [], totalItems: 0 }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const syncGuestWishlist = createAsyncThunk(
  'wishlist/syncGuestWishlist',
  async (guestItems, { rejectWithValue }) => {
    try {
      if (!Array.isArray(guestItems) || guestItems.length === 0) {
        return await wishlistService.getWishlist()
      }

      for (const item of guestItems) {
        const bookId = item.bookId || item.id
        if (bookId) {
          try {
            await wishlistService.addItem(bookId)
          } catch {
            return
          }
        }
      }

      localStorage.removeItem('guestWishlist')
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
      state.loading = false
      state.error = null
    },
    setWishlistItems: (state, action) => {
      state.items = action.payload || []
      state.totalItems = state.items.length
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
      .addCase(addToWishlist.pending, (state, action) => {
        state.loading = true
        state.error = null
        const targetBookId = Number(action.meta.arg)
        if (targetBookId && !state.items.some((it) => (it.bookId || it.id) === targetBookId)) {
          state.items.push({
            id: targetBookId,
            bookId: targetBookId,
          })
          state.totalItems = state.items.length
        }
      })
      .addCase(addToWishlist.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload?.items || state.items
        state.totalItems = action.payload?.totalItems || state.items.length
      })
      .addCase(addToWishlist.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        const targetBookId = Number(action.meta.arg)
        state.items = state.items.filter((it) => (it.bookId || it.id) !== targetBookId)
        state.totalItems = state.items.length
      })
      .addCase(removeFromWishlist.pending, (state, action) => {
        state.error = null
        const targetBookId = Number(action.meta.arg)
        state.items = state.items.filter((it) => (it.bookId || it.id) !== targetBookId)
        state.totalItems = state.items.length
      })
      .addCase(removeFromWishlist.fulfilled, (state, action) => {
        state.items = action.payload?.items || state.items
        state.totalItems = action.payload?.totalItems || state.items.length
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
