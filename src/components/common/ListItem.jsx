import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing, TOUCH_TARGET } from '@theme';
import AppText from './AppText';
import Avatar from './Avatar';
import Icon from './Icon';

export const ROW_HEIGHT = 64;

/** Round call-back / call button used on the right of rows (Image 6). */
export const CallButton = ({ onPress, color = colors.success, accessibilityLabel = 'Call' }) => (
  <Pressable
    onPress={onPress}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    android_ripple={{ color: colors.successSoft, borderless: true }}
    style={({ pressed }) => [styles.callBtn, { borderColor: color }, pressed && { opacity: 0.6 }]}>
    <Icon name="phone" size={20} color={color} />
  </Pressable>
);

CallButton.propTypes = {
  onPress: PropTypes.func,
  color: PropTypes.string,
  accessibilityLabel: PropTypes.string,
};

const ListItem = ({
  title,
  subtitle,
  subtitleNode,
  avatarName,
  avatarUri,
  showAvatar = true,
  left,
  right,
  onPress,
  onLongPress,
  divider = true,
  style,
  accessibilityLabel,
  testID,
}) => (
  <Pressable
    testID={testID}
    onPress={onPress}
    onLongPress={onLongPress}
    disabled={!onPress && !onLongPress}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={accessibilityLabel || [title, subtitle].filter(Boolean).join(', ')}
    android_ripple={{ color: colors.surfaceAlt }}
    style={[styles.row, style]}>
    {left || (showAvatar ? <Avatar name={avatarName ?? title} uri={avatarUri} size={40} /> : null)}
    <View style={[styles.body, divider && styles.divider]}>
      <View style={styles.texts}>
        <AppText variant="label" numberOfLines={1}>
          {title}
        </AppText>
        {subtitleNode ||
          (subtitle ? (
            <AppText variant="caption" color="subtext" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null)}
      </View>
      {right}
    </View>
  </Pressable>
);

ListItem.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  subtitleNode: PropTypes.node,
  avatarName: PropTypes.string,
  avatarUri: PropTypes.string,
  showAvatar: PropTypes.bool,
  left: PropTypes.node,
  right: PropTypes.node,
  onPress: PropTypes.func,
  onLongPress: PropTypes.func,
  divider: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  accessibilityLabel: PropTypes.string,
  testID: PropTypes.string,
};

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    paddingRight: spacing.md,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  texts: { flex: 1 },
  callBtn: {
    width: 40,
    height: 40,
    minWidth: TOUCH_TARGET - 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(ListItem);
