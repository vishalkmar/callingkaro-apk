import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PermissionScreen from '@screens/permissions/PermissionScreen';
import { PERMISSION_STEPS } from '@screens/permissions/permissionSteps';

const Stack = createNativeStackNavigator();

// Contacts -> Microphone -> Notifications -> Bluetooth -> Storage (one template screen, different step data).
const PermissionStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
    {PERMISSION_STEPS.map((step, index) => (
      <Stack.Screen
        key={step.route}
        name={step.route}
        component={PermissionScreen}
        initialParams={{ stepIndex: index }}
      />
    ))}
  </Stack.Navigator>
);

export default PermissionStack;
