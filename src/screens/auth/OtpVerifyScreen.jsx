import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppButton, AppText, OtpInput, ScreenContainer, toast } from '@components/common';
import PhoneIllustration from '@components/illustrations/PhoneIllustration';
import { spacing } from '@theme';
import { CONFIG } from '@constants/config';
import { STRINGS } from '@constants/strings';
import { sendOtp, verifyOtp } from '@services/api/authApi';
import { completeLogin, getDeviceId } from '@services/auth/authService';
import { authErrorMessage, isValidOtp } from '@utils/validators';
import { formatTimer } from '@utils/format';
import logger from '@utils/logger';

const log = logger.scope('auth-ui');

const OtpVerifyScreen = () => {
  const navigation = useNavigation();
  const { params } = useRoute();
  const email = params?.email || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(params?.resendIn ?? 60);
  const [resetKey, setResetKey] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const submit = useCallback(
    async value => {
      const otp = value ?? code;
      if (submitting.current || !isValidOtp(otp)) {
        return;
      }
      submitting.current = true;
      setLoading(true);
      setError(null);
      try {
        const deviceId = await getDeviceId();
        const data = await verifyOtp({ email, otp, deviceId, termsVersion: CONFIG.TERMS_VERSION });
        log.log('verify ok, new user:', data.isNew);
        // Saves tokens in Keychain + user/wallet in stores, then swaps to PermissionStack (or Main).
        await completeLogin({ user: data.user, tokens: data.tokens, wallet: data.wallet });
        if (data.isNew && data.wallet?.credits) {
          toast.success('Welcome to CallingKaro!', `${data.wallet.credits} free credits added`);
        }
      } catch (e) {
        log.warn('verify failed', e.code);
        setError(authErrorMessage(e));
        setResetKey(k => k + 1);
        setCode('');
      } finally {
        submitting.current = false;
        setLoading(false);
      }
    },
    [code, email],
  );

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await sendOtp(email);
      setSecondsLeft(res?.resendInSeconds ?? 60);
      setResetKey(k => k + 1);
      toast.success('New code sent', email);
    } catch (e) {
      setError(authErrorMessage(e));
      if (e.data?.retryAfterSeconds) {
        setSecondsLeft(e.data.retryAfterSeconds);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.top}>
            <PhoneIllustration icon="shield-key-outline" size={190} />
          </View>
          <AppText variant="header" style={styles.title} accessibilityRole="header">
            {STRINGS.auth.verifyTitle}
          </AppText>
          <AppText color="subtext" style={styles.sub}>
            {STRINGS.auth.codeSentTo} <AppText bold>{email}</AppText>
          </AppText>

          <View style={styles.otp}>
            <OtpInput
              resetKey={resetKey}
              disabled={loading}
              error={!!error}
              onChange={v => {
                setCode(v);
                if (error) {
                  setError(null);
                }
              }}
              onComplete={v => submit(v)} // auto-submit on the 6th digit
            />
          </View>
          {error ? (
            <AppText color="danger" variant="caption" style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}

          <View style={styles.row}>
            <AppText color="success" style={styles.link} onPress={() => navigation.goBack()} accessibilityRole="link">
              {STRINGS.auth.changeEmail}
            </AppText>
            {secondsLeft > 0 ? (
              <AppText color="subtext">
                {STRINGS.auth.resendIn} {formatTimer(secondsLeft).replace(/^0/, '')}
              </AppText>
            ) : (
              <AppText
                color="success"
                style={styles.link}
                onPress={resending ? undefined : resend}
                accessibilityRole="link"
                accessibilityState={{ disabled: resending }}>
                {resending ? 'Sending...' : STRINGS.auth.resend}
              </AppText>
            )}
          </View>

          <View style={styles.spacer} />
          <AppButton
            testID="verify-otp"
            title={STRINGS.auth.verify}
            onPress={() => submit()}
            loading={loading}
            disabled={!isValidOtp(code)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  top: { alignItems: 'center', paddingTop: spacing.xl },
  title: { marginTop: spacing.lg },
  sub: { marginTop: spacing.xs, lineHeight: 21 },
  otp: { marginTop: spacing.xl },
  error: { marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg },
  link: { textDecorationLine: 'underline', paddingVertical: spacing.xs },
  spacer: { flex: 1, minHeight: spacing.xl },
});

export default OtpVerifyScreen;
