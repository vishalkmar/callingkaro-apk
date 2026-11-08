import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { AppModal, AppText } from '@components/common';
import { colors, spacing } from '@theme';
import { CONFIG } from '@constants/config';
import { formatNumber } from '@utils/format';

/** Confirm sheet -> buying -> success ("+80 minutes added") / pending / failed with retry + support email. */
const PurchaseDialogs = ({ flow, taxNote }) => {
  const { step, pkg, error, result, confirm, close, retry } = flow;
  if (!pkg) {
    return null;
  }
  const support = () =>
    Linking.openURL(
      `mailto:${CONFIG.SUPPORT_EMAIL}?subject=${encodeURIComponent(
        `Payment issue - ${pkg.id}`,
      )}&body=${encodeURIComponent(
        `Order: ${result?.order?.id || 'n/a'}\nPackage: ${pkg.minutes} minutes (Rs.${pkg.priceInr})\nError: ${
          error?.code || ''
        }`,
      )}`,
    );

  return (
    <>
      <AppModal
        visible={step === 'confirm' || step === 'buying'}
        icon="cart-outline"
        title={`Buy ${pkg.minutes} minutes?`}
        secondaryText="Cancel"
        onSecondary={close}
        primaryText={step === 'buying' ? 'Please wait...' : `Pay Rs.${pkg.priceInr}`}
        onPrimary={step === 'buying' ? undefined : confirm}
        onClose={step === 'buying' ? undefined : close}>
        <View style={styles.box}>
          <Row label="Minutes" value={`${pkg.minutes} min (no expiry)`} />
          <Row label="Credits" value={formatNumber(pkg.credits)} />
          <Row label="Price" value={`Rs.${pkg.priceInr}`} />
          <AppText variant="caption" color="subtext" style={styles.note}>
            Paid securely through Google Play. {taxNote || ''}
          </AppText>
        </View>
      </AppModal>
      <AppModal
        visible={step === 'success'}
        icon="check-circle"
        iconColor={colors.success}
        title={`+${pkg.minutes} minutes added`}
        message={`Your new balance is ${Math.floor((result?.balance || 0) / 1000)} minutes. Receipt: ${
          result?.order?.receiptNo || '-'
        } (see Wallet history).`}
        primaryText="Great"
        onPrimary={close}
        onClose={close}
      />
      <AppModal
        visible={step === 'pending'}
        icon="clock-outline"
        iconColor={colors.warning}
        title="Payment pending"
        message="Your bank has not confirmed the payment yet. Minutes are added automatically as soon as Google confirms it - usually within a few minutes."
        secondaryText="Support"
        onSecondary={support}
        primaryText="OK"
        onPrimary={close}
        onClose={close}
      />
      <AppModal
        visible={step === 'failed'}
        icon="alert-circle-outline"
        iconColor={colors.danger}
        title="Payment not completed"
        message={`${
          error?.message || 'Something went wrong.'
        } If money was taken from your account, it will be added as minutes or refunded automatically. Contact ${
          CONFIG.SUPPORT_EMAIL
        } if it is not.`}
        secondaryText="Email support"
        onSecondary={support}
        primaryText="Retry"
        onPrimary={retry}
        onClose={close}
      />
    </>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <AppText color="subtext">{label}</AppText>
    <AppText bold>{value}</AppText>
  </View>
);

Row.propTypes = { label: PropTypes.string, value: PropTypes.string };

PurchaseDialogs.propTypes = { flow: PropTypes.object.isRequired, taxNote: PropTypes.string };

const styles = StyleSheet.create({
  box: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xxs },
  note: { marginTop: spacing.xs },
});

export default PurchaseDialogs;
