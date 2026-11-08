import Toast from 'react-native-toast-message';

// Thin wrapper so screens never import the toast library directly.
const show = (type, text1, text2, opts = {}) =>
  Toast.show({ type, text1, text2, position: 'bottom', visibilityTime: 3000, ...opts });

export const toast = {
  success: (title, message, opts) => show('success', title, message, opts),
  error: (title, message, opts) => show('error', title, message, opts),
  info: (title, message, opts) => show('info', title, message, opts),
  // Snackbar with an action (e.g. Undo). onAction runs when the toast is tapped.
  action: (title, actionLabel, onAction, opts = {}) =>
    show('info', title, `Tap to ${actionLabel.toLowerCase()}`, {
      visibilityTime: 4000,
      onPress: () => {
        Toast.hide();
        onAction?.();
      },
      ...opts,
    }),
  hide: () => Toast.hide(),
};

export default toast;
