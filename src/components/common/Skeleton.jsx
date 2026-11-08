import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing, radius } from '@theme';

/** Pulsing grey block used while data loads. */
export const SkeletonBlock = ({ width = '100%', height = 14, style, round = false }) => {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { width, height, opacity, backgroundColor: colors.skeleton, borderRadius: round ? height / 2 : radius.sm },
        style,
      ]}
    />
  );
};

SkeletonBlock.propTypes = {
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.number,
  round: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

/** N skeleton list rows (avatar + 2 lines). */
const SkeletonList = ({ rows = 6, avatar = true }) => (
  <View accessibilityLabel="Loading" accessibilityRole="progressbar">
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={styles.row}>
        {avatar ? <SkeletonBlock width={40} height={40} round /> : null}
        <View style={styles.lines}>
          <SkeletonBlock width="60%" height={14} />
          <SkeletonBlock width="35%" height={10} style={styles.second} />
        </View>
      </View>
    ))}
  </View>
);

SkeletonList.propTypes = { rows: PropTypes.number, avatar: PropTypes.bool };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: spacing.md },
  lines: { flex: 1, marginLeft: spacing.sm },
  second: { marginTop: spacing.xs },
});

export default SkeletonList;
