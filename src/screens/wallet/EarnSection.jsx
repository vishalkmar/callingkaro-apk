import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { AppButton, AppText, Icon } from '@components/common';
import { colors, spacing, TOUCH_TARGET } from '@theme';
import { t } from '@i18n';
import { formatCountdown } from '@utils/format';

const EarnRow = ({ icon, title, subtitle, action, onAction, disabled, onPress }) => (
  <Pressable
    style={styles.row}
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    android_ripple={onPress ? { color: colors.surfaceAlt } : undefined}>
    <Icon name={icon} size={26} color={colors.primary} />
    <View style={styles.text}>
      <AppText variant="label">{title}</AppText>
      {subtitle ? (
        <AppText variant="caption" color="subtext">
          {subtitle}
        </AppText>
      ) : null}
    </View>
    {action ? (
      <AppButton
        title={action}
        size="small"
        uppercase={false}
        fullWidth={false}
        disabled={disabled}
        onPress={onAction}
      />
    ) : (
      <Icon name="chevron-right" color={colors.subtext} />
    )}
  </Pressable>
);

EarnRow.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  action: PropTypes.string,
  onAction: PropTypes.func,
  disabled: PropTypes.bool,
  onPress: PropTypes.func,
};

const useCountdown = target => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) {
      return undefined;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return target ? formatCountdown(target, now) : null;
};

/** Watch ad (+250, x/20 today), Spin the wheel (free / countdown), Daily check-in, Wallet history. */
const EarnSection = ({ config, busy, onWatchAd, onSpin, onCheckin, onHistory }) => {
  const ads = config?.ads || {};
  const spin = config?.spin || {};
  const checkin = config?.checkin;
  const countdown = useCountdown(spin.freeAvailable ? null : spin.nextFreeAt);
  const spinReady = spin.freeAvailable || spin.extraSpinsAvailable > 0;

  return (
    <View>
      <AppText variant="label" bold style={styles.section}>
        {t('wallet.earnFree')}
      </AppText>
      <EarnRow
        icon="play-circle-outline"
        title={t('wallet.watchAd')}
        subtitle={`+${ads.rewardCredits ?? 250} credits - ${
          ads.unlimited || ads.max == null
            ? t('wallet.noLimit')
            : t('wallet.todayCount', { x: ads.todayCount ?? 0, max: ads.max })
        }`}
        action={t('wallet.watch')}
        onAction={onWatchAd}
        disabled={busy || (ads.remaining != null && ads.remaining <= 0)}
      />
      <EarnRow
        icon="ferris-wheel"
        title={t('wallet.spinTitle')}
        subtitle={
          spinReady
            ? `${t('wallet.spinSub', { max: spin.maxWin ?? 0 })} - ${t('wallet.spinReady')}`
            : `${t('wallet.spinSub', { max: spin.maxWin ?? 0 })} - ${t('wallet.nextSpinIn', {
                time: countdown || '--:--:--',
              })}`
        }
        action={t('wallet.spin')}
        onAction={onSpin}
        disabled={busy}
      />
      {checkin ? (
        <EarnRow
          icon="calendar-check-outline"
          title={t('wallet.checkin')}
          subtitle={
            checkin.claimedToday ? t('wallet.claimedToday') : t('wallet.checkinSub', { credits: checkin.credits })
          }
          action={t('wallet.claim')}
          onAction={onCheckin}
          disabled={busy || checkin.claimedToday}
        />
      ) : null}
      <EarnRow icon="history" title={t('wallet.history')} subtitle={t('wallet.historySub')} onPress={onHistory} />
    </View>
  );
};

EarnSection.propTypes = {
  config: PropTypes.object,
  busy: PropTypes.bool,
  onWatchAd: PropTypes.func.isRequired,
  onSpin: PropTypes.func.isRequired,
  onCheckin: PropTypes.func.isRequired,
  onHistory: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, marginLeft: spacing.sm, minHeight: TOUCH_TARGET, justifyContent: 'center' },
});

export default EarnSection;
