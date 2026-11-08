import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { AppText, Icon } from '@components/common';
import { colors, spacing } from '@theme';
import { t } from '@i18n';

export const ControlButton = ({ icon, label, onPress, active = false, disabled = false, danger = false }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={styles.control}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled, selected: active }}
    android_ripple={{ color: colors.inCallShape, borderless: true, radius: 36 }}>
    <View style={[styles.circle, active && (danger ? styles.circleDanger : styles.circleActive)]}>
      <Icon name={icon} size={26} color={disabled ? colors.disabled : active ? colors.white : colors.text} />
    </View>
    <AppText variant="caption" style={[styles.label, disabled && styles.labelDisabled]}>
      {label}
    </AppText>
  </Pressable>
);

ControlButton.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  danger: PropTypes.bool,
};

/**
 * Image 8 grid (same positions):  Notes | Add call | Mute
 *                                 Record | Contacts | Hold
 * Mute/Hold are grey until connected; Add call is disabled in v1.
 */
const CallControls = ({
  connected,
  ended,
  isMuted,
  isOnHold,
  isRecording,
  onNotes,
  onMute,
  onRecord,
  onContacts,
  onHold,
}) => (
  <View style={styles.grid}>
    <View style={styles.row}>
      <ControlButton icon="note-text-outline" label={t('call.notes')} onPress={onNotes} disabled={ended} />
      <ControlButton icon="plus-circle-outline" label={t('call.addCall')} disabled />
      <ControlButton
        icon={isMuted ? 'microphone-off' : 'microphone-outline'}
        label={t('call.mute')}
        onPress={onMute}
        active={isMuted}
        disabled={!connected}
      />
    </View>
    <View style={styles.row}>
      <ControlButton
        icon="record-rec"
        label={isRecording ? t('call.recTag') : t('call.record')}
        onPress={onRecord}
        active={isRecording}
        danger
        disabled={ended}
      />
      <ControlButton icon="account-box-outline" label={t('call.contacts')} onPress={onContacts} disabled={ended} />
      <ControlButton
        icon={isOnHold ? 'play-circle-outline' : 'pause-circle-outline'}
        label={isOnHold ? t('call.resume') : t('call.hold')}
        onPress={onHold}
        active={isOnHold}
        disabled={!connected}
      />
    </View>
  </View>
);

CallControls.propTypes = {
  connected: PropTypes.bool,
  ended: PropTypes.bool,
  isMuted: PropTypes.bool,
  isOnHold: PropTypes.bool,
  isRecording: PropTypes.bool,
  onNotes: PropTypes.func,
  onMute: PropTypes.func,
  onRecord: PropTypes.func,
  onContacts: PropTypes.func,
  onHold: PropTypes.func,
};

const styles = StyleSheet.create({
  grid: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.lg },
  control: { alignItems: 'center', width: 88 },
  circle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  circleActive: { backgroundColor: colors.primary },
  circleDanger: { backgroundColor: colors.danger },
  label: { marginTop: spacing.xxs, color: colors.text },
  labelDisabled: { color: colors.disabled },
});

export default React.memo(CallControls);
