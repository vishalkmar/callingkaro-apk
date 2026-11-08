import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Text as SvgText, Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import PropTypes from 'prop-types';
import { colors } from '@theme';

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const slicePath = (cx, cy, r, start, end) => {
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
};

/**
 * Segment angle that ends under the top pointer for a given index (+ small jitter inside the slice).
 * Segment i spans [i*seg, (i+1)*seg] clockwise from the top. Rotating the wheel clockwise by R
 * puts the point at angle (360 - R) under the pointer.
 */
export const rotationForIndex = (index, count, jitter = 0) => {
  const seg = 360 / count;
  const center = index * seg + seg / 2 + jitter * seg * 0.35;
  return (360 - center + 360) % 360;
};

/** 8-segment wheel drawn from server config, alternating orange / white. Spin via ref.spinTo(index, onDone). */
const SpinWheel = forwardRef(({ segments, size = 300 }, ref) => {
  const rotation = useSharedValue(0);
  const r = size / 2;
  const seg = 360 / Math.max(1, segments.length);

  useImperativeHandle(ref, () => ({
    // Called only AFTER the server returned the result - the animation just shows it.
    spinTo: (index, onDone) => {
      const current = rotation.value % 360;
      const target =
        rotation.value - current + 6 * 360 + rotationForIndex(index, segments.length, Math.random() * 2 - 1);
      rotation.value = withTiming(target, { duration: 4200, easing: Easing.out(Easing.cubic) }, finished => {
        if (finished && onDone) {
          scheduleOnRN(onDone);
        }
      });
    },
  }));

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Svg width={size} height={size}>
          <Circle cx={r} cy={r} r={r - 1} fill={colors.primaryDark} />
          <G>
            {segments.map((s, i) => {
              const start = i * seg;
              const end = start + seg;
              const [tx, ty] = polar(r, r, r * 0.66, start + seg / 2);
              const orange = i % 2 === 0;
              return (
                <G key={i}>
                  <Path
                    d={slicePath(r, r, r - 6, start, end)}
                    fill={orange ? colors.primary : colors.white}
                    stroke={colors.primaryDark}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={tx}
                    y={ty}
                    fill={orange ? colors.white : colors.primary}
                    fontSize={s.label.length > 5 ? 12 : 18}
                    fontWeight="bold"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${start + seg / 2} ${tx} ${ty})`}>
                    {s.label}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
});

SpinWheel.propTypes = {
  segments: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired })).isRequired,
  size: PropTypes.number,
};

export default SpinWheel;
