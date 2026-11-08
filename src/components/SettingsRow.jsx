import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import PropTypes from 'prop-types';
import { AppText, Icon } from '@components/common';
import { colors, spacing } from '@theme';

/** Grouped-list row: icon, title, optional subtitle, and a switch / value / chevron on the right. */
const SettingsRow = ({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  onPress,
  right,
  danger = false,
  disabled = false,
}) => {
  const isSwitch = typeof value === 'boolean' && onValueChange;
  return (
    <Pressable
      style={styles.row}
      onPress={isSwitch ? () => onValueChange(!value) : onPress}
      disabled={disabled || (!onPress && !isSwitch)}
      android_ripple={{ color: colors.surfaceAlt }}
      accessibilityRole={isSwitch ? 'switch' : onPress ? 'button' : undefined}
      accessibilityState={isSwitch ? { checked: value, disabled } : { disabled }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join('. ')}>
      {icon ? <Icon name={icon} size={22} color={danger ? colors.danger : colors.subtext} style={styles.icon} /> : null}
      <View style={styles.text}>
        <AppText color={danger ? 'danger' : 'text'}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="subtext">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {isSwitch ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: colors.primarySoft, false: colors.divider }}
          thumbColor={value ? colors.primary : colors.white}
        />
      ) : (
        right || (onPress ? <Icon name="chevron-right" color={colors.subtext} /> : null)
      )}
    </Pressable>
  );
};

SettingsRow.propTypes = {
  icon: PropTypes.string,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  value: PropTypes.bool,
  onValueChange: PropTypes.func,
  onPress: PropTypes.func,
  right: PropTypes.node,
  danger: PropTypes.bool,
  disabled: PropTypes.bool,
};

export const SettingsGroup = ({ title, children }) => (
  <View style={styles.group}>
    <AppText variant="caption" bold color="primary" style={styles.groupTitle}>
      {title.toUpperCase()}
    </AppText>
    {children}
  </View>
);

SettingsGroup.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: spacing.md },
  icon: { marginRight: spacing.md },
  text: { flex: 1, paddingVertical: spacing.xs },
  group: { paddingTop: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  groupTitle: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxs, letterSpacing: 0.5 },
});

export default SettingsRow;
