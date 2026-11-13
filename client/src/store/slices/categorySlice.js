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
  error: null,
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
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true
        state.adminFetchStatus = 'loading'
        state.error = null
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false
        state.adminLoaded = true
        state.adminFetchStatus = 'succeeded'
        state.categories = extractCategoryList(action.payload)
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false
        state.adminFetchStatus = 'failed'
        state.error = action.payload
      })
      .addCase(fetchPublicCategories.pending, (state) => {
        state.publicLoading = true
        state.publicFetchStatus = 'loading'
      })
      .addCase(fetchPublicCategories.fulfilled, (state, action) => {
        state.publicLoading = false
        state.publicLoaded = true
        state.publicFetchStatus = 'succeeded'
        state.publicCategories = extractCategoryList(action.payload)
      })
      .addCase(fetchPublicCategories.rejected, (state) => {
        state.publicLoading = false
        state.publicFetchStatus = 'failed'
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.categories.unshift(action.payload)
        state.publicLoaded = false
        state.publicFetchStatus = 'idle'
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => cat.id === action.payload.id)
        if (index !== -1) {
          state.categories[index] = action.payload
        }
        state.publicLoaded = false
        state.publicFetchStatus = 'idle'
      })
      .addCase(updateCategoryStatus.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => cat.id === action.payload.id)
        if (index !== -1) {
          state.categories[index] = action.payload
        }
        state.publicLoaded = false
        state.publicFetchStatus = 'idle'
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
        }
      )
  },
})

export const { clearCategoryError, invalidateCategories } = categorySlice.actions
export default categorySlice.reducer
