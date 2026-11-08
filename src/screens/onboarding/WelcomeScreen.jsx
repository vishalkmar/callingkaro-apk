import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppButton, AppText, Checkbox, ScreenContainer } from '@components/common';
import PhoneIllustration from '@components/illustrations/PhoneIllustration';
import { colors, spacing } from '@theme';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';
import { acceptTerms } from '@services/auth/authService';

/** Image 1 layout: illustration (top ~40%), consent paragraph, checkbox, full-width green OK. */
const WelcomeScreen = () => {
  const navigation = useNavigation();
  const { height } = useWindowDimensions();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const openLegal = doc => navigation.navigate(ROUTES.LEGAL, { doc });

  const onOk = async () => {
    setSaving(true);
    // Saves termsAccepted + acceptedAt + version, then swaps to AuthStack (equivalent to navigation.reset).
    await acceptTerms();
  };

  const [before, rest] = STRINGS.welcome.body.split('{privacy}');
  const [middle, after] = rest.split('{terms}');

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={[styles.illustration, { minHeight: height * 0.36 }]}>
          <PhoneIllustration badgeText="Welcome to CallingKaro!" size={Math.min(260, height * 0.32)} />
        </View>
        <AppText color="subtext" style={styles.body}>
          {before}
          <AppText color="success" style={styles.link} onPress={() => openLegal('privacy')} accessibilityRole="link">
            {STRINGS.welcome.privacy}
          </AppText>
          {middle}
          <AppText color="success" style={styles.link} onPress={() => openLegal('terms')} accessibilityRole="link">
            {STRINGS.welcome.terms}
          </AppText>
          {after}
        </AppText>
      </ScrollView>
      <View style={styles.footer}>
        <Checkbox
          testID="terms-checkbox"
          checked={checked}
          onChange={setChecked}
          label={STRINGS.welcome.checkbox}
          accessibilityLabel="Accept Privacy Policy and Terms of Use"
        />
        <AppButton
          testID="welcome-ok"
          title={STRINGS.welcome.ok}
          disabled={!checked}
          loading={saving}
          onPress={onOk}
          accessibilityLabel={checked ? 'OK, continue' : 'OK, disabled until you accept the terms'}
          style={styles.ok}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  illustration: { alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: spacing.xl, lineHeight: 21 },
  link: { textDecorationLine: 'underline' },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: colors.background,
  },
  ok: { marginTop: spacing.xs },
});

export default WelcomeScreen;
