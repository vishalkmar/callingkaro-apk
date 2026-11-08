import React from 'react';
import { Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, typography, FONT_SCALE } from '@theme';

const COLOR_MAP = {
  text: colors.text,
  subtext: colors.subtext,
  primary: colors.primaryText,
  success: colors.successText,
  danger: colors.dangerText,
  white: colors.white,
  disabled: colors.disabled,
};

// Big display text already fills its row; let it grow less with the system font size.
const DENSE_VARIANTS = ['keypad', 'callName', 'header'];

const AppText = ({ variant = 'body', color = 'text', center, bold, style, children, ...rest }) => (
  <Text
    maxFontSizeMultiplier={DENSE_VARIANTS.includes(variant) ? FONT_SCALE.dense : FONT_SCALE.max}
    style={[
      typography[variant] || typography.body,
      { color: COLOR_MAP[color] || color },
      center && styles.center,
      bold && styles.bold,
      style,
    ]}
    {...rest}>
    {children}
  </Text>
);

AppText.propTypes = {
  variant: PropTypes.oneOf(['caption', 'body', 'label', 'title', 'header', 'callName', 'keypad']),
  color: PropTypes.string,
  center: PropTypes.bool,
  bold: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  children: PropTypes.node,
};

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
});

export default AppText;
