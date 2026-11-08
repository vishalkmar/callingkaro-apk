import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { AppHeader, AppModal, AppText, Avatar, EmptyState, Icon, ScreenContainer, toast } from '@components/common';
import RecordingPlayer from '@components/RecordingPlayer';
import { colors, spacing, radius, TOUCH_TARGET } from '@theme';
import { ROUTES } from '@constants/routes';
import * as callLogRepo from '@db/callLogRepo';
import * as recordingsRepo from '@db/recordingsRepo';
import { on, DB_EVENTS } from '@db/events';
import { placeCall } from '@services/calls/placeCall';
import { openAddContact } from '@services/contacts/contactsService';
import { deleteCallLogWithRecordings, downloadForCall } from '@services/recording/recordingService';
import { formatDate, formatDuration, formatNumber, formatPhone, formatTime } from '@utils/format';
import { statusInfo } from './callStatus';

const InfoRow = ({ label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <AppText color="subtext">{label}</AppText>
    <AppText bold style={valueColor ? { color: valueColor } : undefined}>
      {value}
    </AppText>
  </View>
);

const Action = ({ icon, label, onPress, color = colors.primary }) => (
  <Pressable
    style={styles.action}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    android_ripple={{ color: colors.surfaceAlt, borderless: true }}>
    <Icon name={icon} color={color} />
    <AppText variant="caption" style={styles.actionLabel}>
      {label}
    </AppText>
  </Pressable>
);

/** Avatar + name + number, action row, info card, recording player, previous calls with this number. */
const CallDetailsScreen = () => {
  const navigation = useNavigation();
  const { params } = useRoute();
  const [log, setLog] = useState(null);
  const [history, setHistory] = useState([]);
  const [recording, setRecording] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fetchingRec, setFetchingRec] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const row = await callLogRepo.getById(params?.id);
    setLog(row || null);
    setMissing(!row);
    if (row) {
      setHistory((await callLogRepo.byNumber(row.number, 50)).filter(c => c.id !== row.id));
      setRecording((await recordingsRepo.listByCall(row.id))[0] || null);
    }
  }, [params?.id]);

  useEffect(() => {
    load();
    const off1 = on(DB_EVENTS.CALL_LOGS, load);
    const off2 = on(DB_EVENTS.RECORDINGS, load);
    return () => {
      off1();
      off2();
    };
  }, [load]);

  if (!log) {
    return (
      <ScreenContainer statusBarColor={colors.primary}>
        <AppHeader title="Call details" onBack={() => navigation.goBack()} />
        {missing ? <EmptyState icon="phone-off" message="This call is no longer in your history." /> : null}
      </ScreenContainer>
    );
  }

  const info = statusInfo(log.status);
  const ringSeconds = log.answeredAt ? Math.round((log.answeredAt - log.startedAt) / 1000) : null;

  const doDelete = async withRecording => {
    setConfirmDelete(false);
    await deleteCallLogWithRecordings(log.id, { deleteFiles: withRecording });
    toast.success('Call deleted');
    navigation.goBack();
  };

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title="Call details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Avatar name={log.contactName} size={72} />
          <AppText variant="header" style={styles.name} center>
            {log.contactName || formatPhone(log.number)}
          </AppText>
          {log.contactName ? <AppText color="subtext">{formatPhone(log.number)}</AppText> : null}
        </View>

        <View style={styles.actions}>
          <Action
            icon="phone"
            label="Call"
            color={colors.success}
            onPress={() => placeCall({ number: log.number, name: log.contactName })}
          />
          <Action icon="account-plus-outline" label="Add contact" onPress={() => openAddContact(log.number)} />
          <Action
            icon="content-copy"
            label="Copy"
            onPress={() => {
              Clipboard.setString(log.number);
              toast.success('Number copied');
            }}
          />
          <Action
            icon="flag-outline"
            label="Report"
            color={colors.danger}
            onPress={() => navigation.navigate(ROUTES.REPORT, { number: log.number, callSid: log.callSid })}
          />
          <Action icon="delete-outline" label="Delete" color={colors.danger} onPress={() => setConfirmDelete(true)} />
        </View>

        <View style={styles.card}>
          <InfoRow label="Date" value={formatDate(log.startedAt)} />
          <InfoRow label="Start" value={formatTime(log.startedAt)} />
          <InfoRow label="End" value={log.endedAt ? formatTime(log.endedAt) : '-'} />
          {ringSeconds !== null ? <InfoRow label="Ring time" value={`${ringSeconds}s`} /> : null}
          <InfoRow label="Talk duration" value={formatDuration(log.talkSeconds)} />
          <InfoRow
            label="Credits used"
            value={`${formatNumber(log.creditsUsed)} cr${log.reconciled || !log.talkSeconds ? '' : ' (pending)'}`}
          />
          <InfoRow label="Status" value={info.label} valueColor={info.color} />
          <InfoRow label="Caller ID used" value={log.callerIdUsed ? formatPhone(log.callerIdUsed) : '-'} />
          {log.endReason === 'balance_finished' ? (
            <InfoRow label="Ended because" value="Balance finished" valueColor={colors.danger} />
          ) : null}
          {log.notes ? (
            <View style={styles.notes}>
              <AppText color="subtext">Notes</AppText>
              <AppText style={styles.notesText}>{log.notes}</AppText>
            </View>
          ) : null}
        </View>

        {recording ? (
          <View style={styles.section}>
            <AppText variant="label" bold style={styles.sectionTitle}>
              Recording
            </AppText>
            <RecordingPlayer filePath={recording.filePath} durationSec={recording.durationSec} />
          </View>
        ) : log.callSid && log.talkSeconds > 0 ? (
          <Pressable
            style={styles.fetchRec}
            android_ripple={{ color: colors.surfaceAlt }}
            accessibilityRole="button"
            accessibilityState={{ busy: fetchingRec, disabled: fetchingRec }}
            disabled={fetchingRec}
            onPress={async () => {
              setFetchingRec(true);
              try {
                await downloadForCall({ callLogId: log.id, callSid: log.callSid, attempts: 1 });
                toast.success('Recording downloaded');
              } catch (e) {
                toast.info('No recording for this call', e.code === 'STORAGE_FULL' ? e.message : undefined);
              } finally {
                setFetchingRec(false);
              }
            }}>
            <Icon name="cloud-download-outline" size={18} color={colors.subtext} />
            <AppText variant="caption" color="subtext" style={styles.fetchText}>
              {fetchingRec ? 'Checking...' : 'Check for a recording of this call'}
            </AppText>
          </Pressable>
        ) : null}

        {history.length ? (
          <View style={styles.section}>
            <AppText variant="label" bold style={styles.sectionTitle}>
              Previous calls
            </AppText>
            {history.map(h => {
              const s = statusInfo(h.status);
              return (
                <Pressable
                  key={h.id}
                  style={styles.histRow}
                  android_ripple={{ color: colors.surfaceAlt }}
                  onPress={() => navigation.push(ROUTES.CALL_DETAILS, { id: h.id })}
                  accessibilityRole="button">
                  <Icon name={s.icon} size={16} color={s.color} />
                  <AppText style={styles.histText}>
                    {formatDate(h.startedAt)}, {formatTime(h.startedAt)}
                  </AppText>
                  <AppText variant="caption" color="subtext">
                    {h.talkSeconds ? `${formatDuration(h.talkSeconds)} - ${formatNumber(h.creditsUsed)} cr` : s.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <AppModal
        visible={confirmDelete}
        icon="delete-outline"
        iconColor={colors.danger}
        title="Delete this call?"
        message={
          recording
            ? 'This call has a recording. Delete the recording from your phone too?'
            : 'It will be removed from your call history on this phone.'
        }
        secondaryText={recording ? 'Keep recording' : 'Cancel'}
        onSecondary={recording ? () => doDelete(false) : () => setConfirmDelete(false)}
        primaryText="Delete"
        primaryDanger
        onPrimary={() => doDelete(true)}
        onClose={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  head: { alignItems: 'center', paddingVertical: spacing.md },
  name: { marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.sm },
  action: { alignItems: 'center', minWidth: TOUCH_TARGET + 8, minHeight: TOUCH_TARGET, justifyContent: 'center' },
  actionLabel: { marginTop: spacing.xxs },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xxs + 2 },
  notes: { marginTop: spacing.xs },
  notesText: { marginTop: spacing.xxs },
  section: { marginTop: spacing.lg },
  sectionTitle: { marginBottom: spacing.xs },
  fetchRec: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, minHeight: TOUCH_TARGET },
  fetchText: { marginLeft: spacing.xs },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  histText: { flex: 1, marginLeft: spacing.xs },
});

export default CallDetailsScreen;
