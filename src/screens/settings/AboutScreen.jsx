import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';
import { AppHeader, AppLogo, AppText, ScreenContainer } from '@components/common';
import SettingsRow from '@components/SettingsRow';
import { t } from '@i18n';
import { colors, spacing } from '@theme';
import { CONFIG } from '@constants/config';
import { ROUTES } from '@constants/routes';

const LICENSES =
  'React Native, React Navigation, Zustand, Axios, libphonenumber-js, op-sqlite, Twilio Voice RN SDK, Google Mobile Ads, react-native-iap, Reanimated, SVG, Gesture Handler, Material Design Icons (Apache 2.0) and other MIT/Apache-licensed libraries. Full list: see the app repository (package.json).';

/** Version, build number, Terms, Privacy, open-source licenses. */
const AboutScreen = () => {
  const navigation = useNavigation();
  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title={t('about.title')} onBack={() => navigation.goBack()} />
      <ScrollView>
        <View style={styles.head}>
          <AppLogo size={72} inverted />
          <AppText variant="header" style={styles.name}>
            {CONFIG.APP_NAME}
          </AppText>
          <AppText color="subtext">
            {t('about.version', { v: DeviceInfo.getVersion(), b: DeviceInfo.getBuildNumber() })}
          </AppText>
        </View>
        <SettingsRow
          icon="file-document-outline"
          title={t('about.terms')}
          onPress={() => navigation.navigate(ROUTES.LEGAL, { doc: 'terms' })}
        />
        <SettingsRow
          icon="shield-lock-outline"
          title={t('about.privacy')}
          onPress={() => navigation.navigate(ROUTES.LEGAL, { doc: 'privacy' })}
        />
        <View style={styles.licenses}>
          <AppText variant="label">{t('about.licenses')}</AppText>
          <AppText variant="caption" color="subtext" style={styles.text}>
            {LICENSES}
          </AppText>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  head: { alignItems: 'center', paddingVertical: spacing.xl },
  name: { marginTop: spacing.sm },
  licenses: { padding: spacing.md },
  text: { marginTop: spacing.xs, lineHeight: 18 },
});

export default AboutScreen;
