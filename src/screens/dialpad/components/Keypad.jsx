import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { T9_LETTERS } from '@utils/t9';
import DialKey from './DialKey';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

/** 3x4 keypad. Rows flex so the grid shrinks on small screens and never overflows. */
const Keypad = ({ onKey, onLongKey, color, compact }) => (
  <View style={styles.grid}>
    {ROWS.map(row => (
      <View key={row.join('')} style={styles.row}>
        {row.map(d => (
          <DialKey
            key={d}
            digit={d}
            letters={T9_LETTERS[d]}
            onPress={onKey}
            onLongPress={onLongKey}
            color={color}
            compact={compact}
          />
        ))}
      </View>
    ))}
  </View>
);

Keypad.propTypes = {
  onKey: PropTypes.func.isRequired,
  onLongKey: PropTypes.func,
  color: PropTypes.string,
  compact: PropTypes.bool,
};

const styles = StyleSheet.create({
  grid: { flexShrink: 1 },
  row: { flexDirection: 'row', flex: 1, maxHeight: 76, minHeight: 52 },
});

export default React.memo(Keypad);
