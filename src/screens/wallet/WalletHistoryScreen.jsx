import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, AppText, EmptyState, Icon, ScreenContainer, SkeletonList } from '@components/common';
import { colors, spacing } from '@theme';
import { getLedger } from '@services/api/walletApi';
import { formatDateTime, formatNumber, formatPhone } from '@utils/format';

const TYPE_UI = {
  purchase: { icon: 'cart-check', title: e => `Purchase - ${e.meta?.minutes || ''} min`.trim() },
  ad_reward: { icon: 'play-circle-outline', title: () => 'Ad reward' },
  spin_reward: { icon: 'ferris-wheel', title: () => 'Spin reward' },
  welcome_bonus: { icon: 'gift-outline', title: () => 'Welcome bonus' },
  checkin_reward: { icon: 'calendar-check-outline', title: () => 'Daily check-in' },
  referral_bonus: { icon: 'account-multiple-plus-outline', title: () => 'Referral bonus' },
  call_charge: { icon: 'phone-outgoing', title: e => `Call to ${formatPhone(e.meta?.to) || 'number'}` },
  refund: { icon: 'cash-refund', title: () => 'Refund' },
  payment_reversal: { icon: 'cash-remove', title: () => 'Payment refunded' },
  admin_adjust: { icon: 'account-wrench-outline', title: e => e.meta?.reason || 'Support adjustment' },
};

const Row = React.memo(({ entry }) => {
  const ui = TYPE_UI[entry.type] || { icon: 'swap-horizontal', title: () => entry.type };
  const positive = entry.amount > 0;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${ui.title(entry)}, ${positive ? 'plus' : 'minus'} ${Math.abs(entry.amount)} credits`}>
      <View style={styles.iconWrap}>
        <Icon name={ui.icon} size={22} color={positive ? colors.success : colors.danger} />
      </View>
      <View style={styles.text}>
        <AppText numberOfLines={1}>{ui.title(entry)}</AppText>
        <AppText variant="caption" color="subtext">
          {formatDateTime(entry.createdAt)}
          {entry.meta?.receiptNo ? `  -  ${entry.meta.receiptNo}` : ''}
        </AppText>
      </View>
      <View style={styles.amounts}>
        <AppText bold style={{ color: positive ? colors.success : colors.danger }}>
          {positive ? '+' : '-'}
          {formatNumber(Math.abs(entry.amount))}
        </AppText>
        <AppText variant="caption" color="subtext">
          bal {formatNumber(entry.balanceAfter)}
        </AppText>
      </View>
    </View>
  );
});

/** Ledger rows: icon by type, title, green + / red - amount, date, balance after. Receipts for purchases. */
const WalletHistoryScreen = () => {
  const navigation = useNavigation();
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadFirst = useCallback(async () => {
    setError(null);
    try {
      const r = await getLedger(1);
      setItems(r.items);
      setPage(1);
      setHasMore(r.hasMore);
    } catch (e) {
      setError(e);
      setItems(prev => prev || []);
    }
  }, []);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const r = await getLedger(page + 1);
      setItems(prev => [...prev, ...r.items]);
      setPage(page + 1);
      setHasMore(r.hasMore);
    } catch (e) {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title="Wallet history" onBack={() => navigation.goBack()} />
      {items === null ? (
        <SkeletonList rows={8} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={e => e.id}
          renderItem={({ item }) => <Row entry={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[colors.primary]}
              onRefresh={async () => {
                setRefreshing(true);
                await loadFirst();
                setRefreshing(false);
              }}
            />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null}
          ListEmptyComponent={
            error ? (
              <EmptyState
                icon="cloud-off-outline"
                message="Could not load your wallet history."
                actionTitle="Retry"
                onAction={loadFirst}
              />
            ) : (
              <EmptyState icon="wallet-outline" message="No wallet activity yet." />
            )
          }
          contentContainerStyle={items.length ? undefined : styles.flexGrow}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flexGrow: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  iconWrap: { width: 36 },
  text: { flex: 1 },
  amounts: { alignItems: 'flex-end', marginLeft: spacing.xs },
  footer: { padding: spacing.md },
});

export default WalletHistoryScreen;
