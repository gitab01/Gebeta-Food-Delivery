import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchRestaurants } from '../../store/slices/restaurantSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import RestaurantCard from '../../components/RestaurantCard';
import CategoryFilter from '../../components/CategoryFilter';

const CATEGORIES = ['All', 'Ethiopian', 'Burgers', 'Pizza', 'Sushi', 'Chinese', 'Salads', 'Desserts'];

const HomeScreen = ({ navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const { restaurants, isLoading } = useSelector((state: RootState) => state.restaurants);
  const { user } = useSelector((state: RootState) => state.auth);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchRestaurants());
  }, []);

  const handleSearch = () => {
    dispatch(fetchRestaurants({ search }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchRestaurants({}));
    setRefreshing(false);
  };

  const filteredRestaurants =
    selectedCategory === 'All'
      ? restaurants
      : restaurants.filter((r) => r.cuisine?.includes(selectedCategory));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()}, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>What are you craving today?</Text>
        </View>
        <TouchableOpacity style={styles.locationBtn}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>Addis Ababa</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search restaurants or dishes..."
          placeholderTextColor={COLORS.gray}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); dispatch(fetchRestaurants({})); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <CategoryFilter
        categories={CATEGORIES}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Restaurant List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding restaurants near you...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRestaurants}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              onPress={() => navigation.navigate('Restaurant', { restaurantId: item._id })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyTitle}>No restaurants found</Text>
              <Text style={styles.emptySubtitle}>Try a different search or category</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  greeting: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text.primary },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2 },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationIcon: { fontSize: 16 },
  locationText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    marginVertical: SPACING.sm,
    ...SHADOWS.small,
  },
  searchIcon: { fontSize: 18, marginRight: SPACING.xs },
  searchInput: { flex: 1, paddingVertical: SPACING.md, fontSize: FONTS.sizes.md, color: COLORS.text.primary },
  clearBtn: { color: COLORS.gray, fontSize: FONTS.sizes.md, padding: SPACING.xs },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.text.secondary, fontSize: FONTS.sizes.md },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyEmoji: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: { fontSize: FONTS.sizes.md, color: COLORS.text.secondary, marginTop: SPACING.xs },
});

export default HomeScreen;
