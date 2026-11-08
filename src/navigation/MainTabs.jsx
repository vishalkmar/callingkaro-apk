import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, AppModal, AppText, Icon, ScreenContainer } from '@components/common';
import OfflineBanner from '@components/OfflineBanner';
import { colors, FONT_SCALE } from '@theme';
import { ROUTES } from '@constants/routes';
import { CONFIG } from '@constants/config';
import { logout } from '@services/auth/authService';
import { t } from '@i18n';
import DialpadScreen from '@screens/dialpad/DialpadScreen';
import ContactsScreen from '@screens/contacts/ContactsScreen';
import RecentScreen from '@screens/recent/RecentScreen';
import GetMinutesScreen from '@screens/wallet/GetMinutesScreen';

const Tab = createMaterialTopTabNavigator();

const TAB_ICONS = {
  [ROUTES.DIALPAD]: 'dialpad',
  [ROUTES.CONTACTS]: 'card-account-details',
  [ROUTES.RECENT]: 'history',
  [ROUTES.GET_MINUTES]: 'currency-inr',
};

const tabIcon =
  name =>
  ({ color }) =>
    <Icon name={TAB_ICONS[name]} size={22} color={color} />;

// Own label so it follows the font-size cap (4 tabs share one row) and uses the AA text orange.
const tabLabel = ({ color, children }) => (
  <AppText variant="caption" maxFontSizeMultiplier={FONT_SCALE.dense} numberOfLines={1} style={{ color }}>
    {children}
  </AppText>
);

const MainTabs = () => {
  const navigation = useNavigation();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const menuItems = [
    { label: t('menu.settings'), icon: 'cog-outline', onPress: () => navigation.navigate(ROUTES.SETTINGS) },
    { label: t('menu.recordings'), icon: 'record-rec', onPress: () => navigation.navigate(ROUTES.RECORDINGS) },
    { label: t('menu.profile'), icon: 'account-circle-outline', onPress: () => navigation.navigate(ROUTES.PROFILE) },
    { label: t('menu.help'), icon: 'help-circle-outline', onPress: () => navigation.navigate(ROUTES.HELP) },
    ...(__DEV__
      ? [
          {
            label: 'Component gallery (dev)',
            icon: 'palette-outline',
            onPress: () => navigation.navigate(ROUTES.COMPONENT_GALLERY),
          },
        ]
      : []),
    { label: t('menu.logout'), icon: 'logout', danger: true, onPress: () => setConfirmLogout(true) },
  ];

  const doLogout = useCallback(async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setConfirmLogout(false);
  }, []);

  return (
    <ScreenContainer statusBarColor={colors.primary} edges={['top', 'bottom']}>
      <AppHeader title={CONFIG.APP_NAME} menuItems={menuItems} />
      <OfflineBanner />
      <View style={styles.flex}>
        <Tab.Navigator
          backBehavior="none"
          screenOptions={({ route }) => ({
            tabBarShowIcon: true,
            tabBarIcon: tabIcon(route.name),
            tabBarLabel: tabLabel,
            tabBarActiveTintColor: colors.primaryText,
            tabBarInactiveTintColor: colors.subtext,
            tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 2 },
            tabBarItemStyle: { flexDirection: 'column', paddingVertical: 4 },
            tabBarStyle: {
              backgroundColor: colors.surface,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.divider,
            },
            tabBarPressColor: colors.primarySoft,
            lazy: true,
          })}>
          <Tab.Screen name={ROUTES.DIALPAD} component={DialpadScreen} options={{ title: t('tabs.dialpad') }} />
          <Tab.Screen name={ROUTES.CONTACTS} component={ContactsScreen} options={{ title: t('tabs.contacts') }} />
          <Tab.Screen name={ROUTES.RECENT} component={RecentScreen} options={{ title: t('tabs.recent') }} />
          <Tab.Screen
            name={ROUTES.GET_MINUTES}
            component={GetMinutesScreen}
            options={{ title: t('tabs.getMinutes') }}
          />
        </Tab.Navigator>
      </View>
      <AppModal
        visible={confirmLogout}
        icon="logout"
        title={t('logout.title')}
        message={t('logout.message')}
        secondaryText={t('common.cancel')}
        onSecondary={() => setConfirmLogout(false)}
        primaryText={loggingOut ? t('logout.loggingOut') : t('menu.logout')}
        primaryDanger
        onPrimary={loggingOut ? undefined : doLogout}
        onClose={() => setConfirmLogout(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({ flex: { flex: 1 } });

export default MainTabs;
