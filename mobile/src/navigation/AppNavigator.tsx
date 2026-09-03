import React, {useCallback, useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ActivityIndicator, AppState, Platform, StyleSheet, View} from 'react-native';
import {apiClient} from '../api/client';
import {mooketApi} from '../api/mooketApi';
import {UpdateModal} from '../components/common/UpdateModal';
import {CURRENT_APP_VERSION_CODE, DEFAULT_CATEGORY} from '../config/env';
import {HomeScreenV2} from '../screens/HomeScreenV2';
import {LoginScreen} from '../screens/LoginScreen';
import {sessionStore} from '../store/sessionStore';
import {colors} from '../theme/colors';
import type {AppVersionInfo} from '../types/api';
import {navigationRef} from './navigationService';
import type {RootStackParamList} from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();
const detailScreenOptions = ({route}: {route: {params?: {disableTransition?: boolean}}}) => ({
  headerShown: false,
  animation: route.params?.disableTransition ? 'none' as const : 'default' as const,
});
const getSearchScreen = () => require('../screens/SearchScreen').SearchScreen;
const getMerchantSearchResultsScreen = () => require('../screens/MerchantSearchResultsScreen').MerchantSearchResultsScreen;
const getOfferFeedScreen = () => require('../screens/OfferFeedScreen').OfferFeedScreen;
const getPlateFollowScreen = () => require('../screens/PlateFollowScreen').PlateFollowScreen;
const getHomeCardsScreen = () => require('../screens/HomeCardsScreen').HomeCardsScreen;
const getChatScreen = () => require('../screens/ChatScreen').ChatScreen;
const getMerchantScreen = () => require('../screens/MerchantScreen').MerchantScreen;
const getProductScreen = () => require('../screens/ProductScreen').ProductScreen;
const getCountryScreen = () => require('../screens/CountryScreen').CountryScreen;
const getFactoryScreen = () => require('../screens/FactoryScreen').FactoryScreen;
const getCountryProductScreen = () => require('../screens/CountryProductScreen').CountryProductScreen;
const getCountryFactoryProductScreen = () =>
  require('../screens/CountryFactoryProductScreen').CountryFactoryProductScreen;
const getSubstituteProductScreen = () => require('../screens/SubstituteProductScreen').SubstituteProductScreen;
const getDataComparisonScreen = () => require('../screens/DataComparisonScreen').DataComparisonScreen;
const getBrandScreen = () => require('../screens/BrandScreen').BrandScreen;
const getBrandProductScreen = () => require('../screens/BrandProductScreen').BrandProductScreen;
const getProfileScreen = () => require('../screens/ProfileScreen').ProfileScreen;
const getEditProfileScreen = () => require('../screens/EditProfileScreen').EditProfileScreen;
const getInventoryScreen = () => require('../screens/InventoryScreen').default;

export function AppNavigator() {
  const {hydrate, isHydrated, token} = sessionStore();
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const checkAppUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const info = await mooketApi.getAppVersion();
      if (info && info.hasUpdate && (info.versionCode ?? 0) > CURRENT_APP_VERSION_CODE) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      }
    } catch {
      // Ignore version check failures; the app should still be usable.
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const validateSession = () => {
      apiClient.get('api/v1/user/profile').catch(() => undefined);
    };

    validateSession();

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        validateSession();
      }
    });

    const interval = setInterval(() => {
      validateSession();
    }, 15000);

    return () => {
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    checkAppUpdate().catch(() => undefined);

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkAppUpdate().catch(() => undefined);
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [checkAppUpdate, isHydrated]);

  if (!isHydrated) {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {backgroundColor: colors.surface},
            headerTintColor: colors.text,
            headerTitleStyle: {fontWeight: '700', fontSize: 17},
            headerShadowVisible: false,
            contentStyle: {backgroundColor: colors.background},
          }}>
          {token ? (
            <>
              <Stack.Screen name="Home" component={HomeScreenV2} options={{headerShown: false}} />
              <Stack.Screen
                name="Search"
                getComponent={getSearchScreen}
                initialParams={{category: DEFAULT_CATEGORY}}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="MerchantSearchResults"
                getComponent={getMerchantSearchResultsScreen}
                options={{headerShown: false, animation: 'none'}}
              />
              <Stack.Screen name="OfferFeed" getComponent={getOfferFeedScreen} options={detailScreenOptions} />
              <Stack.Screen name="PlateFollow" getComponent={getPlateFollowScreen} options={{headerShown: false}} />
              <Stack.Screen name="HomeCards" getComponent={getHomeCardsScreen} options={{headerShown: false}} />
              <Stack.Screen name="Chat" getComponent={getChatScreen} options={{headerShown: false}} />
              <Stack.Screen name="Merchant" getComponent={getMerchantScreen} options={{headerShown: false}} />
              <Stack.Screen name="Product" getComponent={getProductScreen} options={detailScreenOptions} />
              <Stack.Screen name="Country" getComponent={getCountryScreen} options={detailScreenOptions} />
              <Stack.Screen name="Factory" getComponent={getFactoryScreen} options={detailScreenOptions} />
              <Stack.Screen
                name="CountryProduct"
                getComponent={getCountryProductScreen}
                options={detailScreenOptions}
              />
              <Stack.Screen
                name="CountryFactoryProduct"
                getComponent={getCountryFactoryProductScreen}
                options={detailScreenOptions}
              />
              <Stack.Screen
                name="SubstituteProduct"
                getComponent={getSubstituteProductScreen}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="DataComparison"
                getComponent={getDataComparisonScreen}
                options={{headerShown: false}}
              />
              <Stack.Screen name="Brand" getComponent={getBrandScreen} options={detailScreenOptions} />
              <Stack.Screen
                name="BrandProduct"
                getComponent={getBrandProductScreen}
                options={detailScreenOptions}
              />
              <Stack.Screen name="Profile" getComponent={getProfileScreen} options={{headerShown: false}} />
              <Stack.Screen
                name="EditProfile"
                getComponent={getEditProfileScreen}
                options={{headerShown: false}}
              />
              <Stack.Screen name="Inventory" getComponent={getInventoryScreen} options={{headerShown: false}} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {Platform.OS === 'android' && updateInfo ? (
        <UpdateModal
          visible={showUpdateModal}
          versionInfo={updateInfo}
          onClose={() => setShowUpdateModal(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
