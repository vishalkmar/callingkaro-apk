import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { ErrorBoundary } from '@components/common';
import { ThemeProvider, colors } from '@theme';
import RootNavigator from '@navigation/RootNavigator';
import { navigationRef, flushPendingNavigation } from '@navigation/navigationRef';
import { linking } from '@navigation/linking';
import { useSettingsStore } from '@store/settingsStore';
import { setLanguage } from '@i18n';
import { useAppBootstrap } from './useAppBootstrap';

const navTheme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.divider,
    notification: colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'sans-serif', fontWeight: '400' },
    medium: { fontFamily: 'sans-serif-medium', fontWeight: '500' },
    bold: { fontFamily: 'sans-serif', fontWeight: '700' },
    heavy: { fontFamily: 'sans-serif', fontWeight: '800' },
  },
};

const App = () => {
  const themeMode = useSettingsStore(s => s.theme);
  const language = useSettingsStore(s => s.language);
  setLanguage(language);
  // Changing the language remounts the navigator (key) so every text re-renders;
  // keep the navigation state so the user stays on the same screen (e.g. Settings).
  const navState = useRef(undefined);

  useAppBootstrap();

  useEffect(() => {
    setLanguage(language);
  }, [language]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider mode={themeMode}>
          <ErrorBoundary>
            <NavigationContainer
              key={language}
              ref={navigationRef}
              theme={navTheme}
              linking={linking}
              initialState={navState.current}
              onStateChange={st => {
                navState.current = st;
              }}
              onReady={flushPendingNavigation}>
              <RootNavigator />
            </NavigationContainer>
          </ErrorBoundary>
          <Toast />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({ flex: { flex: 1 } });

export default App;
