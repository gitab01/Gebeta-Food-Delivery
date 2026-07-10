import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  customizations?: { name: string; selectedOption: string; additionalPrice: number }[];
}

interface CartState {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartItem[];
}

const initialState: CartState = {
  restaurantId: null,
  restaurantName: null,
  items: [],
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<{ restaurantId: string; restaurantName: string; item: CartItem }>) => {
      const { restaurantId, restaurantName, item } = action.payload;

      // Clear cart if switching restaurants
      if (state.restaurantId && state.restaurantId !== restaurantId) {
        state.items = [];
      }

      state.restaurantId = restaurantId;
      state.restaurantName = restaurantName;

      const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        state.items.push(item);
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.menuItemId !== action.payload);
      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
      }
    },
    updateQuantity: (state, action: PayloadAction<{ menuItemId: string; quantity: number }>) => {
      const item = state.items.find((i) => i.menuItemId === action.payload.menuItemId);
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter((i) => i.menuItemId !== action.payload.menuItemId);
        } else {
          item.quantity = action.payload.quantity;
        }
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.restaurantId = null;
      state.restaurantName = null;
    },
  },
});

export const { addItem, removeItem, updateQuantity, clearCart } = cartSlice.actions;

// Selectors
export const selectCartTotal = (state: { cart: CartState }) =>
  state.cart.items.reduce((sum, item) => {
    const customPrice = item.customizations?.reduce((acc, c) => acc + (c.additionalPrice || 0), 0) || 0;
    return sum + (item.price + customPrice) * item.quantity;
  }, 0);

export const selectCartItemCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((sum, item) => sum + item.quantity, 0);

export default cartSlice.reducer;
