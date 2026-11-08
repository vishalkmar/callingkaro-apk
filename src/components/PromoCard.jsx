import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PropTypes from 'prop-types';
import { AppText, Icon } from '@components/common';
import { colors, spacing, radius } from '@theme';
import { STORAGE_KEYS } from '@constants/config';

const HIDE_FOR_MS = 3 * 24 * 3600 * 1000;

/** Small dismissible promo (replaces the blocking popup of Image 6). Comes back after 3 days. */
const PromoCard = ({ title, body, icon = 'gift-outline', onPress }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.PROMO_DISMISSED_AT).then(v => {
      setVisible(!v || Date.now() - Number(v) > HIDE_FOR_MS);
    });
  }, []);

  if (!visible) {
    return null;
  }
  return (
    <Pressable android_ripple={{ color: colors.surfaceAlt }}
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.text}>
        <AppText variant="label" bold>
          {title}
        </AppText>
        <AppText variant="caption" color="subtext">
          {body}
        </AppText>
      </View>
      <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }}
        hitSlop={10}
        style={styles.close}
        onPress={() => {
          setVisible(false);
          AsyncStorage.setItem(STORAGE_KEYS.PROMO_DISMISSED_AT, String(Date.now()));
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss">
        <Icon name="close" size={18} color={colors.subtext} />
      </Pressable>
    </Pressable>
  );
};

PromoCard.propTypes = {
  title: PropTypes.string.isRequired,
  body: PropTypes.string,
  icon: PropTypes.string,
  onPress: PropTypes.func,
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, marginLeft: spacing.sm },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});

export default PromoCard;
