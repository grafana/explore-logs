import { PluginExtensionLinkConfig, PluginExtensionPanelContext, PluginExtensionPoints } from '@grafana/data';
import { LabelType } from 'services/fields';
import { getMatcherFromQuery } from 'services/logql';

import { LokiQuery } from 'services/query';
import { appendUrlParameter, createAppUrl, setUrlParameter, UrlParameterType } from 'services/routing';

export const linkConfigs: PluginExtensionLinkConfig[] = [
  {
    extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
    title: 'Show in Explore Logs',
    description: 'Open the Explore Logs view with the current query',
    path: createAppUrl(),
    configure: (context?: PluginExtensionPanelContext) => {
      if (!context) {
        return undefined;
      }
      const lokiQuery = context.targets.find((target) => target.datasource?.type === 'loki') as LokiQuery | undefined;
      if (!lokiQuery || !lokiQuery.datasource?.uid) {
        return undefined;
      }

      const expr = lokiQuery.expr;
      const streamSelectors = getMatcherFromQuery(expr);
      const serviceSelector = streamSelectors.find((selector) => selector.key === 'service_name');
      if (!serviceSelector) {
        return undefined;
      }
      const serviceName = serviceSelector.value;
      // sort `service_name` first
      streamSelectors.sort((a, b) => (a.key === 'service_name' ? -1 : 1));

      let params = setUrlParameter(UrlParameterType.DatasourceId, lokiQuery.datasource?.uid);
      params = setUrlParameter(UrlParameterType.TimeRangeFrom, context.timeRange.from.valueOf().toString(), params);
      params = setUrlParameter(UrlParameterType.TimeRangeTo, context.timeRange.to.valueOf().toString(), params);

      for (const streamSelector of streamSelectors) {
        params = appendUrlParameter(
          UrlParameterType.Labels,
          `${streamSelector.key}|${streamSelector.operator}|${streamSelector.value}`,
          params
        );
      }

      return {
        path: createAppUrl(`/explore/service/${serviceName}/logs`, params),
      };
    },
  } as PluginExtensionLinkConfig,
  {
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    title: 'Show in Explore Logs',
    description: 'Open the Explore Logs view with the current query',
    path: createAppUrl(),
    configure: (context?: PluginExtensionPanelContext) => {
      if (!context) {
        return undefined;
      }
      const lokiQuery = context.targets.find((target) => target.datasource?.type === 'loki') as LokiQuery | undefined;
      if (!lokiQuery || !lokiQuery.datasource?.uid) {
        return undefined;
      }

      const expr = lokiQuery.expr;
      const labelFilters = getMatcherFromQuery(expr);
      const serviceSelector = labelFilters.find((selector) => selector.key === 'service_name');
      if (!serviceSelector) {
        return undefined;
      }
      const serviceName = serviceSelector.value;
      // sort `service_name` first
      labelFilters.sort((a, b) => (a.key === 'service_name' ? -1 : 1));

      let params = setUrlParameter(UrlParameterType.DatasourceId, lokiQuery.datasource?.uid);
      params = setUrlParameter(UrlParameterType.TimeRangeFrom, context.timeRange.from.valueOf().toString(), params);
      params = setUrlParameter(UrlParameterType.TimeRangeTo, context.timeRange.to.valueOf().toString(), params);

      for (const labelFilter of labelFilters) {
        if (labelFilter.type === LabelType.Indexed) {
          params = appendUrlParameter(
            UrlParameterType.Labels,
            `${labelFilter.key}|${labelFilter.operator}|${labelFilter.value}`,
            params
          );
        } else {
          params = appendUrlParameter(
            UrlParameterType.Fields,
            `${labelFilter.key}|${labelFilter.operator}|${labelFilter.value}`,
            params
          );
        }
      }

      return {
        path: createAppUrl(`/explore/service/${serviceName}/logs`, params),
      };
    },
  } as PluginExtensionLinkConfig,
];
