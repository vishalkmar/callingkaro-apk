import React from 'react';
import { Pressable, ActivityIndicator, StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing, radius, typography, TOUCH_TARGET } from '@theme';
import AppText from './AppText';
import Icon from './Icon';

const VARIANTS = {
  primary: { bg: colors.success, border: colors.success, text: colors.white, ripple: colors.successDark },
  secondary: { bg: colors.transparent, border: colors.success, text: colors.success, ripple: colors.successSoft },
  ghost: { bg: colors.transparent, border: colors.transparent, text: colors.subtext, ripple: colors.surfaceAlt },
  danger: { bg: colors.danger, border: colors.danger, text: colors.white, ripple: colors.dangerSoft },
  orange: { bg: colors.primary, border: colors.primary, text: colors.white, ripple: colors.primaryDark },
};

const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
  uppercase = true,
  accessibilityLabel,
  testID,
}) => {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  const disabledFilled = isDisabled && (variant === 'primary' || variant === 'danger' || variant === 'orange');

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={{ color: v.ripple }}
      style={({ pressed }) => [
        styles.base,
        size === 'small' && styles.small,
        fullWidth && size !== 'small' && styles.fullWidth,
        {
          backgroundColor: disabledFilled ? colors.disabled : v.bg,
          borderColor: disabledFilled ? colors.disabled : isDisabled ? colors.disabled : v.border,
        },
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? v.text : colors.white} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Icon
              name={icon}
              size={size === 'small' ? 16 : 20}
              color={isDisabled && !disabledFilled ? colors.disabled : v.text}
              style={styles.icon}
            />
          ) : null}
          <AppText
            style={[
              size === 'small' ? styles.textSmall : styles.text,
              { color: isDisabled && !disabledFilled ? colors.disabled : v.text },
            ]}>
            {uppercase ? String(title).toUpperCase() : title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
};

AppButton.propTypes = {
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'danger', 'orange']),
  size: PropTypes.oneOf(['large', 'small']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.string,
  fullWidth: PropTypes.bool,
  uppercase: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  accessibilityLabel: PropTypes.string,
  testID: PropTypes.string,
};

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: { alignSelf: 'stretch' },
  small: { minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: spacing.xs },
  text: { ...typography.label, fontWeight: '600', letterSpacing: 0.5 },
  textSmall: { ...typography.body, fontWeight: '600' },
});

export default AppButton;
