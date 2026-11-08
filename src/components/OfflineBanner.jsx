import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText, Icon } from '@components/common';
import { colors, spacing } from '@theme';
import { useNetwork } from '@hooks/useNetwork';
import { t } from '@i18n';

const OfflineBanner = () => {
  const { isOnline } = useNetwork();
  if (isOnline) {
    return null;
  }
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name="wifi-off" size={16} color={colors.white} />
      <AppText variant="caption" color="white" style={styles.text}>
        {t('common.offline')}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxs,
  },
  text: { marginLeft: spacing.xs },
});

export default OfflineBanner;
