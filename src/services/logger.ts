import { LogContext } from '@grafana/faro-web-sdk';
import { FetchError, logError, logInfo, logWarning } from '@grafana/runtime';
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

const isRecord = (obj: unknown): obj is Record<string, unknown> => typeof obj === 'object';
/**
 * Checks unknown error for properties from Records like FetchError and adds them to the context
 * @param err
 * @param context
 */
function populateFetchErrorContext(err: unknown | FetchError, context: LogContext) {
  if (typeof err === 'object' && err !== null) {
    if (isRecord(err)) {
      Object.keys(err).forEach((key: string) => {
        const value = err[key];
        if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
          context[key] = value.toString();
        }
      });
    }

    if (hasData(err)) {
      if (typeof err.data === 'object' && err.data !== null) {
        try {
          context.data = JSON.stringify(err.data);
        } catch (e) {
          // do nothing
        }
      } else if (typeof err.data === 'string' || typeof err.data === 'boolean' || typeof err.data === 'number') {
        context.data = err.data.toString();
      }
    }
  }
}

const attemptFaroErr = (err: Error | FetchError | unknown, context2: LogContext) => {
  let context = context2;
  try {
    populateFetchErrorContext(err, context);

    if (err instanceof Error) {
      logError(err, context);
    } else if (typeof err === 'string') {
      logError(new Error(err), context);
    } else if (err && typeof err === 'object') {
      if (context.msg) {
        logError(new Error(context.msg), context);
      } else {
        logError(new Error('error object'), context);
      }
    } else {
      logError(new Error('unknown error'), context);
    }
  } catch (e) {
    console.error('Failed to log faro error!', { err, context });
  }
};

const hasData = (value: object): value is { data: unknown } => {
  return 'data' in value;
};
