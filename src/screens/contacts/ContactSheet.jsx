import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { AppText, Avatar, CallButton, Icon } from '@components/common';
import { colors, spacing, radius, TOUCH_TARGET } from '@theme';
import { formatPhone } from '@utils/format';

/** Bottom sheet with every number of a contact, each with its own call button. */
const ContactSheet = ({ contact, visible, onClose, onCall, onDial, onToggleFavorite, favoriteNumbers }) => {
  const insets = useSafeAreaInsets();
  if (!contact) {
    return null;
  }
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Avatar name={contact.name} uri={contact.thumbnail} size={56} />
            <AppText variant="title" style={styles.name} numberOfLines={2}>
              {contact.name || formatPhone(contact.numbers[0]?.e164)}
            </AppText>
          </View>
          {contact.numbers.map(n => {
            const fav = favoriteNumbers?.has(n.e164);
            return (
              <View key={n.e164} style={styles.row}>
                <Pressable android_ripple={{ color: colors.surfaceAlt }}
                  style={styles.numberCol}
                  onPress={() => onDial(n.e164)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${n.e164} in dialpad`}>
                  <AppText variant="label">{formatPhone(n.e164)}</AppText>
                  <AppText variant="caption" color="subtext">
                    {n.label}
                    {!n.valid ? ' - not a valid Indian number' : ''}
                  </AppText>
                </Pressable>
                <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }}
                  onPress={() => onToggleFavorite(n.e164, contact.name)}
                  hitSlop={6}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={fav ? 'Remove from favorites' : 'Add to favorites'}>
                  <Icon name={fav ? 'star' : 'star-outline'} color={fav ? colors.primary : colors.subtext} />
                </Pressable>
                <CallButton onPress={() => onCall(n.e164, contact.name)} accessibilityLabel={`Call ${n.e164}`} />
              </View>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

ContactSheet.propTypes = {
  contact: PropTypes.object,
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCall: PropTypes.func.isRequired,
  onDial: PropTypes.func.isRequired,
  onToggleFavorite: PropTypes.func.isRequired,
  favoriteNumbers: PropTypes.instanceOf(Set),
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginVertical: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  name: { marginLeft: spacing.sm, flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  numberCol: { flex: 1, justifyContent: 'center', minHeight: TOUCH_TARGET },
  iconBtn: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});

export default ContactSheet;
