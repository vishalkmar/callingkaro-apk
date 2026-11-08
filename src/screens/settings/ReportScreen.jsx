import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppButton, AppHeader, AppInput, AppText, Icon, ScreenContainer, toast } from '@components/common';
import { t } from '@i18n';
import { colors, spacing, radius, typography, FONT_SCALE } from '@theme';
import { submitReport } from '@services/api/reportApi';

const REASONS = ['harassment', 'fraud', 'spam', 'impersonation', 'app_problem', 'billing', 'other'];

/** Report a number or a problem: reason list + details -> POST /report. */
const ReportScreen = () => {
  const navigation = useNavigation();
  const { params } = useRoute();
  const [number, setNumber] = useState(params?.number || '');
  const [reason, setReason] = useState(params?.number ? 'harassment' : null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await submitReport({
        targetNumber: number.trim() || null,
        reason,
        details: details.trim(),
        callSid: params?.callSid || null,
      });
      toast.success(t('report.sent'), t('report.sentSub'));
      navigation.goBack();
    } catch (e) {
      toast.error(t('report.failed'), e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title={t('report.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppInput
          label={t('report.number')}
          value={number}
          onChangeText={setNumber}
          keyboardType="phone-pad"
          leftIcon="phone-outline"
          placeholder="+91..."
        />
        <AppText variant="label" style={styles.title}>
          {t('report.what')}
        </AppText>
        {REASONS.map(key => (
          <Pressable android_ripple={{ color: colors.surfaceAlt }}
            key={key}
            style={styles.reason}
            onPress={() => setReason(key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === key }}>
            <Icon
              name={reason === key ? 'radiobox-marked' : 'radiobox-blank'}
              color={reason === key ? colors.primary : colors.subtext}
            />
            <AppText style={styles.reasonText}>{t(`report.${key}`)}</AppText>
          </Pressable>
        ))}
        <TextInput
          maxFontSizeMultiplier={FONT_SCALE.max}
          value={details}
          onChangeText={setDetails}
          placeholder={t('report.details')}
          placeholderTextColor={colors.subtext}
          multiline
          maxLength={1000}
          style={styles.details}
          accessibilityLabel="Details"
        />
        <View style={styles.spacer} />
        <AppButton title={t('report.send')} onPress={send} loading={sending} disabled={!reason} />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { marginTop: spacing.lg, marginBottom: spacing.xs },
  reason: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  reasonText: { marginLeft: spacing.sm },
  details: {
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  spacer: { height: spacing.lg },
});

export default ReportScreen;
