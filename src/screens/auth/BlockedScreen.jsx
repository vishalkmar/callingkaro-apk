import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppButton, AppText, Icon, ScreenContainer } from '@components/common';
import { colors, spacing } from '@theme';
import { CONFIG } from '@constants/config';
import { useAppStore } from '@store/appStore';
import { logout } from '@services/auth/authService';

/** Shown when the server says USER_BLOCKED. */
const BlockedScreen = () => {
  const reason = useAppStore(s => s.blockedReason);
  return (
    <ScreenContainer>
      <View style={styles.wrap}>
        <Icon name="account-cancel-outline" size={72} color={colors.danger} />
        <AppText variant="header" center style={styles.title}>
          Account blocked
        </AppText>
        <AppText color="subtext" center style={styles.msg}>
          {reason || 'Your account has been blocked because of a policy violation or abuse reports.'} If you think this
          is a mistake, contact us and we will review it.
        </AppText>
        <AppButton
          title={`Email ${CONFIG.SUPPORT_EMAIL}`}
          uppercase={false}
          icon="email-outline"
          onPress={() => Linking.openURL(`mailto:${CONFIG.SUPPORT_EMAIL}?subject=Account%20blocked`)}
          style={styles.btn}
        />
        <AppButton title="Logout" variant="ghost" onPress={logout} style={styles.btn} />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { marginTop: spacing.md },
  msg: { marginTop: spacing.xs, lineHeight: 21 },
  btn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});

export default BlockedScreen;
