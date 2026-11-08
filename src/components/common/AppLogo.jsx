import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, radius } from '@theme';
import Icon from './Icon';

/** Original CallingKaro mark: rounded white tile with an orange phone + signal waves. Replace with your brand logo. */
const AppLogo = ({ size = 32, inverted = false, style }) => (
  <View
    accessibilityLabel="CallingKaro logo"
    style={[
      styles.tile,
      {
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        backgroundColor: inverted ? colors.primary : colors.white,
      },
      style,
    ]}>
    <Icon name="phone-in-talk" size={Math.round(size * 0.62)} color={inverted ? colors.white : colors.primary} />
  </View>
);

AppLogo.propTypes = {
  size: PropTypes.number,
  inverted: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
});

export default AppLogo;
