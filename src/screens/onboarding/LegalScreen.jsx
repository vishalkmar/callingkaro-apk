import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader, AppText, ScreenContainer } from '@components/common';
import { colors, spacing } from '@theme';
import { TERMS_OF_USE, PRIVACY_POLICY, REFUND_POLICY } from '@constants/legal';

const DOCS = { terms: TERMS_OF_USE, privacy: PRIVACY_POLICY, refund: REFUND_POLICY };

/** Renders Privacy Policy or Terms of Use from the local JS file (route param doc = 'privacy' | 'terms' | 'refund'). */
const LegalScreen = () => {
  const navigation = useNavigation();
  const { params } = useRoute();
  const doc = DOCS[params?.doc] || TERMS_OF_USE;

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title={doc.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="caption" color="subtext">
          {doc.updated}
        </AppText>
        {doc.sections.map(s => (
          <View key={s.heading} style={styles.section}>
            <AppText variant="label" bold accessibilityRole="header">
              {s.heading}
            </AppText>
            <AppText color="subtext" style={styles.body}>
              {s.body}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  section: { marginTop: spacing.md },
  body: { marginTop: spacing.xxs, lineHeight: 21 },
});

export default LegalScreen;
