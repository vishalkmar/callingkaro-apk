import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AppHeader,
  AppModal,
  AppText,
  EmptyState,
  Icon,
  ScreenContainer,
  SkeletonList,
  toast,
} from '@components/common';
import RecordingPlayer from '@components/RecordingPlayer';
import { t } from '@i18n';
import { colors, spacing, TOUCH_TARGET } from '@theme';
import * as recordingsRepo from '@db/recordingsRepo';
import { on, DB_EVENTS } from '@db/events';
import { deleteRecording, saveToPhone, shareRecording } from '@services/recording/recordingService';
import { formatBytes, formatDateTime, formatDuration, formatPhone } from '@utils/format';

const IconBtn = ({ icon, label, onPress, color = colors.subtext }) => (
  <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }} onPress={onPress} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}>
    <Icon name={icon} size={22} color={color} />
  </Pressable>
);

/** Contact, date, duration, size; play/pause + seek; share; save to phone; delete. */
const RecordingsScreen = () => {
  const navigation = useNavigation();
  const [items, setItems] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => setItems(await recordingsRepo.listAll()), []);
  useEffect(() => {
    load();
    return on(DB_EVENTS.RECORDINGS, load);
  }, [load]);

  const save = async rec => {
    try {
      const path = await saveToPhone(rec);
      toast.success(t('recs.saved'), path.replace(/^.*\/Music/, 'Music'));
    } catch (e) {
      toast.error(e.message);
      if (e.code === 'PERMISSION_BLOCKED') {
        Linking.openSettings();
      }
    }
  };

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title={t('recs.title')} onBack={() => navigation.goBack()} />
      {items === null ? (
        <SkeletonList rows={5} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={items.length ? styles.list : styles.flexGrow}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.head}>
                <View style={styles.flex}>
                  <AppText variant="label" numberOfLines={1}>
                    {item.contactName || formatPhone(item.number) || t('recs.unknown')}
                  </AppText>
                  <AppText variant="caption" color="subtext">
                    {formatDateTime(item.createdAt)} - {formatDuration(item.durationSec)} -{' '}
                    {formatBytes(item.sizeBytes)}
                  </AppText>
                </View>
                <IconBtn icon="share-variant-outline" label={t('recs.share')} onPress={() => shareRecording(item)} />
                <IconBtn icon="content-save-outline" label={t('recs.save')} onPress={() => save(item)} />
                <IconBtn
                  icon="delete-outline"
                  label={t('recs.delete')}
                  color={colors.danger}
                  onPress={() => setToDelete(item)}
                />
              </View>
              <RecordingPlayer filePath={item.filePath} durationSec={item.durationSec} compact />
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="record-rec" message={t('recs.empty')} />}
        />
      )}
      <AppModal
        visible={!!toDelete}
        icon="delete-outline"
        iconColor={colors.danger}
        title={t('recs.delTitle')}
        message={t('recs.delBody')}
        secondaryText={t('recs.cancel')}
        onSecondary={() => setToDelete(null)}
        primaryText={t('recs.deleteBtn')}
        primaryDanger
        onPrimary={async () => {
          await deleteRecording(toDelete);
          setToDelete(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  list: { padding: spacing.sm },
  card: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, paddingVertical: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  iconBtn: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});

export default RecordingsScreen;
