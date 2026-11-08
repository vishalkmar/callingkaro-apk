import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Sound from 'react-native-sound';
import PropTypes from 'prop-types';
import { AppText, Icon } from '@components/common';
import { colors, spacing, radius } from '@theme';
import { formatDuration } from '@utils/format';

/** Play / pause + seek bar for a local recording file. Only one player plays at a time. */
let current = null; // { sound, stop } of the player that is playing now

const RecordingPlayer = ({ filePath, durationSec = 0, compact = false }) => {
  const sound = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(durationSec);
  const [error, setError] = useState(null);
  const barWidth = useRef(1);

  useEffect(() => {
    const s = new Sound(filePath, '', e => {
      if (e) {
        setError('Could not open this recording');
      } else {
        setDur(Math.round(s.getDuration()) || durationSec);
      }
    });
    sound.current = s;
    return () => {
      s.stop();
      s.release();
      if (current?.sound === s) {
        current = null;
      }
    };
  }, [filePath, durationSec]);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    const id = setInterval(() => sound.current?.getCurrentTime(t => setPos(t)), 250);
    return () => clearInterval(id);
  }, [playing]);

  const toggle = () => {
    const s = sound.current;
    if (!s || error) {
      return;
    }
    if (playing) {
      s.pause();
      setPlaying(false);
      return;
    }
    if (current && current.sound !== s) {
      current.stop(); // pauses the other player AND resets its play button
    }
    current = {
      sound: s,
      stop: () => {
        s.pause();
        setPlaying(false);
      },
    };
    setPlaying(true);
    s.play(() => {
      if (current?.sound === s) {
        current = null;
      }
      setPlaying(false);
      setPos(0);
      s.setCurrentTime(0);
    });
  };

  const seekTo = seconds => {
    if (!dur) {
      return;
    }
    const t = Math.max(0, Math.min(dur, seconds));
    sound.current?.setCurrentTime(t);
    setPos(t);
  };
  const seek = x => seekTo((x / barWidth.current) * dur);

  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }}
        onPress={toggle}
        style={styles.play}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause recording' : 'Play recording'}
        disabled={!!error}>
        <Icon name={playing ? 'pause' : 'play'} size={26} color={colors.white} />
      </Pressable>
      <View style={styles.body}>
        {error ? (
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
        ) : (
          <>
            <View
              style={styles.track}
              onLayout={e => {
                barWidth.current = e.nativeEvent.layout.width || 1;
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={e => seek(e.nativeEvent.locationX)}
              onResponderMove={e => seek(e.nativeEvent.locationX)}
              accessibilityRole="adjustable"
              accessibilityLabel="Seek"
              accessibilityValue={{ min: 0, max: Math.round(dur), now: Math.round(pos) }}
              // TalkBack: swipe up / down jumps 5 seconds
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={e => seekTo(pos + (e.nativeEvent.actionName === 'increment' ? 5 : -5))}>
              <View style={styles.rail} />
              <View style={[styles.fill, { width: `${pct}%` }]} />
              <View style={[styles.thumb, { left: `${pct}%` }]} />
            </View>
            <View style={styles.times}>
              <AppText variant="caption" color="subtext">
                {formatDuration(pos)}
              </AppText>
              <AppText variant="caption" color="subtext">
                {formatDuration(dur)}
              </AppText>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

RecordingPlayer.propTypes = {
  filePath: PropTypes.string.isRequired,
  durationSec: PropTypes.number,
  compact: PropTypes.bool,
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  compact: { padding: spacing.xs, backgroundColor: 'transparent' },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.sm },
  track: { height: 24, justifyContent: 'center' },
  rail: { height: 4, borderRadius: 2, backgroundColor: colors.divider },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.primary },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
});

export default RecordingPlayer;
