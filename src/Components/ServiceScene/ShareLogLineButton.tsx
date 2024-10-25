import { ClipboardButton } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import React from 'react';
import { TimeRange } from '@grafana/data';

export enum UrlParameterType {
  SelectedLine = 'selectedLine',
  From = 'from',
  To = 'to',
}

interface Props {
  className?: string;
  logId: string;
  metadata: Record<string, string | number>;
  timeRange: TimeRange;
}

export const ShareLogLineButton = ({ className, logId, metadata, timeRange }: Props) => {
  return (
    <ClipboardButton
      className={className}
      icon="share-alt"
      variant="secondary"
      fill="text"
      size="md"
      tooltip="Copy link to log line"
      tooltipPlacement="top"
      tabIndex={0}
      getText={() => {
        const location = locationService.getLocation();
        const searchParams = new URLSearchParams(location.search);
        if (searchParams && timeRange) {
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
      }}
    />
  );
};
