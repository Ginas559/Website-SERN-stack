import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import bookService from '../../services/bookService'

export const fetchBooks = createAsyncThunk(
  'books/fetchBooks',
  async (params, { rejectWithValue }) => {
    try {
      return await bookService.getAll(params)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchBookById = createAsyncThunk(
  'books/fetchBookById',
  async (id, { rejectWithValue }) => {
    try {
      return await bookService.getById(id)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchAdminBooks = createAsyncThunk(
  'books/fetchAdminBooks',
  async (params, { rejectWithValue }) => {
    try {
      return await bookService.getAdminBooks(params)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const createBook = createAsyncThunk(
  'books/createBook',
  async (data, { rejectWithValue }) => {
    try {
      return await bookService.create(data)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateBook = createAsyncThunk(
  'books/updateBook',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await bookService.update(id, data)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateBookStatus = createAsyncThunk(
  'books/updateBookStatus',
  async ({ id, isDelete }, { rejectWithValue }) => {
    try {
      return await bookService.updateStatus(id, isDelete)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const initialState = {
  books: [],
  adminBooks: [],
  selectedBook: null,
  total: 0,
  adminTotal: 0,
  page: 1,
  adminPage: 1,
  limit: 10,
  totalPages: 1,
  adminTotalPages: 1,
  loading: false,
  error: null,
}

const bookSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {
    setSelectedBook: (state, action) => {
      state.selectedBook = action.payload
    },
    clearBookError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBooks.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBooks.fulfilled, (state, action) => {
        state.loading = false
        if (action.payload?.books) {
          state.books = action.payload.books
          state.total = action.payload.total || action.payload.books.length
          state.page = action.payload.page || 1
          state.limit = action.payload.limit || 8
          state.totalPages = action.payload.totalPages || 1
        } else if (Array.isArray(action.payload)) {
          state.books = action.payload
          state.total = action.payload.length
        }
      })
      .addCase(fetchBooks.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchBookById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBookById.fulfilled, (state, action) => {
        state.loading = false
        state.selectedBook = action.payload
      })
      .addCase(fetchBookById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchAdminBooks.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAdminBooks.fulfilled, (state, action) => {
        state.loading = false
        if (action.payload?.books) {
          state.adminBooks = action.payload.books
          state.adminTotal = action.payload.total || action.payload.books.length
          state.adminPage = action.payload.page || 1
          state.adminTotalPages = action.payload.totalPages || 1
        } else if (Array.isArray(action.payload)) {
          state.adminBooks = action.payload
          state.adminTotal = action.payload.length
        }
      })
      .addCase(fetchAdminBooks.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createBook.fulfilled, (state, action) => {
        state.adminBooks.unshift(action.payload)
        state.adminTotal += 1
      })
      .addCase(updateBook.fulfilled, (state, action) => {
        const index = state.adminBooks.findIndex((b) => b.id === action.payload.id)
        if (index !== -1) {
          state.adminBooks[index] = action.payload
        }
        if (state.selectedBook?.id === action.payload.id) {
          state.selectedBook = action.payload
        }
      })
      .addCase(updateBookStatus.fulfilled, (state, action) => {
        const index = state.adminBooks.findIndex((b) => b.id === action.payload.id)
        if (index !== -1) {
          state.adminBooks[index] = action.payload
        }
      })
  },
})

export const { setSelectedBook, clearBookError } = bookSlice.actions
export default bookSlice.reducer
