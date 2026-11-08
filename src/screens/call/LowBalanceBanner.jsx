import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { AppText, Icon } from '@components/common';
import { colors, spacing, radius } from '@theme';
import { t } from '@i18n';
import { formatDuration } from '@utils/format';
import { CONFIG } from '@constants/config';

/** Mirrors the server's hard time limit: shows "Call will end in 0:45" during the last 60 seconds. */
const LowBalanceBanner = ({ answeredAt, maxSeconds }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!answeredAt || !maxSeconds) {
    return null;
  }
  const remaining = Math.max(0, maxSeconds - Math.floor((now - answeredAt) / 1000));
  if (remaining > CONFIG.LOW_BALANCE_WARNING_SECONDS) {
    return null;
  }
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name="timer-sand" size={18} color={colors.white} />
      <AppText color="white" bold style={styles.text}>
        {t('call.willEndIn', { time: formatDuration(remaining) })}
      </AppText>
    </View>
  );
};

LowBalanceBanner.propTypes = { answeredAt: PropTypes.number, maxSeconds: PropTypes.number };

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  text: { marginLeft: spacing.xs },
});

export default React.memo(LowBalanceBanner);
