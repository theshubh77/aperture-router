/**
 * Minimalist zero-dependency structured logger
 */
const LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};

const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LEVELS.INFO;

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export const logger = {
  debug(msg, meta = {}) {
    if (CURRENT_LEVEL <= LEVELS.DEBUG) {
      console.log(`[${formatTimestamp()}] [DEBUG] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    }
  },
  info(msg, meta = {}) {
    if (CURRENT_LEVEL <= LEVELS.INFO) {
      console.log(`[${formatTimestamp()}] [INFO]  ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    }
  },
  warn(msg, meta = {}) {
    if (CURRENT_LEVEL <= LEVELS.WARN) {
      console.warn(`[${formatTimestamp()}] [WARN]  ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    }
  },
  error(msg, err = null) {
    if (CURRENT_LEVEL <= LEVELS.ERROR) {
      console.error(`[${formatTimestamp()}] [ERROR] ${msg}`, err?.stack || err || '');
    }
  }
};
