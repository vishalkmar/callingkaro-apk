import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing } from '@theme';
import AppText from './AppText';
import AppButton from './AppButton';
import Icon from './Icon';

/**
 * Illustration slot + message + optional green link or button.
 * `linkText` renders inline green underlined text inside the message, e.g.
 * message="Allow {link} to pick a number" linkText="Access to Contacts".
 */
const EmptyState = ({
  icon,
  illustration,
  message,
  linkText,
  onLinkPress,
  actionTitle,
  onAction,
  panel = false,
  style,
}) => {
  const parts = linkText && message.includes('{link}') ? message.split('{link}') : null;
  return (
    <View style={[styles.wrap, panel && styles.panel, style]}>
      {illustration || (icon ? <Icon name={icon} size={56} color={colors.disabled} style={styles.icon} /> : null)}
      {parts ? (
        <AppText color="subtext" center style={styles.msg}>
          {parts[0]}
          <AppText
            color="success"
            style={styles.link}
            onPress={onLinkPress}
            accessibilityRole="link"
            suppressHighlighting={false}>
            {linkText}
          </AppText>
          {parts[1]}
        </AppText>
      ) : (
        <AppText color="subtext" center style={styles.msg}>
          {message}
        </AppText>
      )}
      {linkText && !parts ? (
        <AppText
          color="success"
          style={[styles.link, styles.standaloneLink]}
          onPress={onLinkPress}
          accessibilityRole="link">
          {linkText}
        </AppText>
      ) : null}
      {actionTitle ? <AppButton title={actionTitle} onPress={onAction} fullWidth={false} style={styles.btn} /> : null}
    </View>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.string,
  illustration: PropTypes.node,
  message: PropTypes.string.isRequired,
  linkText: PropTypes.string,
  onLinkPress: PropTypes.func,
  actionTitle: PropTypes.string,
  onAction: PropTypes.func,
  panel: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  panel: { backgroundColor: colors.surfaceAlt },
  icon: { marginBottom: spacing.md },
  msg: { lineHeight: 22 },
  link: { textDecorationLine: 'underline' },
  standaloneLink: { marginTop: spacing.xs, padding: spacing.xs },
  btn: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
});

export default EmptyState;
