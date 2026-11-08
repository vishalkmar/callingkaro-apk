import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import PropTypes from 'prop-types';
import { lightColors, darkColors } from './colors';
import { typography, fontSize, fontWeight, FONT_SCALE } from './typography';
import { spacing } from './spacing';
import { radius, TOUCH_TARGET } from './radius';

const build = (colors, dark) => ({
  dark,
  colors,
  typography,
  fontSize,
  fontWeight,
  spacing,
  radius,
  touchTarget: TOUCH_TARGET,
});

// Static light theme - used by StyleSheet.create in screens.
export const theme = build(lightColors, false);
export const darkTheme = build(darkColors, true);

const ThemeContext = createContext(theme);

/**
 * mode: 'light' | 'dark' | 'system'. v1 ships light UI; dark tokens are ready
 * so a screen can opt-in via useTheme() without API changes.
 */
export const ThemeProvider = ({ mode = 'light', children }) => {
  const system = useColorScheme();
  const value = useMemo(() => {
    const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
    return isDark ? darkTheme : theme;
  }, [mode, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

ThemeProvider.propTypes = {
  mode: PropTypes.oneOf(['light', 'dark', 'system']),
  children: PropTypes.node,
};

export const useTheme = () => useContext(ThemeContext);

export const colors = lightColors;
export { typography, fontSize, fontWeight, FONT_SCALE, spacing, radius, TOUCH_TARGET };
export default theme;
