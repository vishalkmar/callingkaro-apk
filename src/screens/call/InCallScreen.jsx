import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, AppModal, AppText, Icon, toast } from '@components/common';
import { colors, spacing, radius, typography, fontSize } from '@theme';
import { ROUTES } from '@constants/routes';
import { t } from '@i18n';
import { useCallStore } from '@store/callStore';
import { useWalletStore } from '@store/walletStore';
import * as callLogRepo from '@db/callLogRepo';
import voiceService from '@services/voice/voiceService';
import { keyFeedback } from '@services/audio/tones';
import { formatDuration, formatNumber, formatPhone } from '@utils/format';
import InCallBackground from './InCallBackground';
import CallControls, { ControlButton } from './CallControls';
import CallTimer from './CallTimer';
import LowBalanceBanner from './LowBalanceBanner';
import InCallKeypad from './InCallKeypad';
import { ContactsPickerSheet, NotesSheet } from './InCallSheets';

const SUMMARY_MS = 2000;

/** Image 8 layout: name + number + status on top, 2x3 controls, keypad | red end | speaker at the bottom. */
const InCallScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const call = useCallStore(s => s.activeCall);
  const status = useCallStore(s => s.status);
  const answeredAt = useCallStore(s => s.answeredAt);
  const isMuted = useCallStore(s => s.isMuted);
  const isOnHold = useCallStore(s => s.isOnHold);
  const isSpeaker = useCallStore(s => s.isSpeaker);
  const isRecording = useCallStore(s => s.isRecording);
  const audioRoutes = useCallStore(s => s.audioRoutes);
  const audioRoute = useCallStore(s => s.audioRoute);
  const dtmf = useCallStore(s => s.dtmf);
  const summary = useCallStore(s => s.summary);
  const endReason = useCallStore(s => s.endReason);
  const error = useCallStore(s => s.error);
  const minutes = useWalletStore(s => s.minutes);

  const [keypad, setKeypad] = useState(false);
  const [notes, setNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [contacts, setContacts] = useState(false);
  const [routePicker, setRoutePicker] = useState(false);

  const ended = status === 'ended';
  const connected = status === 'connected' || status === 'reconnecting';
  const balanceFinished = ended && endReason === 'balance_finished';

  // Android back does nothing on the call screen (it cannot be swiped away either).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const close = useCallback(() => {
    useCallStore.getState().clear();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // Summary card for 2s, then back (unless the balance ran out - then the user chooses).
  useEffect(() => {
    if (!ended || balanceFinished || notes) {
      return undefined; // notes sheet open: wait, the user is still typing
    }
    const id = setTimeout(close, summary?.exact ? SUMMARY_MS : SUMMARY_MS + 1500);
    return () => clearTimeout(id);
  }, [ended, balanceFinished, summary?.exact, close, notes]);

  useEffect(() => {
    if (error) {
      toast.error(t('call.failedTitle'), error);
    }
  }, [error]);

  if (!call) {
    return (
      <View style={styles.root}>
        <InCallBackground />
      </View>
    );
  }

  const statusLine = () => {
    if (ended) {
      return t('call.ended');
    }
    if (status === 'ending') {
      return t('call.ending');
    }
    if (status === 'reconnecting') {
      return t('call.reconnecting');
    }
    if (connected && isOnHold) {
      return t('call.onHold');
    }
    if (status === 'ringing') {
      return t('call.ringing');
    }
    if (connected && answeredAt) {
      return null; // timer
    }
    return t('call.calling');
  };

  const onRecord = async () => {
    const r = await voiceService.toggleRecording();
    if (!r.ok) {
      toast.error(t('call.recording'), r.message);
    } else if (!useCallStore.getState().isRecording) {
      toast.info(t('call.recStopped'));
    } else {
      toast.info(t('call.recOn'), connected ? t('call.recOnConnected') : t('call.recOnArmed'));
    }
  };

  const onSpeaker = () => {
    if (audioRoutes.includes('bluetooth')) {
      setRoutePicker(true);
    } else {
      voiceService.toggleSpeaker();
    }
  };

  // Save button and closing the sheet both land here; only write when the text changed.
  const saveNotes = async text => {
    setNotes(false);
    if (typeof text !== 'string' || text === notesText) {
      return;
    }
    setNotesText(text);
    if (call.localId) {
      await callLogRepo.updateNotes(call.localId, text);
      toast.success(t('call.notesSaved'));
    }
  };

  const line = statusLine();

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <InCallBackground />
      <View style={[styles.top, { paddingTop: insets.top + spacing.xl }]}>
        <AppText style={styles.name} numberOfLines={2} center accessibilityRole="header">
          {call.name || formatPhone(call.number)}
        </AppText>
        <AppText color="subtext" center>
          {formatPhone(call.number)} {t('call.india')}
        </AppText>
        <View style={styles.statusRow}>
          <View style={styles.tag}>
            <Icon name="wifi" size={12} color={colors.white} />
            <AppText style={styles.tagText}>{t('call.viaInternet')}</AppText>
          </View>
          {line ? (
            <AppText color="subtext" style={styles.status} accessibilityLiveRegion="polite">
              {line}
            </AppText>
          ) : (
            <CallTimer since={answeredAt} style={styles.status} />
          )}
          {isRecording && !ended ? (
            <View style={styles.rec} accessibilityLabel={t('call.recording')}>
              <View style={styles.recDot} />
              <AppText variant="caption" color="danger" bold>
                {t('call.recTag')}
              </AppText>
            </View>
          ) : null}
        </View>
        {!ended ? (
          <AppText variant="caption" color="subtext" center style={styles.balance}>
            {t('call.balanceLeft', { min: minutes })}
          </AppText>
        ) : null}
        {dtmf ? (
          <AppText center style={styles.dtmf} numberOfLines={1}>
            {dtmf}
          </AppText>
        ) : null}
        {connected ? <LowBalanceBanner answeredAt={answeredAt} maxSeconds={call.maxSeconds} /> : null}
      </View>

      <View style={styles.middle}>
        {ended ? (
          <View style={styles.summary} accessibilityLiveRegion="polite">
            <AppText variant="title" center>
              {balanceFinished ? t('call.endedBalance') : t('call.ended')}
            </AppText>
            <View style={styles.summaryRow}>
              <AppText color="subtext">{t('call.duration')}</AppText>
              <AppText bold>{formatDuration(summary?.talkSeconds || 0)}</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText color="subtext">{t('call.creditsUsed')}</AppText>
              <AppText bold>
                {formatNumber(summary?.credits || 0)}
                {summary?.exact ? '' : ` ${t('call.estimated')}`}
              </AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText color="subtext">{t('call.newBalance')}</AppText>
              <AppText bold>
                {summary?.balance != null ? t('call.minShort', { n: Math.floor(summary.balance / 1000) }) : '...'}
              </AppText>
            </View>
            {balanceFinished ? (
              <>
                <AppButton
                  title={t('call.getMinutes')}
                  onPress={() => {
                    close();
                    navigation.navigate(ROUTES.MAIN_TABS, { screen: ROUTES.GET_MINUTES });
                  }}
                  style={styles.summaryBtn}
                />
                <AppButton title={t('call.close')} variant="ghost" onPress={close} />
              </>
            ) : null}
          </View>
        ) : keypad ? (
          <InCallKeypad
            onDigit={d => {
              keyFeedback(d);
              voiceService.sendDigit(d);
            }}
          />
        ) : (
          <CallControls
            connected={connected}
            ended={ended}
            isMuted={isMuted}
            isOnHold={isOnHold}
            isRecording={isRecording}
            onNotes={() => setNotes(true)}
            onMute={voiceService.toggleMute}
            onRecord={onRecord}
            onContacts={() => setContacts(true)}
            onHold={voiceService.toggleHold}
          />
        )}
      </View>

      {!ended ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <ControlButton
            icon="dialpad"
            label={keypad ? t('call.hide') : t('call.keypad')}
            onPress={() => setKeypad(k => !k)}
            active={keypad}
            disabled={!connected}
          />
          <Pressable android_ripple={{ color: colors.dangerText, borderless: true, radius: 36 }}
            testID="end-call"
            onPress={voiceService.endCall}
            disabled={status === 'ending'}
            style={[styles.end, status === 'ending' && styles.endBusy]}
            accessibilityRole="button"
            accessibilityLabel={t('call.endCall')}>
            <Icon name="phone-hangup" size={34} color={colors.white} />
          </Pressable>
          <ControlButton
            icon={audioRoute === 'bluetooth' ? 'bluetooth-audio' : isSpeaker ? 'volume-high' : 'volume-medium'}
            label={audioRoute === 'bluetooth' ? t('call.bluetooth') : t('call.speaker')}
            onPress={onSpeaker}
            active={isSpeaker || audioRoute === 'bluetooth'}
          />
        </View>
      ) : null}

      <NotesSheet visible={notes} initial={notesText} onSave={saveNotes} onClose={saveNotes} />
      <ContactsPickerSheet visible={contacts} onClose={() => setContacts(false)} />
      <AppModal
        visible={routePicker}
        title={t('call.audioOutput')}
        onClose={() => setRoutePicker(false)}
        secondaryText={t('call.close')}
        onSecondary={() => setRoutePicker(false)}>
        {[
          ['earpiece', t('call.phone'), 'cellphone'],
          ['speaker', t('call.speaker'), 'volume-high'],
          ['bluetooth', t('call.bluetooth'), 'bluetooth-audio'],
        ]
          .filter(([type]) => type !== 'bluetooth' || audioRoutes.includes('bluetooth'))
          .map(([type, label, icon]) => (
            <Pressable android_ripple={{ color: colors.surfaceAlt }}
              key={type}
              style={styles.routeRow}
              onPress={() => {
                voiceService.setAudioRoute(type, { byUser: true });
                setRoutePicker(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: audioRoute === type }}>
              <Icon name={icon} color={audioRoute === type ? colors.primary : colors.subtext} />
              <AppText style={styles.routeLabel}>{label}</AppText>
              {audioRoute === type ? <Icon name="check" color={colors.primary} /> : null}
            </Pressable>
          ))}
      </AppModal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.inCallBgTop },
  top: { alignItems: 'center', paddingHorizontal: spacing.lg },
  name: { ...typography.callName, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xxs + 2,
    paddingVertical: 1,
    marginRight: spacing.xs,
  },
  tagText: { fontSize: fontSize.micro, color: colors.white, marginLeft: 2, fontWeight: '700' },
  status: { ...typography.label, color: colors.subtext },
  rec: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: 4 },
  balance: { marginTop: spacing.xxs },
  dtmf: { ...typography.header, letterSpacing: 2, marginTop: spacing.xs, color: colors.text },
  middle: { flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.md },
  bottom: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: spacing.lg },
  end: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  endBusy: { opacity: 0.6 },
  summary: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  summaryBtn: { marginTop: spacing.lg },
  routeRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  routeLabel: { flex: 1, marginLeft: spacing.sm },
});

export default InCallScreen;
