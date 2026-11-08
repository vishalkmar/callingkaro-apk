import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { AppText, Icon } from '@components/common';
import { colors, spacing, radius } from '@theme';
import { formatAsYouType } from '@utils/phone';

/**
 * Typed number (large, auto-formatted) with the country chip on the left and the
 * backspace "tag" on the right. Long-press the number to paste.
 */
const NumberDisplay = ({ value, onBackspace, onClear, onPaste, contactName, hint }) => {
  const display = formatAsYouType(value);
  const size = display.length > 16 ? 26 : display.length > 12 ? 30 : 34;
  return (
    <View style={styles.wrap}>
      <View style={styles.chip} accessibilityLabel="Country India, plus 91">
        <AppText variant="caption" bold>
          IN +91
        </AppText>
      </View>
      <Pressable android_ripple={{ color: colors.surfaceAlt }}
        style={styles.numberBox}
        onLongPress={onPaste}
        delayLongPress={400}
        accessibilityRole="text"
        accessibilityLabel={value ? `Number ${value.split('').join(' ')}` : 'Number field, long press to paste'}
        accessibilityHint="Long press to paste a number">
        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.number, { fontSize: size, lineHeight: size + 8 }]}
          testID="dial-number">
          {display || ' '}
        </AppText>
        {contactName ? (
          <AppText variant="caption" color="subtext" numberOfLines={1} center>
            {contactName}
          </AppText>
        ) : hint ? (
          <AppText
            variant="caption"
            color="danger"
            numberOfLines={2}
            center
            testID="dial-hint"
            accessibilityLiveRegion="polite">
            {hint}
          </AppText>
        ) : null}
      </Pressable>
      <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }}
        testID="backspace"
        onPress={onBackspace}
        onLongPress={onClear}
        disabled={!value}
        hitSlop={10}
        style={styles.backspace}
        accessibilityRole="button"
        accessibilityLabel="Delete digit"
        accessibilityHint="Long press to clear the number">
        <Icon name="backspace-outline" size={26} color={value ? colors.subtext : colors.divider} />
      </Pressable>
    </View>
  );
};

NumberDisplay.propTypes = {
  value: PropTypes.string.isRequired,
  onBackspace: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onPaste: PropTypes.func.isRequired,
  contactName: PropTypes.string,
  hint: PropTypes.string, // why CALL is disabled (toll-free, foreign number)
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  chip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  numberBox: { flex: 1, paddingHorizontal: spacing.xs, justifyContent: 'center', minHeight: 56 },
  number: { color: colors.text, textAlign: 'center', fontWeight: '300' },
  backspace: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});

export default NumberDisplay;
