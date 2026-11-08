import React, { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppButton, AppText, ScreenContainer } from '@components/common';
import PhoneIllustration from '@components/illustrations/PhoneIllustration';
import { colors, spacing } from '@theme';
import { STRINGS } from '@constants/strings';
import { check, request, openSettings, STATUS } from '@services/permissions/permissions';
import { finishPermissions } from '@services/auth/authService';
import { PERMISSION_STEPS } from './permissionSteps';

/**
 * Image 3 template: illustration, one-sentence reason, green CONTINUE, grey "Not Now".
 * - denied   -> user may continue (except microphone, which is required)
 * - blocked  -> CONTINUE becomes "Open Settings"
 */
const PermissionScreen = () => {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { height } = useWindowDimensions();
  const index = params?.stepIndex ?? 0;
  const step = PERMISSION_STEPS[index];
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  // The system dialog pauses the activity; when it closes AppState fires 'active' and the re-check below
  // can call goNext() at the same time as onContinue. Advance only once per screen, or a step gets skipped.
  const advanced = useRef(false);

  const goNext = async () => {
    if (advanced.current) {
      return;
    }
    advanced.current = true;
    const next = PERMISSION_STEPS[index + 1];
    if (next) {
      navigation.replace(next.route, { stepIndex: index + 1 });
    } else {
      await finishPermissions(); // saves permissionsDone=true -> MainStack, flow never shown again
    }
  };

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const s = await check(step.key);
      if (!mounted) {
        return;
      }
      setStatus(s);
      // Already granted (e.g. reinstall) -> skip silently.
      if (s === STATUS.GRANTED || s === STATUS.UNAVAILABLE) {
        goNext();
      }
    };
    refresh();
    const sub = AppState.addEventListener('change', a => a === 'active' && refresh());
    return () => {
      mounted = false;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.key]);

  const onContinue = async () => {
    if (status === STATUS.BLOCKED) {
      openSettings();
      return;
    }
    setBusy(true);
    const s = await request(step.key);
    setStatus(s);
    setBusy(false);
    const allowed = s === STATUS.GRANTED || s === STATUS.UNAVAILABLE;
    // Optional permissions: a plain "deny" still moves on. Required (mic) or blocked: stay here.
    if (allowed || (s === STATUS.DENIED && !step.required)) {
      goNext();
    }
  };

  const blocked = status === STATUS.BLOCKED;
  const deniedRequired = step.required && status === STATUS.DENIED;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={[styles.top, { minHeight: height * 0.4 }]}>
          <PhoneIllustration icon={step.icon} size={Math.min(250, height * 0.32)} />
        </View>
        <AppText color="subtext" style={styles.text}>
          {step.text}
        </AppText>
        {blocked ? (
          <AppText variant="caption" color="danger" style={styles.hint}>
            {STRINGS.permissions.blockedHint}
          </AppText>
        ) : null}
        {deniedRequired ? (
          <AppText variant="caption" color="danger" style={styles.hint}>
            {STRINGS.permissions.micRequired}
          </AppText>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <AppButton
          testID="perm-continue"
          title={blocked ? STRINGS.permissions.openSettings : STRINGS.permissions.continue}
          onPress={onContinue}
          loading={busy}
        />
        {!step.required ? (
          <AppButton
            testID="perm-notnow"
            title={STRINGS.permissions.notNow}
            variant="ghost"
            uppercase={false}
            onPress={goNext}
            style={styles.notNow}
          />
        ) : (
          <View style={styles.notNowPlaceholder} />
        )}
        <AppText variant="caption" color="subtext" center>
          {index + 1} / {PERMISSION_STEPS.length}
        </AppText>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  top: { alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: spacing.xl, lineHeight: 21 },
  hint: { marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.background },
  notNow: { marginTop: spacing.xxs },
  notNowPlaceholder: { height: spacing.md },
});

export default PermissionScreen;
