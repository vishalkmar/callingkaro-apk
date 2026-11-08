import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors } from '@theme';
import AppText from './AppText';
import Icon from './Icon';

const PALETTE = colors.palette;

export const initialsOf = name => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(p => /^[\p{L}]/u.test(p));
  if (!parts.length) {
    return '';
  }
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const colorFor = name => {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 2147483647;
  }
  return PALETTE[h % PALETTE.length];
};

/** Photo -> initials circle -> grey silhouette (Image 5). */
const Avatar = ({ name, uri, size = 40, style }) => {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[dims, style]} accessibilityIgnoresInvertColors />;
  }
  const initials = initialsOf(name);
  if (initials) {
    return (
      <View style={[styles.center, dims, { backgroundColor: colorFor(name) }, style]}>
        <AppText style={{ fontSize: size * 0.4, color: colors.white, fontWeight: '600' }}>{initials}</AppText>
      </View>
    );
  }
  return (
    <View style={[styles.center, dims, { backgroundColor: colors.placeholderAvatar }, style]}>
      <Icon name="account" size={size * 0.75} color={colors.white} />
    </View>
  );
};

Avatar.propTypes = {
  name: PropTypes.string,
  uri: PropTypes.string,
  size: PropTypes.number,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

export default React.memo(Avatar);
