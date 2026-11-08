import React, { useState } from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Checkbox, AppButton, OtpInput } from '@components/common';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

describe('Checkbox gating (Welcome screen rule: OK disabled until checked)', () => {
  const Gate = () => {
    const [checked, setChecked] = useState(false);
    return (
      <>
        <Checkbox testID="cb" checked={checked} onChange={setChecked} label="I accept" />
        <AppButton testID="ok" title="OK" disabled={!checked} onPress={() => {}} />
      </>
    );
  };

  test('button is disabled, then enabled after ticking', () => {
    const { getByTestId } = render(<Gate />);
    expect(getByTestId('ok').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('cb').props.accessibilityState.checked).toBe(false);
    fireEvent.press(getByTestId('cb'));
    expect(getByTestId('cb').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('ok').props.accessibilityState.disabled).toBe(false);
  });
});

describe('OtpInput', () => {
  test('typing 6 digits calls onComplete once with the code', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    const { getByTestId } = render(<OtpInput onComplete={onComplete} />);
    act(() => jest.runAllTimers());
    '482915'.split('').forEach((d, i) => fireEvent.changeText(getByTestId(`otp-box-${i}`), d));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('482915');
    jest.useRealTimers();
  });

  test('pasting the full code into the first box completes it', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OtpInput onComplete={onComplete} />);
    fireEvent.changeText(getByTestId('otp-box-0'), '123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });
});
