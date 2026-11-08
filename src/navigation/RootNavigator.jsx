import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { STACKS, ROUTES } from '@constants/routes';
import { useAppStore } from '@store/appStore';
import SplashScreen from '@screens/onboarding/SplashScreen';
import BlockedScreen from '@screens/auth/BlockedScreen';
import OnboardingStack from './OnboardingStack';
import AuthStack from './AuthStack';
import PermissionStack from './PermissionStack';
import MainStack from './MainStack';

const Root = createNativeStackNavigator();

/**
 * Exactly one stack is mounted per app stage. Changing `stage` in appStore swaps the stack,
 * which behaves like navigation.reset (the previous stack is unmounted - no back navigation).
 */
const RootNavigator = () => {
  const stage = useAppStore(s => s.stage);

  return (
    <Root.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {stage === 'loading' ? <Root.Screen name={ROUTES.SPLASH} component={SplashScreen} /> : null}
      {stage === 'onboarding' ? <Root.Screen name={STACKS.ONBOARDING} component={OnboardingStack} /> : null}
      {stage === 'auth' ? <Root.Screen name={STACKS.AUTH} component={AuthStack} /> : null}
      {stage === 'permissions' ? <Root.Screen name={STACKS.PERMISSIONS} component={PermissionStack} /> : null}
      {stage === 'main' ? <Root.Screen name={STACKS.MAIN} component={MainStack} /> : null}
      {stage === 'blocked' ? <Root.Screen name={STACKS.BLOCKED} component={BlockedScreen} /> : null}
    </Root.Navigator>
  );
};

export default RootNavigator;
