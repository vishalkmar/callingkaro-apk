import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing, radius, typography, FONT_SCALE } from '@theme';
import { emptyOtp, applyOtpChange, applyOtpBackspace, isOtpComplete } from './otpLogic';

const OtpInput = ({ length = 6, onChange, onComplete, disabled = false, error = false, resetKey }) => {
  const [digits, setDigits] = useState(() => emptyOtp(length));
  const refs = useRef([]);

  useEffect(() => {
    setDigits(emptyOtp(length));
    setTimeout(() => refs.current[0]?.focus(), 50);
  }, [length, resetKey]);

  const update = useCallback(
    ({ digits: next, focusIndex }) => {
      setDigits(next);
      const code = next.join('');
      onChange?.(code);
      if (isOtpComplete(next)) {
        refs.current[focusIndex]?.blur();
        onComplete?.(code);
      } else {
        refs.current[focusIndex]?.focus();
      }
    },
    [onChange, onComplete],
  );

  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <TextInput
          maxFontSizeMultiplier={FONT_SCALE.dense}
          key={i}
          ref={r => {
            refs.current[i] = r;
          }}
          testID={`otp-box-${i}`}
          value={d}
          editable={!disabled}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? 'sms-otp' : 'off'}
          maxLength={i === 0 ? length : 1}
          selectTextOnFocus
          accessibilityLabel={`Digit ${i + 1} of ${length}`}
          onChangeText={t => update(applyOtpChange(digits, i, t))}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && !digits[i]) {
              update(applyOtpBackspace(digits, i));
            }
          }}
          style={[styles.box, d && styles.filled, error && styles.error, disabled && styles.disabled]}
        />
      ))}
    </View>
  );
};

OtpInput.propTypes = {
  length: PropTypes.number,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  disabled: PropTypes.bool,
  error: PropTypes.bool,
  resetKey: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  box: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    textAlign: 'center',
    ...typography.header,
    color: colors.text,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xxs / 2,
    padding: 0,
  },
  filled: { borderColor: colors.primary },
  error: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
});

export default OtpInput;
