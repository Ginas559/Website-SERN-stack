import { configureStore } from '@reduxjs/toolkit'
import bookReducer from './slices/bookSlice'
import categoryReducer from './slices/categorySlice'
import cartReducer from './slices/cartSlice'
import wishlistReducer from './slices/wishlistSlice'

export const store = configureStore({
  reducer: {
    books: bookReducer,
    categories: categoryReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

export default store
