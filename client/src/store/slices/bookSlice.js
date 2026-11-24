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
  priceRange: { min: 0, max: 500000 },
  booksQueryKey: null,
  adminBooksQueryKey: null,
  selectedBookAttemptedId: null,
  booksNeedsReload: false,
  adminBooksNeedsReload: false,
  selectedBookNeedsReload: false,
  clientBooksLoading: false,
  clientBooksError: null,
  clientBooksRequestId: null,
  bookDetailLoading: false,
  bookDetailError: null,
  bookDetailRequestId: null,
  adminBooksLoading: false,
  adminBooksError: null,
  adminBooksRequestId: null,
}

const bookSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {
    setSelectedBook: (state, action) => {
      state.selectedBook = action.payload
      if (action.payload === null) {
        state.bookDetailLoading = false
        state.bookDetailError = null
        state.bookDetailRequestId = null
        state.selectedBookAttemptedId = null
        state.selectedBookNeedsReload = false
      }
    },
    clearBookError: (state) => {
      state.clientBooksError = null
      state.bookDetailError = null
      state.adminBooksError = null
    },
    invalidateBooks: (state) => {
      state.booksNeedsReload = true
      state.adminBooksNeedsReload = true
      state.selectedBookNeedsReload = true
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBooks.pending, (state, action) => {
        state.clientBooksLoading = true
        state.clientBooksError = null
        state.clientBooksRequestId = action.meta.requestId
        state.booksQueryKey = JSON.stringify(action.meta.arg || {})
        state.booksNeedsReload = false
      })
      .addCase(fetchBooks.fulfilled, (state, action) => {
        if (state.clientBooksRequestId !== action.meta.requestId) return
        state.clientBooksLoading = false
        state.clientBooksRequestId = null
        if (action.payload?.books) {
          state.books = action.payload.books
          state.total = action.payload.total || action.payload.books.length
          state.page = action.payload.page || 1
          state.limit = action.payload.limit || 8
          state.totalPages = action.payload.totalPages || 1
          if (action.payload.priceRange) {
            state.priceRange = action.payload.priceRange
          }
        } else if (Array.isArray(action.payload)) {
          state.books = action.payload
          state.total = action.payload.length
        }
      })
      .addCase(fetchBooks.rejected, (state, action) => {
        if (state.clientBooksRequestId !== action.meta.requestId) return
        state.clientBooksLoading = false
        state.clientBooksError = action.payload
        state.clientBooksRequestId = null
      })
      .addCase(fetchBookById.pending, (state, action) => {
        state.bookDetailLoading = true
        state.bookDetailError = null
        state.bookDetailRequestId = action.meta.requestId
        state.selectedBookAttemptedId = Number(action.meta.arg) || null
        state.selectedBookNeedsReload = false
      })
      .addCase(fetchBookById.fulfilled, (state, action) => {
        if (state.bookDetailRequestId !== action.meta.requestId) return
        state.bookDetailLoading = false
        state.bookDetailRequestId = null
        state.selectedBook = action.payload
        state.selectedBookNeedsReload = false
      })
      .addCase(fetchBookById.rejected, (state, action) => {
        if (state.bookDetailRequestId !== action.meta.requestId) return
        state.bookDetailLoading = false
        state.bookDetailError = action.payload
        state.bookDetailRequestId = null
      })
      .addCase(fetchAdminBooks.pending, (state, action) => {
        state.adminBooksLoading = true
        state.adminBooksError = null
        state.adminBooksRequestId = action.meta.requestId
        state.adminBooksQueryKey = JSON.stringify(action.meta.arg || {})
        state.adminBooksNeedsReload = false
      })
      .addCase(fetchAdminBooks.fulfilled, (state, action) => {
        if (state.adminBooksRequestId !== action.meta.requestId) return
        state.adminBooksLoading = false
        state.adminBooksRequestId = null
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
        if (state.adminBooksRequestId !== action.meta.requestId) return
        state.adminBooksLoading = false
        state.adminBooksError = action.payload
        state.adminBooksRequestId = null
      })
      .addCase(createBook.fulfilled, (state, action) => {
        state.adminBooks.unshift(action.payload)
        state.adminTotal += 1
        state.booksNeedsReload = true
        state.adminBooksNeedsReload = true
      })
      .addCase(updateBook.fulfilled, (state, action) => {
        const index = state.adminBooks.findIndex((b) => b.id === action.payload.id)
        if (index !== -1) {
          state.adminBooks[index] = action.payload
        }
        if (state.selectedBook?.id === action.payload.id) {
          state.selectedBook = action.payload
        }
        state.booksNeedsReload = true
        state.adminBooksNeedsReload = true
        state.selectedBookNeedsReload = true
      })
      .addCase(updateBookStatus.fulfilled, (state, action) => {
        const index = state.adminBooks.findIndex((b) => b.id === action.payload.id)
        if (index !== -1) {
          state.adminBooks[index] = action.payload
        }
        state.booksNeedsReload = true
        state.adminBooksNeedsReload = true
        if (state.selectedBook?.id === action.payload.id) {
          state.selectedBookNeedsReload = true
        }
      })
      .addMatcher(
        (action) =>
          action.type === 'categories/createCategory/fulfilled' ||
          action.type === 'categories/updateCategory/fulfilled' ||
          action.type === 'categories/updateCategoryStatus/fulfilled',
        (state) => {
          state.booksNeedsReload = true
          state.adminBooksNeedsReload = true
          state.selectedBookNeedsReload = true
        }
      )
  },
})

export const { setSelectedBook, clearBookError, invalidateBooks } = bookSlice.actions
export default bookSlice.reducer
