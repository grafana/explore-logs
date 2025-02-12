import { useReturnToPrevious } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import React, { useMemo } from 'react';
import {
  appendUrlParameter,
  createAppUrl,
  escapeURLDelimiters,
  replaceEscapeChars,
  replaceSlash,
  setUrlParameter,
  stringifyAdHocValues,
  UrlParameters,
} from 'services/extensions/links';
import { OpenInExploreLogsButtonProps } from './types';
import { AbstractLabelOperator } from '@grafana/data';
import { LabelFilterOp } from 'services/filterTypes';

const operatorMap = {
  [AbstractLabelOperator.Equal]: LabelFilterOp.Equal,
  [AbstractLabelOperator.NotEqual]: LabelFilterOp.NotEqual,
  [AbstractLabelOperator.EqualRegEx]: LabelFilterOp.RegexEqual,
  [AbstractLabelOperator.NotEqualRegEx]: LabelFilterOp.RegexNotEqual,
};

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

    if (
      !mainLabel ||
      // we can't open in explore logs if main label matcher is smth different from equal
      mainLabel?.operator !== AbstractLabelOperator.Equal
    ) {
      return null;
    }

    const labelValue = replaceSlash(mainLabel.value);

    let params = new URLSearchParams();

    if (datasourceUid) {
      params = setUrlParameter(UrlParameters.DatasourceId, datasourceUid, params);
    }

    if (from) {
      params = setUrlParameter(UrlParameters.TimeRangeFrom, from, params);
    }

    if (to) {
      params = setUrlParameter(UrlParameters.TimeRangeTo, to, params);
    }

    labelMatchers.forEach((labelMatcher) => {
      params = appendUrlParameter(
        UrlParameters.Labels,
        `${labelMatcher.name}|${operatorMap[labelMatcher.operator]}|${escapeURLDelimiters(
          stringifyAdHocValues(labelMatcher.value)
        )},${escapeURLDelimiters(replaceEscapeChars(labelMatcher.value))}`,
        params
      );
    });

    return createAppUrl(`/explore/${mainLabel.name}/${labelValue}/logs`, params);
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
      Open in Explore Logs
    </LinkButton>
  );
}
