import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '@constants/routes';
import MainTabs from './MainTabs';
import CallDetailsScreen from '@screens/recent/CallDetailsScreen';
import InCallScreen from '@screens/call/InCallScreen';
import SettingsScreen from '@screens/settings/SettingsScreen';
import ProfileScreen from '@screens/settings/ProfileScreen';
import HelpScreen from '@screens/settings/HelpScreen';
import ReportScreen from '@screens/settings/ReportScreen';
import AboutScreen from '@screens/settings/AboutScreen';
import WalletHistoryScreen from '@screens/wallet/WalletHistoryScreen';
import PackagesScreen from '@screens/wallet/PackagesScreen';
import LegalScreen from '@screens/onboarding/LegalScreen';
import ComponentGallery from '@screens/dev/ComponentGallery';
import CallGateHost from '@components/CallGateHost';

const Stack = createNativeStackNavigator();

const MainStack = () => (
  <>
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name={ROUTES.MAIN_TABS} component={MainTabs} />
      <Stack.Screen name={ROUTES.CALL_DETAILS} component={CallDetailsScreen} />
      <Stack.Screen
        name={ROUTES.IN_CALL}
        component={InCallScreen}
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: false,
          animation: 'fade_from_bottom',
          orientation: 'portrait',
          statusBarTranslucent: true,
        }}
      />
      <Stack.Screen name={ROUTES.SETTINGS} component={SettingsScreen} />
      <Stack.Screen name={ROUTES.PROFILE} component={ProfileScreen} />
      {/* Heavy screens load on first open (faster cold start) */}
      <Stack.Screen
        name={ROUTES.RECORDINGS}
        getComponent={() => require('@screens/settings/RecordingsScreen').default}
      />
      <Stack.Screen name={ROUTES.WALLET_HISTORY} component={WalletHistoryScreen} />
      <Stack.Screen name={ROUTES.SPIN_WHEEL} getComponent={() => require('@screens/wallet/SpinWheelScreen').default} />
      <Stack.Screen name={ROUTES.PACKAGES} component={PackagesScreen} />
      <Stack.Screen name={ROUTES.LEGAL} component={LegalScreen} />
      <Stack.Screen name={ROUTES.HELP} component={HelpScreen} />
      <Stack.Screen name={ROUTES.REPORT} component={ReportScreen} />
      <Stack.Screen name={ROUTES.ABOUT} component={AboutScreen} />
      {__DEV__ ? <Stack.Screen name={ROUTES.COMPONENT_GALLERY} component={ComponentGallery} /> : null}
    </Stack.Navigator>
    {/* Pre-call dialogs (credits / microphone / emergency) for every CALL button */}
    <CallGateHost />
  </>
);

export default MainStack;
