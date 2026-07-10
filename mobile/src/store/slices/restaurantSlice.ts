import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

interface RestaurantState {
  restaurants: any[];
  selectedRestaurant: any | null;
  menu: Record<string, any[]>;
  isLoading: boolean;
  error: string | null;
}

const initialState: RestaurantState = {
  restaurants: [],
  selectedRestaurant: null,
  menu: {},
  isLoading: false,
  error: null,
};

export const fetchRestaurants = createAsyncThunk(
  'restaurants/fetchAll',
  async (params: { search?: string; lat?: number; lng?: number } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/restaurants', { params });
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch restaurants');
    }
  }
);

export const fetchRestaurantDetails = createAsyncThunk(
  'restaurants/fetchOne',
  async (restaurantId: string, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/restaurants/${restaurantId}`);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch restaurant');
    }
  }
);

const restaurantSlice = createSlice({
  name: 'restaurants',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRestaurants.pending, (state) => { state.isLoading = true; })
      .addCase(fetchRestaurants.fulfilled, (state, action) => {
        state.isLoading = false;
        state.restaurants = action.payload;
      })
      .addCase(fetchRestaurants.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchRestaurantDetails.pending, (state) => { state.isLoading = true; })
      .addCase(fetchRestaurantDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedRestaurant = action.payload.restaurant;
        state.menu = action.payload.menu;
      })
      .addCase(fetchRestaurantDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export default restaurantSlice.reducer;
