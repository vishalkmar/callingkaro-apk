import React from 'react';
import { StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { AppButton, AppText, Icon } from '@components/common';
import { colors, spacing, radius, fontSize, FONT_SCALE } from '@theme';
import { t } from '@i18n';

/** Image 7 package row: orange phone icon with badge, "80 minutes", "no expiration", green outline "Buy - Rs.100". */
export const PackageRow = ({ pkg, onBuy, disabled }) => (
  <View style={styles.row}>
    <View style={styles.iconWrap}>
      <Icon name="phone" size={26} color={colors.primary} />
      <View style={styles.badge}>
        <AppText maxFontSizeMultiplier={FONT_SCALE.fixed} style={styles.badgeText}>
          {pkg.minutes}
        </AppText>
      </View>
    </View>
    <View style={styles.text}>
      <View style={styles.titleRow}>
        <AppText variant="label">{t('wallet.minutes', { n: pkg.minutes })}</AppText>
        {pkg.badge ? (
          <View style={styles.ribbon}>
            <AppText maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.ribbonText}>
              {pkg.badge === 'Best value' ? t('wallet.bestValue') : pkg.badge}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption" color="subtext">
        {t('wallet.noExpiry')}
      </AppText>
    </View>
    <AppButton
      title={t('wallet.buy', { price: pkg.priceInr })}
      variant="secondary"
      size="small"
      uppercase={false}
      fullWidth={false}
      disabled={disabled}
      onPress={() => onBuy(pkg)}
      accessibilityLabel={t('wallet.buyA11y', { minutes: pkg.minutes, price: pkg.priceInr })}
    />
  </View>
);

PackageRow.propTypes = { pkg: PropTypes.object.isRequired, onBuy: PropTypes.func.isRequired, disabled: PropTypes.bool };

const PackagesSection = ({ packages, onBuy, disabled, taxNote }) => (
  <View>
    <AppText variant="label" bold style={styles.section}>
      {t('wallet.buyMinutes')}
    </AppText>
    {packages.map(p => (
      <PackageRow key={p.id} pkg={p} onBuy={onBuy} disabled={disabled} />
    ))}
    <AppText variant="caption" color="subtext" style={styles.note}>
      {t('wallet.neverExpire')} {taxNote || ''}
    </AppText>
  </View>
);

PackagesSection.propTypes = {
  packages: PropTypes.array.isRequired,
  onBuy: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  taxNote: PropTypes.string,
};

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  iconWrap: { width: 40, alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: fontSize.micro, color: colors.primaryText, fontWeight: '700' },
  text: { flex: 1, marginLeft: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  ribbon: {
    marginLeft: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  ribbonText: { fontSize: fontSize.micro, color: colors.white, fontWeight: '700' },
  note: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
});

export default PackagesSection;
