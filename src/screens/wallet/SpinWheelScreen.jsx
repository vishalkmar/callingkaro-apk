import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Vibration, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppButton, AppHeader, AppModal, AppText, Icon, ScreenContainer, toast } from '@components/common';
import RewardBurst from '@components/RewardBurst';
import { colors, spacing, radius } from '@theme';
import { t } from '@i18n';
import { useWalletStore } from '@store/walletStore';
import { useSettingsStore } from '@store/settingsStore';
import { useRewardedAd } from '@hooks/useRewardedAd';
import { getSpinStatus, playSpin } from '@services/api/spinApi';
import { formatCountdown, formatNumber } from '@utils/format';
import SpinWheel from './SpinWheel';
import { scheduleFreeSpinReminder } from '@services/notifications/notifications';

/** Spin & Win: server picks the result FIRST, the wheel then animates to exactly that segment. */
const SpinWheelScreen = () => {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const minutes = useWalletStore(s => s.minutes);
  const setBalance = useWalletStore(s => s.setBalance);
  const loadConfig = useWalletStore(s => s.loadConfig);
  const [status, setStatus] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(Date.now());
  const wheel = useRef(null);
  // State updates are async: a fast double tap would read spinning=false twice and send two /spin/play.
  const busyRef = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const st = await getSpinStatus();
      setStatus(st);
      if (!st.freeAvailable) {
        scheduleFreeSpinReminder(st.nextFreeAt);
      }
    } catch (e) {
      toast.error(t('spin.loadFailed'), e.message);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // A won prize that still needs its ad (just won, or left uncollected earlier).
  const [claim, setClaim] = useState(null);
  const ad = useRewardedAd({
    onRewarded: (r, purpose) => {
      if (purpose === 'spin_claim') {
        setClaim(null);
        setResult({ credits: r.gained });
        loadConfig().catch(() => {});
      } else {
        toast.success(t('spin.extraUnlocked'));
      }
      loadStatus();
    },
  });
  const collect = c => ad.watch('spin_claim', { refId: c.spinId, claimVia: c.claimVia });
  const pendingClaim = status?.pendingClaim;

  const canSpin = !!status && (status.freeAvailable || status.extraSpinsAvailable > 0);

  const spin = async () => {
    if (busyRef.current || spinning || !canSpin) {
      return;
    }
    busyRef.current = true;
    setSpinning(true);
    let r;
    try {
      r = await playSpin(); // network first - no result, no animation (never a fake win)
    } catch (e) {
      busyRef.current = false;
      setSpinning(false);
      toast.error(e.code === 'NO_SPINS' ? t('spin.noSpins') : t('spin.failed'), e.message);
      loadStatus();
      return;
    }
    const haptics = useSettingsStore.getState().haptics;
    const ticks = haptics ? setInterval(() => Vibration.vibrate(5), 180) : null;
    wheel.current?.spinTo(r.segmentIndex, () => {
      if (ticks) {
        clearInterval(ticks);
      }
      setBalance(r.balance);
      if (r.claimRequired) {
        setClaim(r); // prize decided: the ad comes first, the credits after it
      } else {
        setResult(r);
      }
      busyRef.current = false;
      setSpinning(false);
      loadStatus();
      loadConfig().catch(() => {});
    });
  };

  const size = Math.min(width - spacing.xxl * 2, 320);
  const nextFree =
    status && !status.freeAvailable && status.nextFreeAt ? formatCountdown(status.nextFreeAt, now) : null;

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader
        title={t('spin.title')}
        onBack={spinning ? undefined : () => navigation.goBack()}
        right={
          <View style={styles.chip}>
            <AppText variant="caption" bold style={styles.chipText}>
              {minutes} min
            </AppText>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.wheelWrap}>
          <View style={styles.pointer} accessibilityElementsHidden>
            <Icon name="menu-down" size={56} color={colors.text} />
          </View>
          {status ? (
            <SpinWheel ref={wheel} segments={status.segments} size={size} />
          ) : (
            <View style={{ width: size, height: size }} />
          )}
          <Pressable android_ripple={{ color: colors.primaryDark, borderless: true }}
            testID="spin-button"
            onPress={spin}
            disabled={!canSpin || spinning}
            style={[styles.center, (!canSpin || spinning) && styles.centerDisabled]}
            accessibilityRole="button"
            accessibilityLabel={canSpin ? t('spin.a11ySpin') : t('spin.a11yNoSpin')}
            accessibilityState={{ disabled: !canSpin || spinning, busy: spinning }}>
            <AppText bold color="white">
              {spinning ? '...' : t('spin.button')}
            </AppText>
          </Pressable>
        </View>

        <AppText center variant="label" style={styles.status}>
          {status?.freeAvailable
            ? t('spin.freeReady')
            : status?.extraSpinsAvailable
            ? t('spin.extraReady', { n: status.extraSpinsAvailable })
            : nextFree
            ? t('spin.nextFree', { time: nextFree })
            : ' '}
        </AppText>
        <AppText center variant="caption" color="subtext">
          {status?.freeIntervalHours === 0
            ? t('spin.upToAnyTime', { max: formatNumber(status?.maxWin ?? 0) })
            : t('spin.upTo', { max: formatNumber(status?.maxWin ?? 0) })}
        </AppText>
        {status?.odds?.length ? (
          // Real chances from the server, shown next to the wheel (no hidden odds).
          <AppText center variant="caption" color="subtext" style={styles.odds} testID="spin-odds">
            {t('spin.odds')}: {status.odds.map(o => t('spin.oddsItem', o)).join('  -  ')}
          </AppText>
        ) : null}

        {pendingClaim && !claim && !spinning ? (
          <AppButton
            testID="spin-collect"
            title={t('spin.claimPending', { credits: formatNumber(pendingClaim.credits) })}
            icon="gift-outline"
            uppercase={false}
            loading={ad.busy}
            disabled={ad.busy}
            onPress={() => collect(pendingClaim)}
            style={styles.adBtn}
          />
        ) : null}

        {status && !status.freeAvailable && !status.extraSpinsAvailable ? (
          <AppButton
            title={status.extraSpinsLeft > 0 ? t('spin.watchExtra', { n: status.extraSpinsLeft }) : t('spin.noExtra')}
            icon="play-circle-outline"
            uppercase={false}
            disabled={status.extraSpinsLeft <= 0 || ad.busy || spinning}
            loading={ad.busy}
            onPress={() => ad.watch('extra_spin')}
            style={styles.adBtn}
          />
        ) : null}
      </ScrollView>

      <RewardBurst
        visible={!!result && result.credits > 0}
        title={t('spin.won', { credits: formatNumber(result?.credits || 0) })}
        subtitle={t('spin.added')}
        onHide={() => setResult(null)}
        duration={2400}
      />
      <AppModal
        visible={!!claim}
        icon="gift-outline"
        title={t('spin.claimTitle', { credits: formatNumber(claim?.credits || 0) })}
        message={t('spin.claimBody')}
        primaryText={t('spin.claimWatch')}
        secondaryText={t('spin.claimLater')}
        onPrimary={() => {
          const c = claim;
          setClaim(null);
          collect(c);
        }}
        onSecondary={() => setClaim(null)}
        onClose={() => setClaim(null)}
      />
      <AppModal
        visible={!!result && result.credits === 0}
        icon="emoticon-wink-outline"
        title={t('spin.zeroTitle')}
        message={t('spin.zeroBody')}
        primaryText="OK"
        onPrimary={() => setResult(null)}
        onClose={() => setResult(null)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.xxl },
  chip: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.sm,
  },
  chipText: { color: colors.primaryText },
  wheelWrap: { alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  pointer: { position: 'absolute', top: -34, zIndex: 2 },
  center: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.success,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  centerDisabled: { backgroundColor: colors.disabled },
  status: { marginTop: spacing.xl },
  odds: { marginTop: spacing.xs },
  adBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});

export default SpinWheelScreen;
