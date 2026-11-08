import './helpers/nativeMocks';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import { useAppStore } from '@store/appStore';
import { useAuthStore } from '@store/authStore';
import { useWalletStore } from '@store/walletStore';

jest.setTimeout(30000);

const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@services/api/authApi', () => ({
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  getMe: jest.fn(),
  logoutSession: jest.fn(),
}));
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: 2000 })) }));
jest.mock('react-native-device-info', () => ({ getUniqueId: jest.fn(async () => 'stable-device-id-123') }));

const authApi = require('@services/api/authApi');
const EmailEntryScreen = require('@screens/auth/EmailEntryScreen').default;
const OtpVerifyScreen = require('@screens/auth/OtpVerifyScreen').default;

const apiError = (code, message, data) => Object.assign(new Error(message), { code, data });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  useAppStore.setState({ stage: 'auth' });
});

describe('EmailEntryScreen (P08.T01-T04, T13-T14)', () => {
  test('shows the tagline, illustration and SEND OTP', () => {
    const u = render(<EmailEntryScreen />);
    expect(u.getByText(/Call any number in India using credits/)).toBeTruthy();
    expect(u.getByText('SEND OTP')).toBeTruthy();
  });

  test('invalid email -> inline error, no request; typing clears the error', () => {
    const u = render(<EmailEntryScreen />);
    fireEvent.changeText(u.getByTestId('email-input'), 'ravi@');
    fireEvent.press(u.getByTestId('send-otp'));
    expect(u.getByText(/valid email/i)).toBeTruthy();
    expect(authApi.sendOtp).not.toHaveBeenCalled();
    fireEvent.changeText(u.getByTestId('email-input'), 'ravi@example.com');
    expect(u.queryByText(/valid email/i)).toBeNull();
  });

  test('spinner + disabled while sending; double tap sends once; navigates with normalised email', async () => {
    const d = deferred();
    authApi.sendOtp.mockReturnValueOnce(d.promise);
    const u = render(<EmailEntryScreen />);
    fireEvent.changeText(u.getByTestId('email-input'), '  Ravi@Example.COM ');
    fireEvent.press(u.getByTestId('send-otp'));
    fireEvent.press(u.getByTestId('send-otp'));
    expect(authApi.sendOtp).toHaveBeenCalledTimes(1);
    expect(authApi.sendOtp).toHaveBeenCalledWith('ravi@example.com');
    expect(u.getByTestId('send-otp').props.accessibilityState.busy).toBe(true);
    await act(async () => d.resolve({ resendInSeconds: 60 }));
    expect(mockNav.navigate).toHaveBeenCalledWith('OtpVerify', { email: 'ravi@example.com', resendIn: 60 });
  });

  test('server error shows a friendly message under the field', async () => {
    authApi.sendOtp.mockRejectedValueOnce(apiError('EMAIL_SEND_FAILED', 'Could not send code, try again'));
    const u = render(<EmailEntryScreen />);
    fireEvent.changeText(u.getByTestId('email-input'), 'ravi@example.com');
    await act(async () => fireEvent.press(u.getByTestId('send-otp')));
    expect(u.getByText(/Could not send/)).toBeTruthy();
    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  test('cooldown error still opens the code screen with the remaining wait', async () => {
    authApi.sendOtp.mockRejectedValueOnce(apiError('OTP_COOLDOWN', 'wait', { retryAfterSeconds: 42 }));
    const u = render(<EmailEntryScreen />);
    fireEvent.changeText(u.getByTestId('email-input'), 'ravi@example.com');
    await act(async () => fireEvent.press(u.getByTestId('send-otp')));
    expect(mockNav.navigate).toHaveBeenCalledWith('OtpVerify', { email: 'ravi@example.com', resendIn: 42 });
  });
});

describe('OtpVerifyScreen (P08.T05-T12)', () => {
  // One event per digit (like real typing), then let the async submit finish.
  const type = async (u, code) => {
    code.split('').forEach((d, i) => fireEvent.changeText(u.getByTestId(`otp-box-${i}`), d));
    await act(async () => {
      await new Promise(r => setTimeout(r, 20));
    });
  };

  test('shows the email, Change email goes back, resend countdown then Resend link', async () => {
    jest.useFakeTimers();
    mockParams = { email: 'ravi@example.com', resendIn: 3 };
    authApi.sendOtp.mockResolvedValue({ resendInSeconds: 60 });
    const u = render(<OtpVerifyScreen />);
    expect(u.getByText('ravi@example.com')).toBeTruthy();
    expect(u.getByText(/Resend in/)).toBeTruthy();
    fireEvent.press(u.getByText('Change email'));
    expect(mockNav.goBack).toHaveBeenCalled();
    for (let i = 0; i < 3; i++) {
      await act(async () => jest.advanceTimersByTime(1000));
    }
    expect(u.queryByText(/Resend in/)).toBeNull();
    await act(async () => fireEvent.press(u.getByText('Resend code')));
    expect(authApi.sendOtp).toHaveBeenCalledWith('ravi@example.com');
    expect(u.getByText(/Resend in/)).toBeTruthy(); // countdown restarted
    jest.useRealTimers();
  });

  test('6th digit auto-submits with a stable deviceId; tokens go to Keychain; stage -> permissions', async () => {
    mockParams = { email: 'ravi@example.com' };
    authApi.verifyOtp.mockResolvedValueOnce({
      user: { id: 'u1', email: 'ravi@example.com' },
      isNew: true,
      tokens: { accessToken: 'acc', refreshToken: 'ref' },
      wallet: { credits: 2000, minutes: 2 },
    });
    const u = render(<OtpVerifyScreen />);
    await type(u, '482915');
    expect(authApi.verifyOtp).toHaveBeenCalledTimes(1);
    expect(authApi.verifyOtp).toHaveBeenCalledWith({
      email: 'ravi@example.com',
      otp: '482915',
      deviceId: 'stable-device-id-123',
      termsVersion: 'v1',
    });
    expect(Keychain.setGenericPassword).toHaveBeenCalled();
    const saved = JSON.parse(Keychain.setGenericPassword.mock.calls.at(-1)[1]);
    expect(saved).toMatchObject({ accessToken: 'acc', refreshToken: 'ref' });
    expect(useAuthStore.getState().user.email).toBe('ravi@example.com');
    expect(useWalletStore.getState().credits).toBe(2000);
    expect(useAppStore.getState().stage).toBe('permissions'); // stack swap == navigation.reset
  });

  test.each([
    ['OTP_INVALID', { attemptsLeft: 3 }, /Wrong code.*3 attempt/],
    ['OTP_EXPIRED', undefined, /expired/i],
    ['OTP_LOCKED', undefined, /Too many/i],
    ['NETWORK', undefined, /internet/i],
  ])('error %s is shown in plain words and the boxes reset', async (code, data, text) => {
    mockParams = { email: 'ravi@example.com' };
    authApi.verifyOtp.mockRejectedValueOnce(apiError(code, 'x', data));
    const u = render(<OtpVerifyScreen />);
    await type(u, '111111');
    expect(u.getByText(text)).toBeTruthy();
    expect(u.getByTestId('otp-box-0').props.value).toBe('');
    expect(useAppStore.getState().stage).toBe('auth');
  });

  test('VERIFY stays disabled until 6 digits', () => {
    mockParams = { email: 'ravi@example.com' };
    const u = render(<OtpVerifyScreen />);
    expect(u.getByTestId('verify-otp').props.accessibilityState.disabled).toBe(true);
  });
});
