import { LogContext } from '@grafana/faro-web-sdk';
import { logError, logInfo, logWarning } from '@grafana/runtime';

export const logger = {
  info: (msg: string, context?: LogContext) => {
    console.log(msg, context);
    attemptFaroInfo(msg, context);
  },
  warn: (msg: string, context?: LogContext) => {
    console.warn(msg, context);
    attemptFaroWarn(msg, context);
  },
  error: (err: Error | unknown, context?: LogContext) => {
    console.error(err, context);
    attemptFaroErr(err, context);
  },
};

const attemptFaroInfo = (msg: string, context?: LogContext) => {
  try {
    logInfo(msg, context);
  } catch (e) {
    console.warn('Failed to log faro event!');
  }
};

const attemptFaroWarn = (msg: string, context?: LogContext) => {
  try {
    logWarning(msg, context);
  } catch (e) {
    console.warn('Failed to log faro warning!', { msg, context });
  }
};

const attemptFaroErr = (err: Error | unknown, context?: LogContext) => {
  try {
    if (err instanceof Error) {
      logError(err, context);
    } else {
      logError(new Error('unknown error'), { ...context, rawError: JSON.stringify(err) });
    }
  } catch (e) {
    console.error('Failed to log faro error!', { err, context });
  }
};
