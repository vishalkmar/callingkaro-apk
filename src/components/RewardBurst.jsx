import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { AppText, Icon } from '@components/common';
import { colors, spacing, radius } from '@theme';
import { haptic } from '@services/audio/tones';

const CONFETTI = colors.palette;

/** "+250 credits" success animation with simple confetti. Auto-hides after `duration`. */
const RewardBurst = ({ visible, title, subtitle, onHide, duration = 1800 }) => {
  const scale = useRef(new Animated.Value(0.6)).current;
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    haptic(40);
    scale.setValue(0.6);
    fall.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: 1400, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onHide, duration);
    return () => clearTimeout(t);
  }, [visible, duration, onHide, scale, fall]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onHide}>
      <View style={styles.backdrop} accessibilityLiveRegion="assertive">
        {CONFETTI.flatMap((c, i) =>
          [0, 1, 2].map(j => (
            <Animated.View
              key={`${i}-${j}`}
              style={[
                styles.piece,
                {
                  backgroundColor: c,
                  left: `${10 + (((i * 3 + j) * 37) % 80)}%`,
                  transform: [
                    { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-40, 420 + j * 60] }) },
                    { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i + 1) * 120}deg`] }) },
                  ],
                },
              ]}
            />
          )),
        )}
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Icon name="party-popper" size={48} color={colors.primary} />
          <AppText variant="header" color="primary" center style={styles.title}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText color="subtext" center>
              {subtitle}
            </AppText>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
};

RewardBurst.propTypes = {
  visible: PropTypes.bool.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  onHide: PropTypes.func.isRequired,
  duration: PropTypes.number,
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', top: 0, width: 10, height: 16, borderRadius: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 240,
  },
  title: { marginTop: spacing.sm },
});

export default RewardBurst;
