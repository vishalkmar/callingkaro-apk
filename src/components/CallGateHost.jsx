import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { AppModal } from '@components/common';
import { navigate } from '@navigation/navigationRef';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';
import { colors } from '@theme';
import { useCallGateStore } from '@store/callGateStore';
import { request, check, openSettings, STATUS } from '@services/permissions/permissions';
import { placeCall } from '@services/calls/placeCall';

/** Renders the pre-call dialogs requested by placeCall(): not enough credits, mic permission, emergency numbers. */
const CallGateHost = () => {
  const dialog = useCallGateStore(s => s.dialog);
  const pending = useCallGateStore(s => s.pending);
  const close = useCallGateStore(s => s.close);
  const [micBlocked, setMicBlocked] = useState(false);

  // Back from system Settings: if the mic is now allowed, close the dialog (the user taps CALL again).
  useEffect(() => {
    if (dialog !== 'mic') {
      return undefined;
    }
    const sub = AppState.addEventListener('change', async state => {
      if (state === 'active' && (await check('microphone')) === STATUS.GRANTED) {
        setMicBlocked(false);
        close();
      }
    });
    return () => sub.remove();
  }, [dialog, close]);

  const allowMic = async () => {
    const current = await check('microphone');
    if (current === STATUS.BLOCKED) {
      setMicBlocked(true);
      openSettings();
      return;
    }
    const s = await request('microphone');
    if (s === STATUS.GRANTED) {
      setMicBlocked(false);
      close();
      if (pending) {
        placeCall(pending);
      }
    } else if (s === STATUS.BLOCKED) {
      setMicBlocked(true);
    }
  };

  return (
    <>
      <AppModal
        visible={dialog === 'credits'}
        icon="wallet-outline"
        title={STRINGS.dialpad.notEnoughTitle}
        message={STRINGS.dialpad.notEnoughMsg}
        secondaryText="Cancel"
        onSecondary={close}
        primaryText="Get Minutes"
        onPrimary={() => {
          close();
          navigate(ROUTES.MAIN_TABS, { screen: ROUTES.GET_MINUTES });
        }}
        onClose={close}
      />
      <AppModal
        visible={dialog === 'mic'}
        icon="microphone-off"
        iconColor={colors.danger}
        title="Microphone needed"
        message={micBlocked ? STRINGS.permissions.blockedHint : STRINGS.permissions.microphone}
        secondaryText="Cancel"
        onSecondary={close}
        primaryText={micBlocked ? STRINGS.permissions.openSettings : 'Allow'}
        onPrimary={micBlocked ? openSettings : allowMic}
        onClose={close}
      />
      <AppModal
        visible={dialog === 'emergency'}
        icon="alert-octagon-outline"
        iconColor={colors.danger}
        title="Use your phone dialer"
        message={STRINGS.dialpad.emergency}
        primaryText="OK"
        onPrimary={close}
        onClose={close}
      />
    </>
  );
};

export default CallGateHost;
