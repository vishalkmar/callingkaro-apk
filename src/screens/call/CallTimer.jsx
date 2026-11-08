import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { AppText } from '@components/common';
import { formatTimer } from '@utils/format';

/** Re-renders only itself every second (the rest of the InCall screen stays still). */
const CallTimer = ({ since, style }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <AppText style={style} accessibilityRole="timer">
      {formatTimer((now - since) / 1000)}
    </AppText>
  );
};

CallTimer.propTypes = { since: PropTypes.number.isRequired, style: PropTypes.any };

export default React.memo(CallTimer);
