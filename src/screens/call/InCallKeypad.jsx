import React from 'react';
import { StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing } from '@theme';
import Keypad from '@screens/dialpad/components/Keypad';

/** DTMF keypad that slides over the controls during a call (IVR menus, "press 1"). */
const InCallKeypad = ({ onDigit }) => (
  <View style={styles.wrap}>
    <Keypad onKey={onDigit} color={colors.text} compact />
  </View>
);

InCallKeypad.propTypes = { onDigit: PropTypes.func.isRequired };

const styles = StyleSheet.create({
  wrap: { height: 250, paddingHorizontal: spacing.md },
});

export default InCallKeypad;
