import { locationService } from '@grafana/runtime';
import { logger } from './logger';
import { dateTime, LogRowModel, TimeRange } from '@grafana/data';

export const copyText = async (
  text: string,
  buttonRef?: React.MutableRefObject<HTMLButtonElement | null> | HTMLButtonElement
) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
    // eslint-disable-next-line deprecation/deprecation
  } else if (document.execCommand && buttonRef) {
    // Use a fallback method for browsers/contexts that don't support the Clipboard API.
    // See https://web.dev/async-clipboard/#feature-detection.
    // Use textarea so the user can copy multi-line content.
    const textarea = document.createElement('textarea');
    // Normally we'd append this to the body. However if we're inside a focus manager
    // from react-aria, we can't focus anything outside of the managed area.
    // Instead, let's append it to the button. Then we're guaranteed to be able to focus + copy.
    const buttonElement = buttonRef instanceof HTMLButtonElement ? buttonRef : buttonRef?.current;
    buttonElement?.appendChild(textarea);
    textarea.value = text;
    textarea.focus();
    textarea.select();
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand('copy');
    textarea.remove();
  }
};

export enum UrlParameterType {
  From = 'from',
  To = 'to',
}

type PermalinkDataType =
  | {
      id?: string;
      row?: number;
    }
  | {
      logs: {
        id: string;
        displayedFields: string[];
      };
    };

export const generateLogShortlink = (paramName: string, data: PermalinkDataType, timeRange: TimeRange) => {
  const location = locationService.getLocation();
  const searchParams = new URLSearchParams(location.search);

  searchParams.set(UrlParameterType.From, timeRange.from.toISOString());
  searchParams.set(UrlParameterType.To, timeRange.to.toISOString());
  searchParams.set(paramName, JSON.stringify(data));

  // @todo can encoding + as %20 break other stuff? Can label names or values have + in them that we don't want encoded? Should we just update values?
  // + encoding for whitespace is for application/x-www-form-urlencoded, which appears to be the default encoding for URLSearchParams, replacing + with %20 to keep urls meant for the browser from breaking
  const searchString = searchParams.toString().replace(/\+/g, '%20');
  return window.location.origin + location.pathname + '?' + searchString;
};

export function capitalizeFirstLetter(input: string) {
  if (input.length) {
    return input?.charAt(0).toUpperCase() + input.slice(1);
  }

  logger.warn('invalid string argument');
  return input;
}

export function truncateText(input: string, length: number, ellipsis: boolean) {
  return input.substring(0, length) + (ellipsis && input.length > length ? '…' : '');
}

export function resolveRowTimeRangeForSharing(row: LogRowModel): TimeRange {
  // With infinite scrolling, we cannot rely on the time picker range, so we use a time range around the shared log line.
  const from = dateTime(row.timeEpochMs - 1);
  const to = dateTime(row.timeEpochMs + 1);

  const range = {
    from,
    to,
    raw: {
      from,
      to,
    },
  };

  return range;
}
