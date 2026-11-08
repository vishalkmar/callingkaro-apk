import AsyncStorage from '@react-native-async-storage/async-storage';
import { acceptTerms, bootstrap, resetOnboarding } from '@services/auth/authService';
import { useAppStore } from '@store/appStore';
import { TERMS_OF_USE, PRIVACY_POLICY } from '@constants/legal';

jest.mock('@services/api/authApi', () => ({ getMe: jest.fn(), logoutSession: jest.fn(), healthCheck: jest.fn() }));
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: 0 })) }));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('first launch / second launch (P05.T15)', () => {
  test('fresh install starts at onboarding; after OK it never shows Welcome again', async () => {
    expect(await bootstrap()).toBe('onboarding');
    await acceptTerms();
    expect(useAppStore.getState().stage).toBe('auth');
    // second launch: terms accepted, no session yet -> straight to login
    expect(await bootstrap()).toBe('auth');
  });

  test('a new terms version asks for consent again (P05.T09)', async () => {
    await acceptTerms();
    await AsyncStorage.setItem('termsVersion', 'v0');
    expect(await bootstrap()).toBe('onboarding');
  });

  test('dev "Reset onboarding" goes back to Welcome (P05.T16)', async () => {
    await acceptTerms();
    await resetOnboarding();
    expect(useAppStore.getState().stage).toBe('onboarding');
    expect(await bootstrap()).toBe('onboarding');
  });
});

describe('legal texts (P05.T12, P13.T18)', () => {
  const terms = TERMS_OF_USE.sections
    .map(s => `${s.heading} ${s.body}`)
    .join(' ')
    .toLowerCase();
  const privacy = PRIVACY_POLICY.sections
    .map(s => `${s.heading} ${s.body}`)
    .join(' ')
    .toLowerCase();
  test.each(['harass', 'fraud', 'impersonat', 'record', 'refund', '1000 credits = 1 minute'])(
    'terms mention "%s"',
    word => {
      expect(terms).toContain(word);
    },
  );
  test('privacy says contacts are never uploaded', () => {
    expect(privacy).toMatch(/contacts.*never uploaded/);
  });
});
