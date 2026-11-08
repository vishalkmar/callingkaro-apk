import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppButton, AppHeader, AppText, Icon, ScreenContainer } from '@components/common';
import { t } from '@i18n';
import { colors, spacing } from '@theme';
import { CONFIG } from '@constants/config';
import { ROUTES } from '@constants/routes';

// Questions/answers live in i18n (help.q1..q8 / help.a1..a8).
const FAQ_KEYS = [1, 2, 3, 4, 5, 6, 7, 8];

/** FAQ + support email (mailto). */
const HelpScreen = () => {
  const navigation = useNavigation();
  const [open, setOpen] = useState(0);
  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title={t('help.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {FAQ_KEYS.map(n => [t(`help.q${n}`), t(`help.a${n}`)]).map(([q, a], i) => (
          <View key={q} style={styles.item}>
            <Pressable android_ripple={{ color: colors.surfaceAlt }}
              onPress={() => setOpen(open === i ? -1 : i)}
              style={styles.q}
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}>
              <AppText variant="label" style={styles.flex}>
                {q}
              </AppText>
              <Icon name={open === i ? 'chevron-up' : 'chevron-down'} color={colors.subtext} />
            </Pressable>
            {open === i ? (
              <AppText color="subtext" style={styles.a}>
                {a}
              </AppText>
            ) : null}
          </View>
        ))}
        <AppButton
          title={t('help.email', { email: CONFIG.SUPPORT_EMAIL })}
          icon="email-outline"
          uppercase={false}
          onPress={() =>
            Linking.openURL(`mailto:${CONFIG.SUPPORT_EMAIL}?subject=${encodeURIComponent('CallingKaro help')}`)
          }
          style={styles.btn}
        />
        <AppButton
          title={t('help.report')}
          variant="secondary"
          uppercase={false}
          onPress={() => navigation.navigate(ROUTES.REPORT)}
          style={styles.btn}
        />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  flex: { flex: 1 },
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  q: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  a: { paddingBottom: spacing.md, lineHeight: 21 },
  btn: { marginTop: spacing.md },
});

export default HelpScreen;
