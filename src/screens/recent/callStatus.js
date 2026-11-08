import { colors } from '@theme';
import { NOT_CONNECTED } from '@db/schema';

/** Status -> icon / color / label used by Recent rows and Call Details. */
export const statusInfo = status => {
  if (status === 'completed' || status === 'connected') {
    return {
      icon: 'phone-outgoing',
      color: colors.successText,
      label: status === 'connected' ? 'In progress' : 'Connected',
    };
  }
  if (status === 'cancelled') {
    return { icon: 'phone-remove', color: colors.subtext, label: 'Cancelled' };
  }
  if (NOT_CONNECTED.includes(status)) {
    const labels = {
      'no-answer': 'No answer',
      busy: 'Busy',
      failed: 'Failed',
      'insufficient-credit': 'Not enough credits',
    };
    return { icon: 'phone-missed', color: colors.dangerText, label: labels[status] || 'Not connected' };
  }
  return { icon: 'phone-outgoing', color: colors.subtext, label: status === 'ringing' ? 'Ringing' : 'Dialing' };
};

export const isMissed = status => NOT_CONNECTED.includes(status) && status !== 'cancelled';
