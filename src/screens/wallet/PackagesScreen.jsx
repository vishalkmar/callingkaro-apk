import React, { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, ScreenContainer, SkeletonList } from '@components/common';
import { colors, spacing } from '@theme';
import { useWalletStore } from '@store/walletStore';
import PackagesSection from './PackagesSection';
import PurchaseDialogs from './PurchaseDialogs';
import { usePurchaseFlow } from './usePurchaseFlow';

/** Stand-alone packages list (opened from deep links / low-balance prompts). */
const PackagesScreen = () => {
  const navigation = useNavigation();
  const config = useWalletStore(s => s.config);
  const loadConfig = useWalletStore(s => s.loadConfig);
  const purchase = usePurchaseFlow();

  useEffect(() => {
    loadConfig().catch(() => {});
  }, [loadConfig]);

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title="Buy minutes" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {config ? (
          <PackagesSection
            packages={config.packages}
            onBuy={purchase.ask}
            disabled={purchase.step === 'buying'}
            taxNote={config.taxNote}
          />
        ) : (
          <SkeletonList rows={4} />
        )}
      </ScrollView>
      <PurchaseDialogs flow={purchase} taxNote={config?.taxNote} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({ content: { paddingBottom: spacing.xxl } });

export default PackagesScreen;
