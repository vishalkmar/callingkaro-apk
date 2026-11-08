import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { AppButton, AppText, Avatar, EmptyState, Icon, toast } from '@components/common';
import { colors, spacing, radius } from '@theme';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';
import { t } from '@i18n';
import { useWallet } from '@hooks/useWallet';
import { useNetwork } from '@hooks/useNetwork';
import { usePermission } from '@hooks/usePermission';
import { cleanPasted, validateDialInput, stripNumber } from '@utils/phone';
import { keyFeedback, preloadTones } from '@services/audio/tones';
import { placeCall } from '@services/calls/placeCall';
import * as contactsRepo from '@db/contactsRepo';
import Keypad from './components/Keypad';
import NumberDisplay from './components/NumberDisplay';

const MAX_LEN = 18;

/** Image 4: number area / suggestions on top, T9 keypad, balance chip + full-width CALL at the bottom. */
const DialpadScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { height } = useWindowDimensions();
  const { minutes, canCall } = useWallet();
  const { isOnline } = useNetwork();
  const contactsPerm = usePermission('contacts');
  const [number, setNumber] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [exactName, setExactName] = useState(null);

  useEffect(() => {
    preloadTones();
  }, []);

  // Prefill from Contacts / Recent / deep link (callingkaro://dial/<number>).
  useEffect(() => {
    const prefill = route.params?.prefill;
    if (prefill) {
      setNumber(cleanPasted(decodeURIComponent(prefill)).slice(0, MAX_LEN));
      navigation.setParams({ prefill: undefined });
    }
  }, [route.params?.prefill, navigation]);

  // Contact suggestions by number or T9 name (max 3).
  useEffect(() => {
    let alive = true;
    if (!contactsPerm.granted || number.length < 2) {
      setSuggestions([]);
      setExactName(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      const [s, exact] = await Promise.all([contactsRepo.suggest(number, 3), contactsRepo.getByNumber(number)]);
      if (alive) {
        setSuggestions(s);
        setExactName(number.replace(/\D/g, '').length >= 10 ? exact?.name || null : null);
      }
    }, 120);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [number, contactsPerm.granted]);

  const onKey = useCallback(d => {
    keyFeedback(d);
    setNumber(n => (n.length >= MAX_LEN ? n : n + d));
  }, []);

  const onLongKey = useCallback(d => {
    if (d === '0') {
      // Long press does not fire onPress. '+' only makes sense as the first character.
      keyFeedback('+');
      setNumber(n => (n.length >= MAX_LEN ? n : n === '' ? '+' : `${n}0`));
    }
  }, []);

  const onBackspace = useCallback(() => setNumber(n => n.slice(0, -1)), []);
  const onClear = useCallback(() => setNumber(''), []);

  const onPaste = useCallback(async () => {
    const text = await Clipboard.getString();
    const cleaned = cleanPasted(text);
    if (cleaned.replace('+', '').length >= 3) {
      setNumber(cleaned.slice(0, MAX_LEN));
      toast.info(t('dialpad.pasted'));
    }
  }, []);

  const valid = validateDialInput(number);
  // Explain a grey CALL button only when the user has clearly finished typing a number we will not call.
  const hint =
    valid.reason === 'premium'
      ? STRINGS.dialpad.premium
      : valid.reason === 'not_india'
      ? STRINGS.dialpad.notIndia
      : null;
  const callEnabled = (valid.ok || valid.reason === 'emergency') && isOnline;

  const onCall = () => placeCall({ number: valid.e164 || stripNumber(number), name: exactName });

  const compact = height < 680;

  const renderTop = () => {
    if (number) {
      return (
        <View style={styles.suggestions}>
          {suggestions.map(s => (
            <Pressable
              key={`${s.id}-${s.number}`}
              style={styles.suggestion}
              android_ripple={{ color: colors.surfaceAlt }}
              onPress={() => setNumber(s.number)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${s.name}, ${s.number}`}>
              <Avatar name={s.name} size={32} />
              <View style={styles.sugText}>
                <AppText numberOfLines={1}>{s.name}</AppText>
                <AppText variant="caption" color="subtext">
                  {s.number}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      );
    }
    if (contactsPerm.status && !contactsPerm.granted) {
      return (
        <EmptyState
          panel
          message={STRINGS.dialpad.noContactsAccess}
          linkText={STRINGS.dialpad.accessToContacts}
          onLinkPress={async () => {
            if (contactsPerm.blocked) {
              contactsPerm.openSettings();
            } else {
              await contactsPerm.request();
            }
          }}
        />
      );
    }
    return (
      <View style={styles.hint}>
        <Icon name="dialpad" size={40} color={colors.divider} />
        <AppText color="subtext" center style={styles.hintText}>
          Type a number or pick one from Contacts
        </AppText>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>{renderTop()}</View>
      <NumberDisplay
        value={number}
        onBackspace={onBackspace}
        onClear={onClear}
        onPaste={onPaste}
        contactName={exactName}
        hint={hint}
      />
      <View style={[styles.keypad, compact && styles.keypadCompact]}>
        <Keypad onKey={onKey} onLongKey={onLongKey} compact={compact} />
      </View>
      <View style={styles.bottom}>
        <Pressable
          style={styles.balance}
          android_ripple={{ color: colors.surfaceAlt }}
          onPress={() => navigation.navigate(ROUTES.GET_MINUTES)}
          accessibilityRole="button"
          accessibilityLabel={`${t('dialpad.balance', { min: minutes })}. Get minutes`}>
          <Icon name="wallet-outline" size={16} color={canCall ? colors.primary : colors.danger} />
          <AppText
            variant="caption"
            bold
            style={{ color: canCall ? colors.primary : colors.danger, marginLeft: spacing.xxs }}>
            {t('dialpad.balance', { min: minutes })}
          </AppText>
        </Pressable>
        <AppButton
          testID="call-button"
          title={t('dialpad.call')}
          icon="phone"
          onPress={onCall}
          disabled={!callEnabled}
          accessibilityLabel={callEnabled ? `Call ${number}` : 'Call, enter a valid number first'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { flex: 1, minHeight: 90, backgroundColor: colors.surfaceAlt },
  suggestions: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.background, paddingBottom: spacing.xxs },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, minHeight: 48 },
  sugText: { marginLeft: spacing.sm, flex: 1 },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  hintText: { marginTop: spacing.xs },
  keypad: { paddingHorizontal: spacing.xs, paddingTop: spacing.xs, height: 300 },
  keypadCompact: { height: 236 },
  bottom: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, paddingTop: spacing.xs },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    marginBottom: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    minHeight: 28,
  },
});

export default DialpadScreen;
