// Phase 27 scenarios that can be checked without a phone: credit thresholds at CALL time,
// stale cached balance, number rules + offline in one place (placeCall is the gate for every CALL button).
import { useWalletStore } from '@store/walletStore';
import { useCallGateStore } from '@store/callGateStore';
import { useCallStore } from '@store/callStore';

jest.mock('@services/voice/voiceService', () => ({
  __esModule: true,
  default: { startCall: jest.fn(async () => true) },
}));
jest.mock('@services/permissions/permissions', () => ({
  check: jest.fn(async () => 'granted'),
  STATUS: { GRANTED: 'granted' },
}));
let mockOnline = true;
jest.mock('@hooks/useNetwork', () => ({ isOnlineNow: async () => mockOnline }));
let mockServerCredits = 0;
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: mockServerCredits })) }));
jest.mock('@services/audio/tones', () => ({ haptic: jest.fn() }));

const voiceService = require('@services/voice/voiceService').default;
const { placeCall } = require('@services/calls/placeCall');

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  useCallGateStore.getState().close();
  useCallStore.getState().clear();
});

describe('P27.T14 credit thresholds at CALL', () => {
  test.each([
    [0, false],
    [999, false],
    [1000, true],
    [1001, true],
  ])('%s credits -> call starts: %s', async (credits, starts) => {
    useWalletStore.setState({ credits });
    mockServerCredits = credits;
    expect(await placeCall({ number: '9876543210' })).toBe(starts);
    expect(useCallGateStore.getState().dialog).toBe(starts ? null : 'credits');
    expect(voiceService.startCall).toHaveBeenCalledTimes(starts ? 1 : 0);
  });

  test('cached balance is stale (bought on another phone) -> server balance is re-checked, call goes through', async () => {
    useWalletStore.setState({ credits: 0 });
    mockServerCredits = 80000;
    expect(await placeCall({ number: '9876543210' })).toBe(true);
    expect(useWalletStore.getState().credits).toBe(80000);
  });

  test('offline -> no wallet request, no call', async () => {
    mockOnline = false;
    useWalletStore.setState({ credits: 5000 });
    expect(await placeCall({ number: '9876543210' })).toBe(false);
    expect(voiceService.startCall).not.toHaveBeenCalled();
  });

  test('a call already running blocks a second one from any CALL button', async () => {
    useWalletStore.setState({ credits: 5000 });
    useCallStore.getState().begin({ localId: 1, number: '+919876543210' });
    expect(await placeCall({ number: '9812345678' })).toBe(false);
  });

  test('invalid / emergency numbers never reach the wallet or the provider', async () => {
    const walletApi = require('@services/api/walletApi');
    useWalletStore.setState({ credits: 0 });
    await placeCall({ number: '112' });
    await placeCall({ number: '123' });
    expect(walletApi.getWallet).not.toHaveBeenCalled();
    expect(voiceService.startCall).not.toHaveBeenCalled();
  });
});
