import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

interface OrderState {
  orders: any[];
  currentOrder: any | null;
  driverLocation: { lat: number; lng: number } | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: OrderState = {
  orders: [],
  currentOrder: null,
  driverLocation: null,
  isLoading: false,
  error: null,
};

export const placeOrder = createAsyncThunk(
  'orders/place',
  async (orderData: any, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/orders', orderData);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to place order');
    }
  }
);

export const fetchMyOrders = createAsyncThunk('orders/fetchMy', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/orders');
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch orders');
  }
});

export const fetchOrder = createAsyncThunk(
  'orders/fetchOne',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch order');
    }
  }
);

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    updateDriverLocation: (state, action) => {
      state.driverLocation = action.payload;
    },
    updateOrderStatus: (state, action) => {
      const { orderId, status } = action.payload;
      if (state.currentOrder?._id === orderId) {
        state.currentOrder.status = status;
      }
      const order = state.orders.find((o) => o._id === orderId);
      if (order) order.status = status;
    },
    setCurrentOrder: (state, action) => {
      state.currentOrder = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(placeOrder.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentOrder = action.payload;
        state.orders.unshift(action.payload);
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchMyOrders.fulfilled, (state, action) => {
        state.orders = action.payload;
      });

    builder
      .addCase(fetchOrder.fulfilled, (state, action) => {
        state.currentOrder = action.payload;
      });
  },
});

export const { updateDriverLocation, updateOrderStatus, setCurrentOrder } = orderSlice.actions;
export default orderSlice.reducer;
