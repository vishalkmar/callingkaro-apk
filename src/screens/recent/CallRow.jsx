import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import PropTypes from 'prop-types';
import { AppText, CallButton, Icon, ListItem } from '@components/common';
import { colors, spacing } from '@theme';
import { formatDuration, formatNumber, formatTime, formatPhone } from '@utils/format';
import { statusInfo, isMissed } from './callStatus';

const DeleteAction = () => (
  <View style={styles.delete}>
    <Icon name="delete-outline" color={colors.white} />
    <AppText color="white" variant="caption">
      Delete
    </AppText>
  </View>
);

/** Image 6 row: avatar, name/number, status icon + time + "2:15 - 2,250 cr", round call-back button. Swipe left to delete. */
const CallRow = ({ log, onPress, onCallBack, onDelete }) => {
  const ref = useRef(null);
  const info = statusInfo(log.status);
  const title = log.contactName || formatPhone(log.number);
  const meta = [formatTime(log.startedAt)];
  if (log.talkSeconds > 0) {
    meta.push(`${formatDuration(log.talkSeconds)} - ${formatNumber(log.creditsUsed)} cr`);
  } else {
    meta.push(info.label);
  }

  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={80}
      renderRightActions={DeleteAction}
      onSwipeableOpen={() => {
        ref.current?.close();
        onDelete(log);
      }}>
      <ListItem
        title={title}
        avatarName={log.contactName}
        onPress={() => onPress(log)}
        subtitleNode={
          <View style={styles.meta}>
            <Icon name={info.icon} size={14} color={info.color} />
            <AppText
              variant="caption"
              style={[styles.metaText, isMissed(log.status) && styles.missed]}
              numberOfLines={1}>
              {meta.join('  ')}
            </AppText>
            {log.hasRecording ? <Icon name="record-rec" size={14} color={colors.danger} /> : null}
          </View>
        }
        right={<CallButton onPress={() => onCallBack(log)} accessibilityLabel={`Call back ${title}`} />}
        accessibilityLabel={`${title}, ${info.label}, ${meta.join(', ')}`}
      />
    </Swipeable>
  );
};

CallRow.propTypes = {
  log: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
  onCallBack: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { marginLeft: spacing.xxs, marginRight: spacing.xxs, color: colors.subtext, flexShrink: 1 },
  missed: { color: colors.dangerText },
  delete: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
  },
});

export default React.memo(CallRow);
