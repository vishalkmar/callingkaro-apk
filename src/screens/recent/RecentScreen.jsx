import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppModal, AppText, EmptyState, Icon, SectionHeader, SkeletonList, toast } from '@components/common';
import PromoCard from '@components/PromoCard';
import { colors, spacing, radius, TOUCH_TARGET } from '@theme';
import { ROUTES } from '@constants/routes';
import { t } from '@i18n';
import { useCallLogs } from '@hooks/useCallLogs';
import * as callLogRepo from '@db/callLogRepo';
import { on, DB_EVENTS } from '@db/events';
import { placeCall } from '@services/calls/placeCall';
import { clearHistoryAndRecordings } from '@services/recording/recordingService';
import { useWalletStore } from '@store/walletStore';
import { dayGroup, formatDuration } from '@utils/format';
import CallRow from './CallRow';

const FILTERS = [
  { key: 'all', label: () => t('recent.all') },
  { key: 'connected', label: () => t('recent.connected') },
  { key: 'notConnected', label: () => t('recent.notConnected') },
];

/** Dialer-style history (Image 6) grouped Today / Yesterday / This week / Older. */
const RecentScreen = () => {
  const navigation = useNavigation();
  const [filter, setFilter] = useState('all');
  const { items, loading, loadingMore, hasMore, loadMore } = useCallLogs(filter);
  const [monthSeconds, setMonthSeconds] = useState(0);
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const adsCfg = useWalletStore(s => s.config?.ads);
  const adCredits =
    adsCfg?.rewardMin != null && adsCfg?.rewardMax > adsCfg?.rewardMin
      ? `${adsCfg.rewardMin}-${adsCfg.rewardMax}`
      : adsCfg?.rewardCredits || 50;
  const pendingDelete = useRef(null);

  useEffect(() => {
    const refresh = () => callLogRepo.monthTalkSeconds().then(setMonthSeconds);
    refresh();
    return on(DB_EVENTS.CALL_LOGS, refresh);
  }, []);

  const rows = useMemo(() => {
    const out = [];
    let last = null;
    for (const log of items) {
      const g = dayGroup(log.startedAt);
      if (g !== last) {
        out.push({ type: 'header', key: `h-${g}`, title: g });
        last = g;
      }
      out.push({ type: 'row', key: `c-${log.id}`, log });
    }
    return out;
  }, [items]);

  const openDetails = useCallback(log => navigation.navigate(ROUTES.CALL_DETAILS, { id: log.id }), [navigation]);
  const callBack = useCallback(log => placeCall({ number: log.number, name: log.contactName }), []);

  // Swipe-to-delete with an undo snackbar (the row is restored if the user taps the toast).
  const onDelete = useCallback(async log => {
    pendingDelete.current = log;
    await callLogRepo.remove(log.id);
    toast.action(t('recent.deleted'), t('common.undo'), async () => {
      if (pendingDelete.current?.id === log.id) {
        await callLogRepo.restore(log);
        pendingDelete.current = null;
      }
    });
  }, []);

  const renderItem = useCallback(
    ({ item }) =>
      item.type === 'header' ? (
        <SectionHeader title={item.title} />
      ) : (
        <CallRow log={item.log} onPress={openDetails} onCallBack={callBack} onDelete={onDelete} />
      ),
    [openDetails, callBack, onDelete],
  );

  const header = (
    <View>
      <PromoCard
        title={t('recent.promoTitle')}
        body={t('recent.promoBody', { credits: adCredits })}
        icon="play-circle-outline"
        onPress={() => navigation.navigate(ROUTES.GET_MINUTES)}
      />
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <Pressable android_ripple={{ color: colors.surfaceAlt }}
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.key }}>
            <AppText variant="caption" bold style={{ color: filter === f.key ? colors.white : colors.subtext }}>
              {f.label()}
            </AppText>
          </Pressable>
        ))}
        <View style={styles.flex} />
        <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }}
          onPress={() => setMenu(true)}
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel="History options">
          <Icon name="dots-vertical" color={colors.subtext} />
        </Pressable>
      </View>
      {monthSeconds > 0 ? (
        <AppText variant="caption" color="subtext" style={styles.month}>
          {t('recent.monthTalk', { time: formatDuration(monthSeconds) })}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      {loading ? (
        <>
          {header}
          <SkeletonList rows={7} />
        </>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.key}
          renderItem={renderItem}
          ListHeaderComponent={header}
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.4}
          initialNumToRender={15}
          windowSize={9}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="phone-log-outline"
              message={t('recent.empty')}
              actionTitle="Open Dialpad"
              onAction={() => navigation.navigate(ROUTES.DIALPAD)}
            />
          }
          contentContainerStyle={rows.length ? undefined : styles.flexGrow}
        />
      )}

      <AppModal
        visible={menu}
        title="Call history"
        onClose={() => setMenu(false)}
        primaryText={t('recent.clearAll')}
        primaryDanger
        onPrimary={() => {
          setMenu(false);
          setConfirmClear(true);
        }}
        secondaryText={t('common.close')}
      />
      <AppModal
        visible={confirmClear}
        icon="delete-alert-outline"
        iconColor={colors.danger}
        title={t('recent.clearAll')}
        message={t('recent.clearConfirm')}
        secondaryText={t('common.cancel')}
        onSecondary={() => setConfirmClear(false)}
        primaryText={t('common.delete')}
        primaryDanger
        onPrimary={async () => {
          setConfirmClear(false);
          await clearHistoryAndRecordings();
          toast.success('Call history cleared');
        }}
        onClose={() => setConfirmClear(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  filters: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.xs,
  },
  chipActive: { backgroundColor: colors.primary },
  more: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  month: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxs },
  footer: { padding: spacing.md },
});

export default RecentScreen;
