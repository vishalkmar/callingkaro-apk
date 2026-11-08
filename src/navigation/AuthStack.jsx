import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '@constants/routes';
import EmailEntryScreen from '@screens/auth/EmailEntryScreen';
import OtpVerifyScreen from '@screens/auth/OtpVerifyScreen';
import LegalScreen from '@screens/onboarding/LegalScreen';

const Stack = createNativeStackNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name={ROUTES.EMAIL_ENTRY} component={EmailEntryScreen} />
    <Stack.Screen name={ROUTES.OTP_VERIFY} component={OtpVerifyScreen} />
    <Stack.Screen name={ROUTES.LEGAL} component={LegalScreen} />
  </Stack.Navigator>
);

export default AuthStack;
