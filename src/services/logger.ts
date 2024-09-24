import { LogContext } from '@grafana/faro-web-sdk';
import { logError, logInfo, logWarning } from '@grafana/runtime';
import pluginJson from '../plugin.json';
import packageJson from '../../package.json';

const defaultContext = {
  app: pluginJson.id,
  version: packageJson.version,
};

export const logger = {
  info: (msg: string, context?: LogContext) => {
    const ctx = { ...defaultContext, ...context };
    console.log(msg, ctx);
    attemptFaroInfo(msg, ctx);
  },
  warn: (msg: string, context?: LogContext) => {
    const ctx = { ...defaultContext, ...context };
    console.warn(msg, ctx);
    attemptFaroWarn(msg, ctx);
  },
  error: (err: Error | unknown, context?: LogContext) => {
    const ctx = { ...defaultContext, ...context };
    console.error(err, ctx);
    attemptFaroErr(err, ctx);
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
    } else if (typeof err === 'string') {
      logError(new Error(err), context);
    } else {
      logError(new Error('unknown error'), context);
    }
  } catch (e) {
    console.error('Failed to log faro error!', { err, context });
  }
};
