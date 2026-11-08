import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path, G, Ellipse, Text as SvgText } from 'react-native-svg';
import PropTypes from 'prop-types';
import { colors } from '@theme';
import Icon from '@components/common/Icon';

/**
 * Original CallingKaro illustration (not derived from any third-party artwork):
 * a phone outline on a soft orange blob, sound waves, and a floating card that
 * shows either a text badge or an icon. Used by Welcome, Login and Permission screens.
 */
const PhoneIllustration = ({ badgeText, icon = 'phone-in-talk', size = 240 }) => {
  const w = size;
  const h = size * 0.9;
  return (
    <View
      style={[styles.wrap, { width: w, height: h }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={w} height={h} viewBox="0 0 240 216">
        {/* background blob */}
        <Path
          d="M38 120c-14-42 18-86 66-92 40-5 92 6 104 46 13 42-14 92-62 104-46 11-94-16-108-58z"
          fill={colors.primarySoft}
        />
        {/* ground */}
        <Ellipse cx="120" cy="204" rx="92" ry="6" fill={colors.divider} />
        {/* phone */}
        <G>
          <Rect
            x="78"
            y="26"
            width="84"
            height="172"
            rx="14"
            fill={colors.white}
            stroke={colors.divider}
            strokeWidth="3"
          />
          <Rect x="104" y="34" width="32" height="6" rx="3" fill={colors.divider} />
          <Rect x="90" y="56" width="60" height="8" rx="4" fill={colors.surfaceAlt} />
          <Rect x="90" y="72" width="44" height="8" rx="4" fill={colors.surfaceAlt} />
          <Rect x="90" y="140" width="60" height="6" rx="3" fill={colors.surfaceAlt} />
          <Rect x="90" y="152" width="48" height="6" rx="3" fill={colors.surfaceAlt} />
          <Rect x="102" y="170" width="36" height="14" rx="7" fill={colors.success} />
        </G>
        {/* sound waves */}
        <Path d="M176 70c10 8 10 26 0 34" stroke={colors.primary} strokeWidth="4" fill="none" strokeLinecap="round" />
        <Path
          d="M188 60c18 14 18 40 0 54"
          stroke={colors.primary}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        <Path d="M64 70c-10 8-10 26 0 34" stroke={colors.success} strokeWidth="4" fill="none" strokeLinecap="round" />
        <Circle cx="44" cy="46" r="6" fill={colors.primary} opacity="0.5" />
        <Circle cx="206" cy="160" r="8" fill={colors.success} opacity="0.35" />
        {/* floating card */}
        <Rect
          x="50"
          y="92"
          width="100"
          height="40"
          rx="8"
          fill={colors.white}
          stroke={colors.success}
          strokeWidth="2"
        />
        {badgeText ? (
          <SvgText x="100" y="117" fontSize="13" fontWeight="bold" fill={colors.success} textAnchor="middle">
            {badgeText}
          </SvgText>
        ) : null}
      </Svg>
      {!badgeText ? (
        <View
          style={[
            styles.iconSlot,
            { left: (50 / 240) * w, top: (92 / 216) * h, width: (100 / 240) * w, height: (40 / 216) * h },
          ]}>
          <Icon name={icon} size={22} color={colors.success} />
        </View>
      ) : null}
    </View>
  );
};

PhoneIllustration.propTypes = {
  badgeText: PropTypes.string,
  icon: PropTypes.string,
  size: PropTypes.number,
};

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  iconSlot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});

export default PhoneIllustration;
