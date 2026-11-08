import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AppLogo, AppText } from '@components/common';
import { colors, spacing } from '@theme';
import { CONFIG } from '@constants/config';

/** JS splash shown while bootstrap runs (behind the native bootsplash, same look). */
const SplashScreen = () => (
  <View style={styles.wrap}>
    <AppLogo size={88} inverted />
    <AppText variant="header" color="primary" style={styles.name}>
      {CONFIG.APP_NAME}
    </AppText>
    <ActivityIndicator color={colors.primary} style={styles.spinner} />
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  name: { marginTop: spacing.md },
  spinner: { marginTop: spacing.xl },
});

export default SplashScreen;
