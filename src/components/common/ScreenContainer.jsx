import React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { colors } from '@theme';

/**
 * Safe-area wrapper. Android draws edge-to-edge, so we paint the status-bar
 * inset ourselves with `statusBarColor` (orange under the header, white elsewhere).
 */
const ScreenContainer = ({
  children,
  statusBarColor = colors.background,
  barStyle,
  backgroundColor = colors.background,
  edges = ['top', 'bottom'],
  translucent = false,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const resolvedBarStyle = barStyle || (statusBarColor === colors.primary ? 'light-content' : 'dark-content');
  return (
    <View style={[styles.root, { backgroundColor }]}>
      <StatusBar barStyle={resolvedBarStyle} backgroundColor="transparent" translucent />
      {edges.includes('top') && !translucent ? (
        <View style={{ height: insets.top, backgroundColor: statusBarColor }} />
      ) : null}
      <View style={[styles.content, edges.includes('bottom') && { paddingBottom: insets.bottom }, style]}>
        {children}
      </View>
    </View>
  );
};

ScreenContainer.propTypes = {
  children: PropTypes.node,
  statusBarColor: PropTypes.string,
  barStyle: PropTypes.oneOf(['light-content', 'dark-content']),
  backgroundColor: PropTypes.string,
  edges: PropTypes.arrayOf(PropTypes.oneOf(['top', 'bottom'])),
  translucent: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});

export default ScreenContainer;
