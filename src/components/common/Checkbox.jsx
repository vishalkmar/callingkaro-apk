import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing, radius, TOUCH_TARGET } from '@theme';
import AppText from './AppText';
import Icon from './Icon';

/** Orange-when-checked checkbox with label (Image 1). */
const Checkbox = ({ checked, onChange, label, children, accessibilityLabel, testID }) => (
  <Pressable android_ripple={{ color: colors.surfaceAlt }}
    testID={testID}
    onPress={() => onChange(!checked)}
    style={styles.row}
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
    accessibilityLabel={accessibilityLabel || label}
    hitSlop={4}>
    <View style={[styles.box, checked && styles.checked]}>
      {checked ? <Icon name="check" size={16} color={colors.white} /> : null}
    </View>
    {children || (
      <AppText color="subtext" style={styles.label}>
        {label}
      </AppText>
    )}
  </Pressable>
);

Checkbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  children: PropTypes.node,
  accessibilityLabel: PropTypes.string,
  testID: PropTypes.string,
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: colors.subtext,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { flex: 1 },
});

export default Checkbox;
