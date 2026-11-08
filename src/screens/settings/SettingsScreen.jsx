import React, { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppHeader, AppModal, ScreenContainer, toast } from '@components/common';
import SettingsRow, { SettingsGroup } from '@components/SettingsRow';
import { colors, spacing } from '@theme';
import { ROUTES } from '@constants/routes';
import { CONFIG } from '@constants/config';
import { t, LANGUAGES } from '@i18n';
import { useSettingsStore } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';
import { checkAll, openSettings, request, STATUS, PERMISSION_NAMES } from '@services/permissions/permissions';
import {
  totalRecordingsSize,
  deleteAllRecordings,
  clearHistoryAndRecordings,
  wipeLocalData,
} from '@services/recording/recordingService';
import { logout } from '@services/auth/authService';
import { deleteMe } from '@services/api/authApi';
import { showAdPrivacyOptions } from '@services/ads/rewardedAd';
import { formatBytes } from '@utils/format';

const PERM_LABELS = {
  contacts: ['set.permContacts', 'card-account-phone-outline'],
  microphone: ['set.permMic', 'microphone-outline'],
  notifications: ['set.permNotif', 'bell-outline'],
  bluetooth: ['set.permBt', 'bluetooth'],
  storage: ['set.permStorage', 'folder-music-outline'],
};

const STATUS_TEXT = {
  granted: 'set.allowed',
  denied: 'set.notAllowed',
  blocked: 'set.blocked',
  unavailable: 'set.notNeeded',
};

const PLAY_LINK = 'https://play.google.com/store/apps/details?id=com.callingkaro.app';

