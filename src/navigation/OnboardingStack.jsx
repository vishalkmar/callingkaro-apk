import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '@constants/routes';
import WelcomeScreen from '@screens/onboarding/WelcomeScreen';
import LegalScreen from '@screens/onboarding/LegalScreen';

const Stack = createNativeStackNavigator();

// Splash is the native bootsplash + RootNavigator's loading stage; first visible screen is Welcome.
const OnboardingStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name={ROUTES.WELCOME} component={WelcomeScreen} />
    <Stack.Screen name={ROUTES.LEGAL} component={LegalScreen} />
  </Stack.Navigator>
);

export default OnboardingStack;
