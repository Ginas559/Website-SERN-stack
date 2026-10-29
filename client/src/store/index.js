import { configureStore } from '@reduxjs/toolkit'
import bookReducer from './slices/bookSlice'
import categoryReducer from './slices/categorySlice'

export const store = configureStore({
  reducer: {
    books: bookReducer,
    categories: categoryReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

export default store
