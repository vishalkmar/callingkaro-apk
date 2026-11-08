import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing } from '@theme';
import AppText from './AppText';

export const SECTION_HEADER_HEIGHT = 36;

/** Bold letter with orange underline (Contacts, Image 5). */
const SectionHeader = ({ title, right }) => (
  <View style={styles.wrap} accessibilityRole="header">
    <View style={styles.row}>
      <AppText variant="body" bold style={styles.title}>
        {title}
      </AppText>
      {right}
    </View>
    <View style={styles.line} />
  </View>
);

SectionHeader.propTypes = { title: PropTypes.string.isRequired, right: PropTypes.node };

const styles = StyleSheet.create({
  wrap: {
    height: SECTION_HEADER_HEIGHT,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, paddingBottom: spacing.xxs },
  line: { height: 1, backgroundColor: colors.primary },
});

export default React.memo(SectionHeader);
