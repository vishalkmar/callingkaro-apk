import { Vibration } from 'react-native';
import Sound from 'react-native-sound';
import { useSettingsStore } from '@store/settingsStore';

// Local UI sounds only (keypad tones, warning beeps). Call audio is handled by the voice SDK.
Sound.setCategory('Ambient', true);

const FILES = {
  1: 'dtmf_1.wav',
  2: 'dtmf_2.wav',
  3: 'dtmf_3.wav',
  4: 'dtmf_4.wav',
  5: 'dtmf_5.wav',
  6: 'dtmf_6.wav',
  7: 'dtmf_7.wav',
  8: 'dtmf_8.wav',
  9: 'dtmf_9.wav',
  0: 'dtmf_0.wav',
  '*': 'dtmf_star.wav',
  '#': 'dtmf_pound.wav',
  '+': 'dtmf_0.wav',
  beep: 'beep_soft.wav',
  doubleBeep: 'beep_double.wav',
};

const cache = {};
const load = key => {
  if (!cache[key] && FILES[key]) {
    cache[key] = new Sound(FILES[key], Sound.MAIN_BUNDLE, err => {
      if (err) {
        delete cache[key];
      }
    });
  }
  return cache[key];
};

/** Preload the 12 keypad tones so the first key press is instant. */
export const preloadTones = () => Object.keys(FILES).forEach(load);

const play = key => {
  const s = load(key);
  if (s?.isLoaded?.()) {
    s.stop(() => s.play());
  }
};

/** Keypad press feedback: DTMF tone + light haptic (each can be disabled in Settings > Calls). */
export const keyFeedback = key => {
  const { keypadTones, haptics } = useSettingsStore.getState();
  if (keypadTones) {
    play(String(key));
  }
  if (haptics) {
    Vibration.vibrate(10);
  }
};

export const haptic = (ms = 20) => {
  if (useSettingsStore.getState().haptics) {
    Vibration.vibrate(ms);
  }
};

export const beep = () => play('beep');
export const doubleBeep = () => play('doubleBeep');
