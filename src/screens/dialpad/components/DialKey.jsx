import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { AppText } from '@components/common';
import { colors, spacing, typography, fontSize, FONT_SCALE } from '@theme';

/** Image 4 key: big thin orange digit, small grey T9 letters, thin orange underline. */
const DialKey = ({
  digit,
  letters,
  onPress,
  onLongPress,
  color = colors.primary,
  underline = true,
  compact = false,
}) => (
  <Pressable
    testID={`key-${digit}`}
    onPress={() => onPress(digit)}
    onLongPress={onLongPress ? () => onLongPress(digit) : undefined}
    delayLongPress={350}
    android_ripple={{ color: colors.primarySoft, borderless: false }}
    accessibilityRole="button"
    accessibilityLabel={digit === '*' ? 'star' : digit === '#' ? 'pound' : `${digit}${letters ? ` ${letters}` : ''}`}
    accessibilityHint={digit === '0' ? 'Long press for plus' : undefined}
    style={styles.key}>
    <View style={styles.row}>
      <AppText maxFontSizeMultiplier={FONT_SCALE.dense} style={[styles.digit, compact && styles.digitCompact, { color }]}>
        {digit}
      </AppText>
      <AppText maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.letters}>
        {letters}
      </AppText>
    </View>
    {underline ? <View style={styles.underline} /> : null}
  </Pressable>
);

DialKey.propTypes = {
  digit: PropTypes.string.isRequired,
  letters: PropTypes.string,
  onPress: PropTypes.func.isRequired,
  onLongPress: PropTypes.func,
  color: PropTypes.string,
  underline: PropTypes.bool,
  compact: PropTypes.bool,
};

const styles = StyleSheet.create({
  key: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  digit: { ...typography.keypad, fontSize: fontSize.keypadLarge, lineHeight: 44, fontWeight: '200' },
  digitCompact: { fontSize: fontSize.keypadCompact, lineHeight: 36 },
  letters: {
    ...typography.caption,
    fontSize: fontSize.micro,
    color: colors.subtext,
    width: 34,
    marginLeft: spacing.xxs,
    marginBottom: spacing.xs,
  },
  underline: { height: 1, backgroundColor: colors.primary, opacity: 0.5, marginTop: 2, marginHorizontal: spacing.xs },
});

export default React.memo(DialKey);
