import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppButton, AppHeader, AppInput, AppText, Avatar, ScreenContainer, toast } from '@components/common';
import { t } from '@i18n';
import { colors, spacing, radius } from '@theme';
import { useAuthStore } from '@store/authStore';
import { useWallet } from '@hooks/useWallet';
import { getMe, updateMe } from '@services/api/authApi';
import { formatDate, formatNumber } from '@utils/format';

/** Email (read-only), editable name, member since, total minutes used. */
const ProfileScreen = () => {
  const navigation = useNavigation();
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const { credits, minutes } = useWallet();
  const [name, setName] = useState(user?.name || '');
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMe()
      .then(me => {
        setUser(me.user);
        setName(me.user?.name || '');
        setStats(me.stats);
      })
      .catch(() => {});
  }, [setUser]);

  const save = async () => {
    const v = name.trim();
    if (!v) {
      toast.error(t('profile.empty'));
      return;
    }
    setSaving(true);
    try {
      const r = await updateMe({ name: v });
      setUser(r.user);
      toast.success(t('profile.saved'));
    } catch (e) {
      toast.error(t('profile.failed'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title={t('profile.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Avatar name={user?.name || user?.email} size={80} />
          <AppText variant="title" style={styles.email}>
            {user?.email}
          </AppText>
          <AppText variant="caption" color="subtext">
            {t('profile.since', { date: formatDate(user?.createdAt) })}
          </AppText>
        </View>
        <AppInput
          label={t('profile.name')}
          value={name}
          onChangeText={setName}
          maxLength={60}
          placeholder={t('profile.namePh')}
          leftIcon="account-outline"
        />
        <AppButton
          title={t('profile.save')}
          onPress={save}
          loading={saving}
          disabled={name.trim() === (user?.name || '')}
          style={styles.save}
        />
        <View style={styles.stats}>
          <Stat
            label={t('profile.balance')}
            value={t('profile.min', { n: minutes })}
            sub={t('profile.credits', { n: formatNumber(credits) })}
          />
          <Stat
            label={t('profile.used')}
            value={String(stats?.totalMinutesUsed ?? '-')}
            sub={t('profile.calls', { n: stats?.totalCalls ?? 0 })}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const Stat = ({ label, value, sub }) => (
  <View style={styles.stat}>
    <AppText variant="caption" color="subtext">
      {label}
    </AppText>
    <AppText variant="header" color="primary">
      {value}
    </AppText>
    <AppText variant="caption" color="subtext">
      {sub}
    </AppText>
  </View>
);

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  head: { alignItems: 'center', paddingVertical: spacing.lg },
  email: { marginTop: spacing.sm },
  save: { marginTop: spacing.md },
  stats: { flexDirection: 'row', marginTop: spacing.xl },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.xxs,
  },
});

export default ProfileScreen;
