import { useReturnToPrevious } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import React, { useMemo } from 'react';

export interface OpenInExploreLogsButtonProps {
  datasourceUid?: string;
  labelMatchers: Array<{ name: string; value: string }>;
  from?: string;
  to?: string;
  returnToPreviousSource?: string;
}

export default function OpenInExploreLogsButton({
  datasourceUid,
  labelMatchers,
  from,
  to,
  returnToPreviousSource,
}: OpenInExploreLogsButtonProps) {
  const setReturnToPrevious = useReturnToPrevious();

  const href = useMemo(() => {
    const mainLabel = labelMatchers[0];

    if (!mainLabel) {
      return null;
    }

    const url = new URL(
      `${window.location.origin}/a/grafana-lokiexplore-app/explore/${mainLabel.name}/${mainLabel.value}/logs`
    );

    datasourceUid && url.searchParams.set('var-datasource', datasourceUid);
    from && url.searchParams.set('from', from);
    to && url.searchParams.set('to', to);

    labelMatchers.forEach((labelMatcher) => {
      url.searchParams.append('var-filters', `${labelMatcher.name}|=|${labelMatcher.value}`);
    });

    return url.toString();
  }, [datasourceUid, from, to, labelMatchers]);

  if (!href) {
    return null;
  }

  return (
    <LinkButton
      variant="secondary"
      href={href}
      onMouseDown={() => setReturnToPrevious(returnToPreviousSource || 'previous')}
    >
      Open in Explore logs
    </LinkButton>
  );
}
