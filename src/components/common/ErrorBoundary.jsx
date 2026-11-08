import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { colors, spacing } from '@theme';
import logger from '@utils/logger';
import { t } from '@i18n';
import AppText from './AppText';
import AppButton from './AppButton';
import Icon from './Icon';

// Error boundaries must be class components (the only class component allowed in the app).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logger.error('ErrorBoundary caught', error?.message, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <View style={styles.wrap}>
        <Icon name="alert-circle-outline" size={56} color={colors.danger} />
        <AppText variant="title" center style={styles.title}>
          {t('crash.title')}
        </AppText>
        <AppText color="subtext" center style={styles.msg}>
          {t('crash.body')}
        </AppText>
        {__DEV__ ? (
          <AppText variant="caption" color="danger" center style={styles.msg}>
            {String(this.state.error?.message || this.state.error)}
          </AppText>
        ) : null}
        <AppButton title={t('crash.retry')} onPress={this.reset} fullWidth={false} style={styles.btn} />
      </View>
    );
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node };

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { marginTop: spacing.md },
  msg: { marginTop: spacing.xs },
  btn: { marginTop: spacing.xl, paddingHorizontal: spacing.xxl },
});

export default ErrorBoundary;
