import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing, radius, TOUCH_TARGET } from '@theme';
import AppText from './AppText';
import Icon from './Icon';

/** Rounded white dialog with up to two text buttons (layout of the Image 6 popup, but dismissible). */
const AppModal = ({
  visible,
  title,
  message,
  icon,
  iconColor = colors.primary,
  children,
  primaryText,
  onPrimary,
  secondaryText,
  onSecondary,
  primaryDanger = false,
  onClose,
}) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close dialog">
      <Pressable style={styles.card} accessibilityViewIsModal onPress={() => {}}>
        {icon ? <Icon name={icon} size={40} color={iconColor} style={styles.icon} /> : null}
        {title ? (
          <AppText variant="title" style={styles.title}>
            {title}
          </AppText>
        ) : null}
        {message ? (
          <AppText color="subtext" style={styles.message}>
            {message}
          </AppText>
        ) : null}
        {children}
        {primaryText || secondaryText ? (
          <View style={styles.actions}>
            {secondaryText ? (
              <Pressable android_ripple={{ color: colors.surfaceAlt }} onPress={onSecondary || onClose} style={styles.action} accessibilityRole="button">
                <AppText color="subtext" bold>
                  {secondaryText.toUpperCase()}
                </AppText>
              </Pressable>
            ) : null}
            {primaryText ? (
              <Pressable android_ripple={{ color: colors.surfaceAlt }} onPress={onPrimary} style={styles.action} accessibilityRole="button" testID="modal-primary">
                <AppText color={primaryDanger ? 'danger' : 'success'} bold>
                  {primaryText.toUpperCase()}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </Pressable>
  </Modal>
);

AppModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  icon: PropTypes.string,
  iconColor: PropTypes.string,
  children: PropTypes.node,
  primaryText: PropTypes.string,
  onPrimary: PropTypes.func,
  secondaryText: PropTypes.string,
  onSecondary: PropTypes.func,
  primaryDanger: PropTypes.bool,
  onClose: PropTypes.func,
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xs,
  },
  icon: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  title: { marginBottom: spacing.xs },
  message: { marginBottom: spacing.md, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
  action: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
});

export default AppModal;
