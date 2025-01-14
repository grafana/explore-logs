// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!
import { PluginExtensionLinkConfig, PluginExtensionPanelContext, PluginExtensionPoints } from '@grafana/data';

import { SERVICE_NAME, VAR_DATASOURCE, VAR_FIELDS, VAR_LABELS, VAR_LINE_FILTERS } from 'services/variables';
import pluginJson from '../../plugin.json';
import { LabelType } from '../fieldsTypes';
import { getMatcherFromQuery } from '../logqlMatchers';
import { LokiQuery } from '../lokiQuery';
import { FilterOp } from '../filterTypes';
// import { sceneUtils } from '@grafana/scenes';

const title = 'Open in Explore Logs';
const description = 'Open current query in the Explore Logs view';
const icon = 'gf-logs';

export const ExtensionPoints = {
  MetricExploration: 'grafana-lokiexplore-app/metric-exploration/v1',
} as const;

// `plugin.addLink` requires these types; unfortunately, the correct `PluginExtensionAddedLinkConfig` type is not exported with 11.2.x
// TODO: fix this type when we move to `@grafana/data` 11.3.x
export const linkConfigs: Array<
  {
    targets: string | string[];
    // eslint-disable-next-line deprecation/deprecation
  } & Omit<PluginExtensionLinkConfig<PluginExtensionPanelContext>, 'type' | 'extensionPointId'>
> = [
  {
    targets: PluginExtensionPoints.DashboardPanelMenu,
    title,
    description,
    icon,
    path: createAppUrl(),
    configure: contextToLink,
  },
  {
    targets: PluginExtensionPoints.ExploreToolbarAction,
    title,
    description,
    icon,
    path: createAppUrl(),
    configure: contextToLink,
  },
];

function contextToLink<T extends PluginExtensionPanelContext>(context?: T) {
  if (!context) {
    return undefined;
  }
  const lokiQuery = context.targets.find((target) => target.datasource?.type === 'loki') as LokiQuery | undefined;
  if (!lokiQuery || !lokiQuery.datasource?.uid) {
    return undefined;
  }

  const expr = lokiQuery.expr;
  const { labelFilters: labelFilters, lineFilters } = getMatcherFromQuery(expr);

  const labelSelector = labelFilters.find((selector) => selector.operator === FilterOp.Equal);

  if (!labelSelector) {
    return undefined;
  }

  const labelValue = replaceSlash(labelSelector.value);
  let labelName = labelSelector.key === SERVICE_NAME ? 'service' : labelSelector.key;
  // sort `primary label` first
  labelFilters.sort((a) => (a.key === labelName ? -1 : 1));

  let params = setUrlParameter(UrlParameters.DatasourceId, lokiQuery.datasource?.uid, new URLSearchParams());
  params = setUrlParameter(UrlParameters.TimeRangeFrom, context.timeRange.from.valueOf().toString(), params);
  params = setUrlParameter(UrlParameters.TimeRangeTo, context.timeRange.to.valueOf().toString(), params);

  for (const labelFilter of labelFilters) {
    // skip non-indexed filters for now
    if (labelFilter.type !== LabelType.Indexed) {
      continue;
    }

    params = appendUrlParameter(
      UrlParameters.Labels,
      `${labelFilter.key}|${labelFilter.operator}|${labelFilter.value}`,
      params
    );
  }

  if (lineFilters) {
    for (const lineFilter of lineFilters) {
      params = appendUrlParameter(
        UrlParameters.LineFilters,
        `${lineFilter.key}|${escapeURLDelimiters(lineFilter.operator)}|${escapeURLDelimiters(lineFilter.value)}`,
        params
      );
    }
  }

  return {
    path: createAppUrl(`/explore/${labelName}/${labelValue}/logs`, params),
  };
}

export function createAppUrl(path = '/explore', urlParams?: URLSearchParams): string {
  return `/a/${pluginJson.id}${path}${urlParams ? `?${urlParams.toString()}` : ''}`;
}

export const UrlParameters = {
  DatasourceId: `var-${VAR_DATASOURCE}`,
  TimeRangeFrom: 'from',
  TimeRangeTo: 'to',
  Labels: `var-${VAR_LABELS}`,
  Fields: `var-${VAR_FIELDS}`,
  LineFilters: `var-${VAR_LINE_FILTERS}`,
} as const;
export type UrlParameterType = (typeof UrlParameters)[keyof typeof UrlParameters];

export function setUrlParameter(key: UrlParameterType, value: string, initalParams?: URLSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.set(key, value);

  return searchParams;
}

export function appendUrlParameter(
  key: UrlParameterType,
  value: string,
  initalParams?: URLSearchParams
): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.append(key, value);

  return searchParams;
}

export function replaceSlash(parameter: string): string {
  return parameter.replace(/\//g, '-');
}

// Manually copied over from @grafana/scenes so we don't need to import scenes to build links
function escapeUrlCommaDelimiters(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Replace the comma due to using it as a value/label separator
  return /,/g[Symbol.replace](value, '__gfc__');
}

function escapeUrlPipeDelimiters(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Replace the pipe due to using it as a filter separator
  return (value = /\|/g[Symbol.replace](value, '__gfp__'));
}

function escapeURLDelimiters(value: string | undefined): string {
  return escapeUrlCommaDelimiters(escapeUrlPipeDelimiters(value));
}
