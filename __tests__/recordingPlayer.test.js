import React from 'react';
import { View } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('@react-native-vector-icons/material-design-icons/static', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { MaterialDesignIcons: ({ name }) => R.createElement(Text, null, `icon:${name}`) };
});
const mockSounds = [];
jest.mock('react-native-sound', () => {
  const S = jest.fn().mockImplementation((path, base, cb) => {
    const s = {
      path,
      t: 0,
      done: null,
      getDuration: () => 120,
      getCurrentTime: fn => fn(s.t),
      play: jest.fn(done => {
        s.done = done;
      }),
      pause: jest.fn(),
      stop: jest.fn(),
      release: jest.fn(),
      setCurrentTime: jest.fn(t => {
        s.t = t;
      }),
    };
    mockSounds.push(s);
    setTimeout(() => cb && cb(null), 0);
    return s;
  });
  return S;
});

const RecordingPlayer = require('@components/RecordingPlayer').default;
const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 10));
  });

beforeEach(() => {
  mockSounds.length = 0;
});

describe('RecordingPlayer (P23.T15)', () => {
  test('play / pause / finished resets to 0', async () => {
    const u = render(<RecordingPlayer filePath="/r/a.mp3" />);
    await flush();
    expect(u.getByText('2:00')).toBeTruthy(); // real duration from the file
    fireEvent.press(u.getByLabelText('Play recording'));
    expect(mockSounds[0].play).toHaveBeenCalled();
    fireEvent.press(u.getByLabelText('Pause recording'));
    expect(mockSounds[0].pause).toHaveBeenCalled();
    fireEvent.press(u.getByLabelText('Play recording'));
    act(() => mockSounds[0].done(true));
    expect(u.getByLabelText('Play recording')).toBeTruthy();
    expect(mockSounds[0].setCurrentTime).toHaveBeenLastCalledWith(0);
  });

  test('seek by touch and by TalkBack swipe', async () => {
    const u = render(<RecordingPlayer filePath="/r/a.mp3" />);
    await flush();
    const bar = u.getByLabelText('Seek');
    fireEvent(bar, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(bar, 'responderGrant', { nativeEvent: { locationX: 100 } });
    expect(mockSounds[0].setCurrentTime).toHaveBeenLastCalledWith(60);
    fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(mockSounds[0].setCurrentTime).toHaveBeenLastCalledWith(65);
  });

  test('BUG FIX: starting a second player pauses the first AND resets its button', async () => {
    const u = render(
      <View>
        <RecordingPlayer filePath="/r/a.mp3" />
        <RecordingPlayer filePath="/r/b.mp3" />
      </View>,
    );
    await flush();
    const [first, second] = u.getAllByLabelText('Play recording');
    fireEvent.press(first);
    expect(u.getAllByLabelText('Pause recording')).toHaveLength(1);
    fireEvent.press(second);
    expect(mockSounds[0].pause).toHaveBeenCalled();
    expect(u.getAllByLabelText('Pause recording')).toHaveLength(1); // only the second one shows "pause"
    expect(u.getAllByLabelText('Play recording')).toHaveLength(1);
  });

  test('missing file -> friendly error, play disabled; sound released on unmount', async () => {
    const Sound = require('react-native-sound');
    Sound.mockImplementationOnce((p, b, cb) => {
      const s = { stop: jest.fn(), release: jest.fn() };
      mockSounds.push(s);
      setTimeout(() => cb(new Error('not found')), 0);
      return s;
    });
    const u = render(<RecordingPlayer filePath="/r/missing.mp3" />);
    await flush();
    expect(u.getByText('Could not open this recording')).toBeTruthy();
    u.unmount();
    expect(mockSounds[0].release).toHaveBeenCalled();
  });
});
