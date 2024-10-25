import { locationService } from '@grafana/runtime';
import { logger } from './logger';
import { TimeRange } from '@grafana/data';

export const copyText = async (text: string, buttonRef: React.MutableRefObject<HTMLButtonElement | null>) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
    // eslint-disable-next-line deprecation/deprecation
  } else if (document.execCommand) {
    // Use a fallback method for browsers/contexts that don't support the Clipboard API.
    // See https://web.dev/async-clipboard/#feature-detection.
    // Use textarea so the user can copy multi-line content.
    const textarea = document.createElement('textarea');
    // Normally we'd append this to the body. However if we're inside a focus manager
    // from react-aria, we can't focus anything outside of the managed area.
    // Instead, let's append it to the button. Then we're guaranteed to be able to focus + copy.
    buttonRef.current?.appendChild(textarea);
    textarea.value = text;
    textarea.focus();
    textarea.select();
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand('copy');
    textarea.remove();
  }
};

export enum UrlParameterType {
  SelectedLine = 'selectedLine',
  From = 'from',
  To = 'to',
}

export const generateLogShortlink = (logId: string, timeRange: TimeRange, metadata: Record<string, string | number> = {}) => {
  const location = locationService.getLocation();
  const searchParams = new URLSearchParams(location.search);
  if (searchParams) {
    const selectedLine = {
      id: logId,
      ...metadata,
    };

    searchParams.set(UrlParameterType.From, timeRange.from.toISOString());
    searchParams.set(UrlParameterType.To, timeRange.to.toISOString());
    searchParams.set(UrlParameterType.SelectedLine, JSON.stringify(selectedLine));

    // @todo can encoding + as %20 break other stuff? Can label names or values have + in them that we don't want encoded? Should we just update values?
    // + encoding for whitespace is for application/x-www-form-urlencoded, which appears to be the default encoding for URLSearchParams, replacing + with %20 to keep urls meant for the browser from breaking
    const searchString = searchParams.toString().replace(/\+/g, '%20');
    return window.location.origin + location.pathname + '?' + searchString;
  }
  return '';
}

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
