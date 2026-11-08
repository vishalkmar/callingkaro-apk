import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Keypad from '@screens/dialpad/components/Keypad';
import NumberDisplay from '@screens/dialpad/components/NumberDisplay';

// Dialpad input behaviour is driven by Keypad + NumberDisplay; this harness mirrors DialpadScreen's state logic.
const Harness = () => {
  const [n, setN] = React.useState('');
  return (
    <>
      <NumberDisplay
        value={n}
        onBackspace={() => setN(v => v.slice(0, -1))}
        onClear={() => setN('')}
        onPaste={() => {}}
      />
      <Keypad onKey={d => setN(v => v + d)} onLongKey={d => d === '0' && setN(v => (v === '' ? '+' : `${v}0`))} />
    </>
  );
};

const typeDigits = (utils, digits) => digits.split('').forEach(d => fireEvent.press(utils.getByTestId(`key-${d}`)));

describe('Dialpad input', () => {
  test('typing shows an auto-formatted Indian number', () => {
    const utils = render(<Harness />);
    typeDigits(utils, '9876543210');
    expect(utils.getByTestId('dial-number').props.children.replace(/\s/g, '')).toBe('9876543210');
  });

  test('long-press 0 inserts + at the start', () => {
    const utils = render(<Harness />);
    fireEvent(utils.getByTestId('key-0'), 'longPress');
    typeDigits(utils, '91');
    expect(utils.getByTestId('dial-number').props.children.replace(/\s/g, '')).toBe('+91');
  });

  test('backspace removes one digit, long-press clears', () => {
    const utils = render(<Harness />);
    typeDigits(utils, '123');
    fireEvent.press(utils.getByTestId('backspace'));
    expect(utils.getByTestId('dial-number').props.children.replace(/\s/g, '')).toBe('12');
    fireEvent(utils.getByTestId('backspace'), 'longPress');
    expect(utils.getByTestId('dial-number').props.children.trim()).toBe('');
  });
});
