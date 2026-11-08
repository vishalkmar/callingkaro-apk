// Logs are silenced in release builds. Never log OTPs, tokens or payment data.
const SENSITIVE = /(otp|token|password|secret|authorization|signature|purchaseToken)/i;

const redact = arg => {
  if (!arg || typeof arg !== 'object') {
    return arg;
  }
  try {
    return JSON.parse(JSON.stringify(arg, (key, value) => (SENSITIVE.test(key) ? '[redacted]' : value)));
  } catch (e) {
    return arg;
  }
};

const make =
  method =>
  (...args) => {
    if (!__DEV__ || process.env.JEST_WORKER_ID) {
      return; // silent in release builds and in unit tests
    }
    console[method]('[CallingKaro]', ...args.map(redact));
  };

const logger = {
  log: make('log'),
  info: make('info'),
  warn: make('warn'),
  error: make('error'),
  scope: tag => ({
    log: (...a) => logger.log(`[${tag}]`, ...a),
    warn: (...a) => logger.warn(`[${tag}]`, ...a),
    error: (...a) => logger.error(`[${tag}]`, ...a),
  }),
};

export default logger;
