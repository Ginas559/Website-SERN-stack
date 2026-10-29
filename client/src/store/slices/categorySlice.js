import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import categoryService from '../../services/categoryService'

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
  loading: false,
  error: null,
}

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    clearCategoryError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false
        state.categories = Array.isArray(action.payload)
          ? action.payload
          : action.payload?.categories || []
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.categories.unshift(action.payload)
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => cat.id === action.payload.id)
        if (index !== -1) {
          state.categories[index] = action.payload
        }
      })
      .addCase(updateCategoryStatus.fulfilled, (state, action) => {
        const index = state.categories.findIndex((cat) => cat.id === action.payload.id)
        if (index !== -1) {
          state.categories[index] = action.payload
        }
      })
  },
})

export const { clearCategoryError } = categorySlice.actions
export default categorySlice.reducer
