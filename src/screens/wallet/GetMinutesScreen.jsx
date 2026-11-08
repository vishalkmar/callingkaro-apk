import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppButton, AppText, EmptyState, SkeletonBlock, toast } from '@components/common';
import AnimatedNumber from '@components/AnimatedNumber';
import RewardBurst from '@components/RewardBurst';
import { colors, spacing } from '@theme';
import { ROUTES } from '@constants/routes';
import { t } from '@i18n';
import { useWalletStore } from '@store/walletStore';
import { useRewardedAd } from '@hooks/useRewardedAd';
import { claimCheckin } from '@services/api/walletApi';
import { formatNumber } from '@utils/format';
import PackagesSection from './PackagesSection';
import EarnSection from './EarnSection';
import PurchaseDialogs from './PurchaseDialogs';
import { usePurchaseFlow } from './usePurchaseFlow';

/** Image 7: balance, info strip, paid packages, earn-free rows (ads, spin, check-in), wallet history. */
const GetMinutesScreen = () => {
  const navigation = useNavigation();
  const credits = useWalletStore(s => s.credits);
  const config = useWalletStore(s => s.config);
  const refreshWallet = useWalletStore(s => s.refresh);
  const loadConfig = useWalletStore(s => s.loadConfig);
  const setBalance = useWalletStore(s => s.setBalance);
  const [loading, setLoading] = useState(!config);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [burst, setBurst] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const purchase = usePurchaseFlow();

  const load = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([refreshWallet(), loadConfig()]);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [refreshWallet, loadConfig]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (purchase.step === 'success') {
      loadConfig().catch(() => {});
    }
  }, [purchase.step, loadConfig]);

  const ad = useRewardedAd({
    onRewarded: r => {
      setBurst({ title: `+${formatNumber(r.gained)} credits`, subtitle: 'Thanks for watching!' });
      loadConfig().catch(() => {});
    },
  });

  const onCheckin = async () => {
    setCheckingIn(true);
    try {
      const r = await claimCheckin();
      setBalance(r.balance);
      setBurst({ title: `+${r.credits} credits`, subtitle: 'Daily check-in done. See you tomorrow!' });
      loadConfig().catch(() => {});
    } catch (e) {
      toast.error(e.code === 'ALREADY_CLAIMED' ? 'Already claimed today' : e.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const busy = ad.busy || checkingIn || purchase.step === 'buying';

  if (error && !config) {
    return (
      <EmptyState
        icon="cloud-off-outline"
        message="Could not load packages and rewards. Check your internet and try again."
        actionTitle="Retry"
        onAction={load}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <View style={styles.balanceRow}>
          <AppText variant="label">{t('wallet.currentBalance')}</AppText>
          <View style={styles.balanceRight}>
            <AnimatedNumber
              value={Math.floor(credits / 1000)}
              format={v => t('wallet.minutes', { n: v })}
              variant="title"
              color="primary"
              bold
              accessibilityLiveRegion="polite"
            />
            <AnimatedNumber
              value={credits}
              format={v => t('wallet.credits', { n: formatNumber(v) })}
              variant="caption"
              color="subtext"
            />
          </View>
        </View>
        <View style={styles.info}>
          <AppText variant="caption" color="subtext">
            {t('wallet.info')}
          </AppText>
        </View>

        {loading ? (
          <View style={styles.skeleton}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <SkeletonBlock key={i} height={44} style={styles.skelRow} />
            ))}
          </View>
        ) : (
          <>
            <PackagesSection
              packages={config?.packages || []}
              onBuy={purchase.ask}
              disabled={busy}
              taxNote={config?.taxNote}
            />
            <EarnSection
              config={config}
              busy={busy}
              onWatchAd={() => ad.watch('credits')}
              onSpin={() => navigation.navigate(ROUTES.SPIN_WHEEL)}
              onCheckin={onCheckin}
              onHistory={() => navigation.navigate(ROUTES.WALLET_HISTORY)}
            />
          </>
        )}
        {error && config ? <AppButton title="Retry" variant="ghost" onPress={load} style={styles.retry} /> : null}
      </ScrollView>
      <PurchaseDialogs flow={purchase} taxNote={config?.taxNote} />
      <RewardBurst visible={!!burst} title={burst?.title} subtitle={burst?.subtitle} onHide={() => setBurst(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  balanceRight: { alignItems: 'flex-end' },
  info: { backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  skeleton: { padding: spacing.md },
  skelRow: { marginBottom: spacing.sm },
  retry: { marginTop: spacing.md },
});

export default GetMinutesScreen;
