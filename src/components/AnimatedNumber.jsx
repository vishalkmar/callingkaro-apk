import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AppText } from '@components/common';

/** Counts up/down to `value` (balance animation). */
const AnimatedNumber = ({ value, duration = 700, format = v => String(v), ...textProps }) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) {
      return undefined;
    }
    const t0 = Date.now();
    let raf;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        from.current = value;
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);

  return <AppText {...textProps}>{format(shown)}</AppText>;
};

AnimatedNumber.propTypes = { value: PropTypes.number.isRequired, duration: PropTypes.number, format: PropTypes.func };

export default AnimatedNumber;
