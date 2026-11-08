import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppButton, AppInput, AppText, ScreenContainer } from '@components/common';
import PhoneIllustration from '@components/illustrations/PhoneIllustration';
import { colors, spacing } from '@theme';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';
import { sendOtp } from '@services/api/authApi';
import { authErrorMessage, normalizeEmail, validateEmail } from '@utils/validators';
import logger from '@utils/logger';

const log = logger.scope('auth-ui');

/** Image 2 layout (modified): illustration, one line of text, email field + green SEND OTP at the bottom. */
const EmailEntryScreen = () => {
  const navigation = useNavigation();
  const { height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false); // double-tap guard

  const onSubmit = async () => {
    if (submitting.current) {
      return;
    }
    const msg = validateEmail(email);
    if (msg) {
      setError(msg);
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError(null);
    const value = normalizeEmail(email);
    try {
      log.log('send-otp requested', value.split('@')[1]);
      const res = await sendOtp(value);
      navigation.navigate(ROUTES.OTP_VERIFY, { email: value, resendIn: res?.resendInSeconds ?? 60 });
    } catch (e) {
      log.warn('send-otp failed', e.code);
      // Cooldown means a code was already sent recently - let the user enter it.
      if (e.code === 'OTP_COOLDOWN') {
        navigation.navigate(ROUTES.OTP_VERIFY, { email: value, resendIn: e.data?.retryAfterSeconds ?? 60 });
      } else {
        setError(authErrorMessage(e));
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={[styles.top, { minHeight: height * 0.34 }]}>
            <PhoneIllustration icon="email-fast-outline" size={Math.min(250, height * 0.3)} />
          </View>
          <AppText color="subtext" style={styles.tagline}>
            {STRINGS.auth.tagline}
          </AppText>
          <View style={styles.spacer} />
          <AppInput
            testID="email-input"
            leftIcon="email-outline"
            placeholder={STRINGS.auth.emailPlaceholder}
            value={email}
            onChangeText={t => {
              setEmail(t);
              if (error) {
                setError(null);
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
            error={error}
            editable={!loading}
          />
          <AppButton
            testID="send-otp"
            title={STRINGS.auth.sendOtp}
            onPress={onSubmit}
            loading={loading}
            disabled={!email.trim()}
            style={styles.button}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  top: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },
  tagline: { marginTop: spacing.lg, lineHeight: 21, color: colors.subtext },
  spacer: { flex: 1, minHeight: spacing.xl },
  button: { marginTop: spacing.md },
});

export default EmailEntryScreen;
