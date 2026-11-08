import React, { forwardRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing, radius, typography, TOUCH_TARGET, FONT_SCALE } from '@theme';
import AppText from './AppText';
import Icon from './Icon';

const AppInput = forwardRef(
  (
    { label, error, leftIcon, rightIcon, rightIconLabel, onRightIconPress, keyboardType = 'default', style, inputStyle, ...rest },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const borderColor = error ? colors.danger : focused ? colors.primary : colors.divider;
    return (
      <View style={style}>
        {label ? (
          <AppText variant="caption" color="subtext" style={styles.label}>
            {label}
          </AppText>
        ) : null}
        <View style={[styles.box, { borderColor }]}>
          {leftIcon ? <Icon name={leftIcon} size={20} color={colors.primary} style={styles.left} /> : null}
          <TextInput
            maxFontSizeMultiplier={FONT_SCALE.max}
            {...rest}
            ref={ref}
            keyboardType={keyboardType}
            placeholderTextColor={colors.subtext}
            style={[styles.input, inputStyle]}
            onFocus={e => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={e => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            accessibilityLabel={rest.accessibilityLabel || label || rest.placeholder}
          />
          {rightIcon ? (
            <Pressable
              android_ripple={{ color: colors.surfaceAlt, borderless: true }}
              onPress={onRightIconPress}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={rightIconLabel || rightIcon}
              style={styles.right}>
              <Icon name={rightIcon} size={20} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <AppText variant="caption" color="danger" style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}
      </View>
    );
  },
);

AppInput.propTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  leftIcon: PropTypes.string,
  rightIcon: PropTypes.string,
  onRightIconPress: PropTypes.func,
  rightIconLabel: PropTypes.string, // read by TalkBack, e.g. "Show password"
  keyboardType: PropTypes.string,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  inputStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xxs },
  box: {
    minHeight: TOUCH_TARGET,
    borderBottomWidth: 1.5,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  left: { marginRight: spacing.xs },
  right: { marginLeft: spacing.xs, padding: spacing.xxs },
  input: { flex: 1, ...typography.label, color: colors.text, paddingVertical: spacing.xs },
  error: { marginTop: spacing.xxs },
});

export default AppInput;
