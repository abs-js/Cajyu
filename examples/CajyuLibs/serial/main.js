export const CajyuLib = {
  print: (...args) => console.log(...args),
  log: (level, ...args) => {
    const levels = { info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG' };
    const tag = levels[level] || 'LOG';
    console.log(`[${tag}]`, ...args);
  },
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  clear: () => console.clear(),
  time: (label) => console.time(label),
  timeEnd: (label) => console.timeEnd(label)
};
