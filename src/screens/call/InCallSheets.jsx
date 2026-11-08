import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import PropTypes from 'prop-types';
import { AppButton, AppText, Icon, ListItem, toast } from '@components/common';
import { colors, spacing, radius, typography, FONT_SCALE } from '@theme';
import { t } from '@i18n';
import * as contactsRepo from '@db/contactsRepo';
import { formatPhone } from '@utils/format';

const Sheet = ({ visible, onClose, title, children }) => (
  <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.flex} behavior="height">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('call.close')}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
            <AppText variant="title">{title}</AppText>
            <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }} onPress={onClose} hitSlop={10} accessibilityLabel={t('call.close')}>
              <Icon name="close" color={colors.subtext} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>
);

Sheet.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
};

/** Notes typed during the call are saved into the call_logs row (notes column). */
export const NotesSheet = ({ visible, initial, onSave, onClose }) => {
  const [text, setText] = useState(initial || '');
  useEffect(() => {
    if (visible) {
      setText(initial || '');
    }
  }, [visible, initial]);
  return (
    <Sheet visible={visible} onClose={() => onClose(text)} title={t('call.notesTitle')}>
      <TextInput
        maxFontSizeMultiplier={FONT_SCALE.max}
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        maxLength={1000}
        placeholder={t('call.notesPlaceholder')}
        placeholderTextColor={colors.subtext}
        style={styles.notes}
        accessibilityLabel={t('call.notesTitle')}
      />
      <AppButton title={t('call.save')} onPress={() => onSave(text)} />
    </Sheet>
  );
};

NotesSheet.propTypes = {
  visible: PropTypes.bool,
  initial: PropTypes.string,
  onSave: PropTypes.func,
  onClose: PropTypes.func,
};

/** Read-only contacts lookup while talking (copy a number to share it with the other person). */
export const ContactsPickerSheet = ({ visible, onClose }) => {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const id = setTimeout(async () => setItems(await contactsRepo.search(q, 100)), 150);
    return () => clearTimeout(id);
  }, [q, visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('call.contacts')}>
      <TextInput
        maxFontSizeMultiplier={FONT_SCALE.max}
        value={q}
        onChangeText={setQ}
        placeholder={t('call.search')}
        placeholderTextColor={colors.subtext}
        style={styles.search}
        accessibilityLabel={t('call.searchContacts')}
      />
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={c => c.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ListItem
            title={item.name || formatPhone(item.numbers[0]?.e164)}
            subtitle={item.numbers.map(n => formatPhone(n.e164)).join(', ')}
            onPress={() => {
              Clipboard.setString(item.numbers[0]?.e164 || '');
              toast.success(t('call.numberCopied'), item.numbers[0]?.e164);
            }}
          />
        )}
        ListEmptyComponent={
          <AppText color="subtext" center style={styles.empty}>
            {t('call.noContacts')}
          </AppText>
        }
      />
    </Sheet>
  );
};

ContactsPickerSheet.propTypes = { visible: PropTypes.bool, onClose: PropTypes.func };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    maxHeight: '80%',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  notes: {
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  search: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    ...typography.body,
    color: colors.text,
    minHeight: 44,
  },
  list: { maxHeight: 420 },
  empty: { padding: spacing.lg },
});
