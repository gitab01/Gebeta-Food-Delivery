import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { View, ActivityIndicator } from 'react-native';
import { RootState, AppDispatch } from '../store';
import { loadUserFromStorage } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import CustomerTabs from './CustomerTabs';
import DriverTabs from './DriverTabs';
import { connectSocket, disconnectSocket } from '../services/socket';
import { COLORS } from '../constants/theme';

const RootNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    dispatch(loadUserFromStorage());
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
    } else {
      disconnectSocket();
    }
    return () => { disconnectSocket(); };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : user?.role === 'driver' ? (
        <DriverTabs />
      ) : (
        <CustomerTabs />
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
