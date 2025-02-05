import { config, useReturnToPrevious } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import React, { useMemo } from 'react';
import { replaceSlash } from 'services/extensions/links';
import { OpenInExploreLogsButtonProps } from './types';

export default function OpenInExploreLogsButton({
  datasourceUid,
  labelMatchers,
  from,
  to,
  returnToPreviousSource,
  renderButton,
}: OpenInExploreLogsButtonProps) {
  const setReturnToPrevious = useReturnToPrevious();

  const href = useMemo(() => {
    const mainLabel = labelMatchers[0];

    if (!mainLabel) {
      return null;
    }

    const url = new URL(
      `${config.appSubUrl || config.appUrl}a/grafana-lokiexplore-app/explore/${mainLabel.name}/${mainLabel.value}/logs`
    );

    datasourceUid && url.searchParams.set('var-datasource', datasourceUid);
    from && url.searchParams.set('from', from);
    to && url.searchParams.set('to', to);

    labelMatchers.forEach((labelMatcher) => {
      url.searchParams.append('var-filters', `${labelMatcher.name}|=|${replaceSlash(labelMatcher.value)}`);
    });

    return url.toString();
  }, [datasourceUid, from, to, labelMatchers]);

  if (!href) {
    return null;
  }

  if (renderButton) {
    return renderButton({ href });
  }

  return (
    <LinkButton
      variant="secondary"
      href={href}
      onClick={() => setReturnToPrevious(returnToPreviousSource || 'previous')}
    >
      Open in Explore logs
    </LinkButton>
  );
}
