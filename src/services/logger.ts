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

/**
 * Checks unknown error for properties from FetchError and adds them to the context
 * Property names from the error are prepended with an underscore when added to the error context sent to Faro
 * Note this renames the "message" to "_errorMessage" in hopes of reducing conflicts of future use of that property name
 * @param err
 * @param context
 */
function populateFetchErrorContext(err: unknown | FetchError, context: LogContext) {
  if (typeof err === 'object' && err !== null) {
    if (hasTraceId(err) && typeof err.traceId === 'string') {
      context._traceId = err.traceId;
    }
    if (hasMessage(err) && typeof err.message === 'string') {
      // If we have a conflicting `_errorMessage`, move the original value to `_contextMessage`
      if (context._errorMessage !== undefined) {
        context._contextMessage = context._errorMessage;
      }
      context._errorMessage = err.message;
    }
    // @todo, if the request was cancelled, do we want to log the error?
    if (hasCancelled(err) && typeof err.cancelled === 'boolean' && context.cancelled) {
      context._cancelled = err.cancelled.toString();
    }
    if (hasStatusText(err) && typeof err.statusText === 'string') {
      context._statusText = err.statusText;
    }
    if (hasHandled(err) && typeof err.isHandled === 'boolean') {
      context._isHandled = err.isHandled.toString();
    }
    if (hasData(err)) {
      try {
        context._data = JSON.stringify(err.data);
      } catch (e) {
        // do nothing
      }
    }
  }
}

const attemptFaroErr = (err: Error | FetchError | unknown, context: LogContext) => {
  try {
    populateFetchErrorContext(err, context);

    if (err instanceof Error) {
      logError(err, context);
    } else if (typeof err === 'string') {
      logError(new Error(err), context);
    } else if (err && typeof err === 'object') {
      if (context._errorMessage) {
        logError(new Error(context._errorMessage), context);
      } else {
        logError(new Error('unknown error object'), context);
      }
    } else {
      logError(new Error('unknown error'), context);
    }
  } catch (e) {
    console.error('Failed to log faro error!', { err, context });
  }
};

const hasMessage = (value: object): value is { message: unknown } => {
  return 'message' in value;
};
const hasTraceId = (value: object): value is { traceId: unknown } => {
  return 'traceId' in value;
};
const hasStatusText = (value: object): value is { statusText: unknown } => {
  return 'statusText' in value;
};
const hasCancelled = (value: object): value is { cancelled: unknown } => {
  return 'cancelled' in value;
};
const hasData = (value: object): value is { data: unknown } => {
  return 'data' in value;
};
const hasHandled = (value: object): value is { isHandled: unknown } => {
  return 'isHandled' in value;
};
