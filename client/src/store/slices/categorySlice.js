import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import categoryService from '../../services/categoryService'

const extractCategoryList = (payload) => (Array.isArray(payload) ? payload : payload?.categories || [])

export const fetchPublicCategories = createAsyncThunk(
  'categories/fetchPublicCategories',
  async (_, { rejectWithValue }) => {
    try {
      return await categoryService.getPublicAll()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (params, { rejectWithValue }) => {
    try {
      return await categoryService.getAll(params)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const createCategory = createAsyncThunk(
  'categories/createCategory',
  async (data, { rejectWithValue }) => {
    try {
      return await categoryService.create(data)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateCategory = createAsyncThunk(
  'categories/updateCategory',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await categoryService.update(id, data)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateCategoryStatus = createAsyncThunk(
  'categories/updateCategoryStatus',
  async ({ id, isDelete }, { rejectWithValue }) => {
    try {
      return await categoryService.updateStatus(id, isDelete)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const initialState = {
  categories: [],
  publicCategories: [],
  loading: false,
  publicLoading: false,
  adminLoaded: false,
  publicLoaded: false,
  adminFetchStatus: 'idle',
  publicFetchStatus: 'idle',
  publicRequestId: null,
  error: null,
  requestId: null,
}

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    clearCategoryError: (state) => {
      state.error = null
    },
    invalidateCategories: (state) => {
      state.adminLoaded = false
      state.publicLoaded = false
      state.adminFetchStatus = 'idle'
      state.publicFetchStatus = 'idle'
      state.requestId = null
      state.publicRequestId = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state, action) => {
        state.loading = true
        state.adminLoaded = false
        state.adminFetchStatus = 'loading'
        state.error = null
        state.requestId = action.meta.requestId
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.loading = false
        state.requestId = null
        state.adminLoaded = true
        state.adminFetchStatus = 'succeeded'
        state.categories = extractCategoryList(action.payload)
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.loading = false
        state.adminFetchStatus = 'failed'
        state.error = action.payload
        state.requestId = null
      })
      .addCase(fetchPublicCategories.pending, (state, action) => {
        state.publicLoading = true
        state.publicFetchStatus = 'loading'
        state.publicRequestId = action.meta.requestId
      })
      .addCase(fetchPublicCategories.fulfilled, (state, action) => {
        if (state.publicRequestId !== action.meta.requestId) return
        state.publicLoading = false
        state.publicLoaded = true
        state.publicFetchStatus = 'succeeded'
        state.publicCategories = extractCategoryList(action.payload)
        state.publicRequestId = null
      })
      .addCase(fetchPublicCategories.rejected, (state, action) => {
        if (state.publicRequestId !== action.meta.requestId) return
        state.publicLoading = false
        state.publicFetchStatus = 'failed'
        state.publicRequestId = null
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.categories.unshift(action.payload)
        state.publicLoaded = false
        state.publicFetchStatus = 'idle'
        state.publicRequestId = null
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => cat.id === action.payload.id)
        if (index !== -1) {
          state.categories[index] = action.payload
        }
        state.publicLoaded = false
        state.publicFetchStatus = 'idle'
        state.publicRequestId = null
      })
      .addCase(updateCategoryStatus.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => cat.id === action.payload.id)
        if (index !== -1) {
          state.categories[index] = action.payload
        }
        state.publicLoaded = false
        state.publicFetchStatus = 'idle'
        state.publicRequestId = null
      })
      .addMatcher(
        (action) =>
          action.type === 'books/createBook/fulfilled' ||
          action.type === 'books/updateBook/fulfilled' ||
          action.type === 'books/updateBookStatus/fulfilled' ||
          action.type === 'books/invalidateBooks',
        (state) => {
          state.adminLoaded = false
          state.publicLoaded = false
          state.adminFetchStatus = 'idle'
          state.publicFetchStatus = 'idle'
          state.requestId = null
          state.publicRequestId = null
        }
      )
  },
})

export const { clearCategoryError, invalidateCategories } = categorySlice.actions
export default categorySlice.reducer
