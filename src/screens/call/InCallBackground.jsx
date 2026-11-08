import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@theme';

/** Original soft lavender gradient with abstract wave shapes (our own artwork). */
const InCallBackground = () => {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[colors.inCallBgTop, colors.inCallBgBottom]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path
          d={`M0 ${height * 0.35} C ${width * 0.3} ${height * 0.28}, ${width * 0.55} ${height * 0.48}, ${width} ${
            height * 0.38
          } L ${width} ${height * 0.62} C ${width * 0.6} ${height * 0.72}, ${width * 0.35} ${height * 0.5}, 0 ${
            height * 0.6
          } Z`}
          fill={colors.inCallShape}
          opacity={0.35}
        />
        <Path
          d={`M0 ${height * 0.7} C ${width * 0.4} ${height * 0.62}, ${width * 0.6} ${height * 0.82}, ${width} ${
            height * 0.72
          } L ${width} ${height} L 0 ${height} Z`}
          fill={colors.inCallShape}
          opacity={0.25}
        />
        <Circle cx={width * 0.85} cy={height * 0.18} r={width * 0.22} fill={colors.white} opacity={0.25} />
        <Circle cx={width * 0.1} cy={height * 0.5} r={width * 0.12} fill={colors.white} opacity={0.2} />
      </Svg>
    </View>
  );
};

export default React.memo(InCallBackground);
