import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AppButton,
  AppHeader,
  AppInput,
  AppModal,
  AppText,
  Avatar,
  CallButton,
  Checkbox,
  EmptyState,
  ListItem,
  OtpInput,
  ScreenContainer,
  SectionHeader,
  SkeletonList,
  toast,
} from '@components/common';
import { colors, spacing } from '@theme';

/** Dev-only screen (hidden in release) that renders every common component for visual checks. */
const ComponentGallery = () => {
  const navigation = useNavigation();
  const [checked, setChecked] = useState(false);
  const [modal, setModal] = useState(false);

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title="Component Gallery" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="header">Typography header 22</AppText>
        <AppText variant="title">Title 18</AppText>
        <AppText variant="label">Label 16</AppText>
        <AppText>Body 14</AppText>
        <AppText variant="caption" color="subtext">
          Caption 12
        </AppText>

        <View style={styles.gap} />
        <AppButton title="Primary" onPress={() => toast.success('Primary pressed')} />
        <View style={styles.gap} />
        <AppButton title="Secondary" variant="secondary" onPress={() => toast.info('Info toast')} />
        <View style={styles.gap} />
        <AppButton title="Danger" variant="danger" onPress={() => toast.error('Error toast')} />
        <View style={styles.gap} />
        <AppButton title="Loading" loading />
        <View style={styles.gap} />
        <AppButton title="Disabled" disabled />
        <View style={styles.row}>
          <AppButton title="Buy - Rs.100" variant="secondary" size="small" uppercase={false} fullWidth={false} />
          <AppButton title="Ghost" variant="ghost" size="small" fullWidth={false} />
        </View>

        <AppInput label="Email" leftIcon="email-outline" placeholder="you@example.com" />
        <View style={styles.gap} />
        <AppInput label="With error" error="Enter a valid email" defaultValue="wrong@" />
        <View style={styles.gap} />
        <OtpInput onComplete={code => toast.success('OTP complete', code)} />
        <Checkbox checked={checked} onChange={setChecked} label="Checkbox (orange when checked)" />

        <View style={styles.row}>
          <Avatar name="Ravi Kumar" />
          <Avatar name="" />
          <Avatar name="Sneha" size={56} />
          <CallButton onPress={() => {}} />
        </View>
      </ScrollView>
      <View style={styles.listDemo}>
        <SectionHeader title="A" />
        <ListItem title="Aarav Sharma" subtitle="+91 98765 43210" right={<CallButton onPress={() => {}} />} />
        <SkeletonList rows={1} />
        <AppButton title="Open modal" variant="ghost" onPress={() => setModal(true)} />
      </View>
      <EmptyState
        style={styles.empty}
        panel
        message="Empty state with an inline {link} link."
        linkText="green"
        onLinkPress={() => toast.info('Link pressed')}
      />
      <AppModal
        visible={modal}
        icon="gift-outline"
        title="Earn minutes"
        message="Rounded dialog with two text buttons."
        secondaryText="Show later"
        onSecondary={() => setModal(false)}
        primaryText="Learn more"
        onPrimary={() => setModal(false)}
        onClose={() => setModal(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  gap: { height: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginVertical: spacing.md },
  listDemo: { borderTopWidth: 1, borderTopColor: colors.divider },
  empty: { flex: 0, paddingVertical: spacing.md },
});

export default ComponentGallery;