/** Account, Calls, Permissions, Storage, Data, Help, About, Logout (red). Every change persists and applies at once. */
const SettingsScreen = () => {
  const navigation = useNavigation();
  const s = useSettingsStore();
  const user = useAuthStore(st => st.user);
  const [perms, setPerms] = useState({});
  const [recSize, setRecSize] = useState(0);
  const [confirm, setConfirm] = useState(null); // 'recordings' | 'history' | 'wipe' | 'logout' | 'delete'
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkAll().then(setPerms);
      totalRecordingsSize().then(setRecSize);
    }, []),
  );

  const manage = async name => {
    if (perms[name] === STATUS.BLOCKED || perms[name] === STATUS.GRANTED) {
      openSettings(); // revoking / unblocking is only possible in system settings
      return;
    }
    await request(name);
    setPerms(await checkAll());
  };

  const runConfirm = async () => {
    const what = confirm;
    setBusy(true);
    try {
      if (what === 'recordings') {
        await deleteAllRecordings();
        setRecSize(0);
        toast.success(t('set.recsDone'));
      } else if (what === 'history') {
        await clearHistoryAndRecordings();
        toast.success(t('set.histDone'));
      } else if (what === 'wipe') {
        await wipeLocalData();
        setRecSize(0);
        toast.success(t('set.wipeDone'));
      } else if (what === 'logout') {
        await logout();
      } else if (what === 'delete') {
        await deleteMe();
        // The account is gone on the server: always sign out, even if wiping local files fails.
        try {
          await wipeLocalData();
        } finally {
          await logout();
        }
        toast.success(t('set.delDone'));
      }
    } catch (e) {
      toast.error(t('set.failed'), e.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const CONFIRM = {
    recordings: [t('set.recsTitle'), t('set.recsBody')],
    history: [t('set.histTitle'), t('set.histBody')],
    wipe: [t('set.wipeTitle'), t('set.wipeBody')],
    logout: [t('logout.title'), t('logout.message')],
    delete: [t('set.delTitle'), t('set.delBody')],
  };

  const share = () =>
    Share.share({
      // The referral sentence is only added when the user has a code (no "Use my code  when...").
      message: [
        t('set.shareText', { app: CONFIG.APP_NAME, link: PLAY_LINK }),
        user?.referralCode ? t('set.shareCode', { code: user.referralCode }) : null,
      ]
        .filter(Boolean)
        .join(' '),
    });

  return (
    <ScreenContainer statusBarColor={colors.primary}>
      <AppHeader title={t('settings.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsGroup title={t('set.account')}>
          <SettingsRow
            icon="account-circle-outline"
            title={t('set.profile')}
            subtitle={user?.email}
            onPress={() => navigation.navigate(ROUTES.PROFILE)}
          />
          <SettingsRow
            icon="share-variant-outline"
            title={t('set.share')}
            subtitle={user?.referralCode ? t('set.referral', { code: user.referralCode }) : t('set.inviteFriends')}
            onPress={share}
          />
          <SettingsRow
            icon="translate"
            title={t('set.language')}
            subtitle={LANGUAGES.find(l => l.code === s.language)?.label}
            onPress={() => s.setSetting('language', s.language === 'en' ? 'hi' : 'en')}
          />
        </SettingsGroup>

        <SettingsGroup title={t('set.calls')}>
          <SettingsRow
            icon="record-rec"
            title={t('set.recordAll')}
            subtitle={t('set.recordAllSub')}
            value={s.recordAllCalls}
            onValueChange={v => s.setSetting('recordAllCalls', v)}
          />
          <SettingsRow
            icon="volume-high"
            title={t('set.speakerDefault')}
            value={s.speakerDefault}
            onValueChange={v => s.setSetting('speakerDefault', v)}
          />
          <SettingsRow
            icon="dialpad"
            title={t('set.keypadTones')}
            value={s.keypadTones}
            onValueChange={v => s.setSetting('keypadTones', v)}
          />
          <SettingsRow
            icon="vibrate"
            title={t('set.vibrate')}
            value={s.vibrateOnConnect}
            onValueChange={v => s.setSetting('vibrateOnConnect', v)}
          />
          <SettingsRow
            icon="gesture-tap"
            title={t('set.haptics')}
            value={s.haptics}
            onValueChange={v => s.setSetting('haptics', v)}
          />
        </SettingsGroup>

        <SettingsGroup title={t('set.permissions')}>
          {PERMISSION_NAMES.map(name => (
            <SettingsRow
              key={name}
              icon={PERM_LABELS[name][1]}
              title={t(PERM_LABELS[name][0])}
              subtitle={STATUS_TEXT[perms[name]] ? t(STATUS_TEXT[perms[name]]) : '...'}
              onPress={() => manage(name)}
              right={null}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup title={t('set.storage')}>
          <SettingsRow
            icon="folder-music-outline"
            title={t('set.recordings')}
            subtitle={t('set.used', { size: formatBytes(recSize) })}
            onPress={() => navigation.navigate(ROUTES.RECORDINGS)}
          />
          <SettingsRow
            icon="delete-sweep-outline"
            title={t('set.deleteRecs')}
            onPress={() => setConfirm('recordings')}
          />
        </SettingsGroup>

        <SettingsGroup title={t('set.data')}>
          <SettingsRow icon="history" title={t('set.clearHistory')} onPress={() => setConfirm('history')} />
          <SettingsRow icon="database-remove-outline" title={t('set.wipe')} onPress={() => setConfirm('wipe')} />
          <SettingsRow icon="shield-account-outline" title={t('set.adPrivacy')} onPress={showAdPrivacyOptions} />
          <SettingsRow
            icon="file-document-outline"
            title={t('set.privacy')}
            onPress={() => navigation.navigate(ROUTES.LEGAL, { doc: 'privacy' })}
          />
        </SettingsGroup>

        <SettingsGroup title={t('set.help')}>
          <SettingsRow
            icon="help-circle-outline"
            title={t('set.helpFaq')}
            onPress={() => navigation.navigate(ROUTES.HELP)}
          />
          <SettingsRow icon="flag-outline" title={t('set.report')} onPress={() => navigation.navigate(ROUTES.REPORT)} />
          <SettingsRow
            icon="information-outline"
            title={t('set.about')}
            onPress={() => navigation.navigate(ROUTES.ABOUT)}
          />
        </SettingsGroup>

        <SettingsGroup title={t('set.session')}>
          <SettingsRow icon="logout" title={t('set.logout')} danger onPress={() => setConfirm('logout')} />
          <SettingsRow
            icon="account-remove-outline"
            title={t('set.deleteAccount')}
            danger
            onPress={() => setConfirm('delete')}
          />
        </SettingsGroup>
      </ScrollView>

      <AppModal
        visible={!!confirm}
        icon="alert-outline"
        iconColor={colors.danger}
        title={confirm ? CONFIRM[confirm][0] : ''}
        message={confirm ? CONFIRM[confirm][1] : ''}
        secondaryText={t('set.cancel')}
        onSecondary={() => setConfirm(null)}
        primaryText={busy ? t('set.wait') : confirm === 'logout' ? t('set.logout') : t('set.delete')}
        primaryDanger
        onPrimary={busy ? undefined : runConfirm}
        onClose={() => setConfirm(null)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({ content: { paddingBottom: spacing.xxl } });

export default SettingsScreen;
