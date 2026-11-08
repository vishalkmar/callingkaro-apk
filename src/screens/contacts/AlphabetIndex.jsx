import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { AppText } from '@components/common';
import { colors, spacing, fontSize, FONT_SCALE } from '@theme';

/** A-Z fast scroll on the right edge: touch or drag over a letter to jump to its section. */
const AlphabetIndex = ({ letters, onLetter }) => {
  const viewRef = useRef(null);
  const layout = useRef({ y: 0, h: 1 });
  const last = useRef(null);

  const pick = pageY => {
    const { y, h } = layout.current;
    const idx = Math.max(0, Math.min(letters.length - 1, Math.floor(((pageY - y) / h) * letters.length)));
    const letter = letters[idx];
    if (letter && letter !== last.current) {
      last.current = letter;
      onLetter(letter);
    }
  };

  if (letters.length < 2) {
    return null;
  }

  return (
    <View
      ref={viewRef}
      style={styles.wrap}
      onLayout={() => {
        viewRef.current?.measure((x, y, w, h, px, py) => {
          layout.current = { y: py, h: h || 1 };
        });
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={e => pick(e.nativeEvent.pageY)}
      onResponderMove={e => pick(e.nativeEvent.pageY)}
      onResponderRelease={() => {
        last.current = null;
      }}
      accessibilityRole="adjustable"
      accessibilityLabel="Alphabet index"
      accessibilityValue={{ text: last.current || letters[0] }}
      // TalkBack: swipe up / down moves to the next / previous section.
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => {
        const cur = Math.max(0, letters.indexOf(last.current));
        const next =
          e.nativeEvent.actionName === 'increment' ? Math.min(letters.length - 1, cur + 1) : Math.max(0, cur - 1);
        last.current = letters[next];
        onLetter(letters[next]);
      }}>
      {letters.map(l => (
        <AppText key={l} maxFontSizeMultiplier={FONT_SCALE.fixed} style={styles.letter}>
          {l}
        </AppText>
      ))}
    </View>
  );
};

AlphabetIndex.propTypes = {
  letters: PropTypes.arrayOf(PropTypes.string).isRequired,
  onLetter: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 0,
    top: spacing.xs,
    bottom: spacing.xs,
    width: 24,
    alignItems: 'center',
    justifyContent: 'space-evenly', // linear letter spacing so touch position maps 1:1
  },
  letter: { fontSize: fontSize.micro, lineHeight: 14, fontWeight: '700', color: colors.primaryText },
});

export default AlphabetIndex;
