import React, { useState } from 'react';
import { View, Pressable, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { colors, spacing, radius, typography, TOUCH_TARGET } from '@theme';
import AppText from './AppText';
import Icon from './Icon';
import AppLogo from './AppLogo';

/** Orange app bar (Image 4): logo + title on the left, optional back arrow, 3-dot overflow menu. */
const AppHeader = ({ title, onBack, menuItems, right, showLogo = true }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          android_ripple={{ color: colors.primaryDark, borderless: true }}>
          <Icon name="arrow-left" color={colors.white} />
        </Pressable>
      ) : showLogo ? (
        <AppLogo size={26} style={styles.logo} />
      ) : null}
      <AppText variant="title" color="white" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {right}
      {menuItems && menuItems.length ? (
        <Pressable
          testID="header-overflow"
          onPress={() => setMenuOpen(true)}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="More options"
          android_ripple={{ color: colors.primaryDark, borderless: true }}>
          <Icon name="dots-vertical" color={colors.white} />
        </Pressable>
      ) : null}

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
          <View style={[styles.menu, { top: insets.top + spacing.xs }]}>
            {(menuItems || []).map(item => (
              <Pressable
                key={item.label}
                style={styles.menuItem}
                android_ripple={{ color: colors.surfaceAlt }}
                accessibilityRole="menuitem"
                onPress={() => {
                  setMenuOpen(false);
                  setTimeout(item.onPress, 150);
                }}>
                {item.icon ? (
                  <Icon
                    name={item.icon}
                    size={20}
                    color={item.danger ? colors.danger : colors.subtext}
                    style={styles.menuIcon}
                  />
                ) : null}
                <AppText color={item.danger ? 'danger' : 'text'}>{item.label}</AppText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

AppHeader.propTypes = {
  title: PropTypes.string,
  onBack: PropTypes.func,
  showLogo: PropTypes.bool,
  right: PropTypes.node,
  menuItems: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onPress: PropTypes.func.isRequired,
      icon: PropTypes.string,
      danger: PropTypes.bool,
    }),
  ),
};

const styles = StyleSheet.create({
  bar: {
    height: 56,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxs,
  },
  logo: { marginHorizontal: spacing.sm },
  title: { flex: 1, ...typography.title, marginLeft: spacing.xxs },
  iconBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    right: spacing.xs,
    minWidth: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.xxs,
    elevation: 8,
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  menuItem: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: { marginRight: spacing.sm },
});

export default AppHeader;
