import React from 'react';
import PropTypes from 'prop-types';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static';
import { colors } from '@theme';

// Single icon entry point (MaterialCommunityIcons / MDI set) so the icon font can be swapped in one place.
const Icon = ({ name, size = 24, color = colors.text, style }) => (
  <MaterialDesignIcons name={name} size={size} color={color} style={style} />
);

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.number,
  color: PropTypes.string,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

export default React.memo(Icon);
