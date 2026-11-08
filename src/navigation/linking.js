import { STACKS, ROUTES } from '@constants/routes';

// callingkaro://wallet, callingkaro://spin, callingkaro://dial/+919876543210, callingkaro://recent
export const linking = {
  prefixes: ['callingkaro://'],
  config: {
    screens: {
      [STACKS.MAIN]: {
        screens: {
          [ROUTES.MAIN_TABS]: {
            screens: {
              [ROUTES.DIALPAD]: 'dial/:prefill?',
              [ROUTES.CONTACTS]: 'contacts',
              [ROUTES.RECENT]: 'recent',
              [ROUTES.GET_MINUTES]: 'wallet',
            },
          },
          [ROUTES.SPIN_WHEEL]: 'spin',
          [ROUTES.WALLET_HISTORY]: 'wallet/history',
          [ROUTES.SETTINGS]: 'settings',
          [ROUTES.HELP]: 'help',
        },
      },
    },
  },
};

export default linking;
