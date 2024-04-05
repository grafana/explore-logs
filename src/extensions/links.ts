import { DataQuery, DataSourceApi, PluginExtensionLinkConfig, PluginExtensionPanelContext, PluginExtensionPoints, rangeUtil } from "@grafana/data";
import { SERVICE_NAME } from "pages/Explore/SelectStartingPointScene";
import { getMatcherFromQuery, getParserFromQuery } from "utils/logql";

import pluginJson from '../plugin.json';  

export const linkConfigs: Array<PluginExtensionLinkConfig<PluginExtensionPanelContext>> = [
  {
    extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
    category: 'Logs',
    title: 'View in Explore Logs',
    description: 'View logs for this panel',
    path: createAppUrl(),
    configure: (context: PluginExtensionPanelContext) => {
      const lokiQuery = context.targets.find((target) => isLokiDatasource(target.datasource)) as LokiQuery;
      if (!lokiQuery) {
        return undefined;
      }

      const expr = lokiQuery.expr;
      const matchers = getMatcherFromQuery(expr);
      if (!matchers) {
        return undefined
      }

      const filter = matchers.find(filter => filter.key === SERVICE_NAME)?.values[0]
      if (!filter) {
        return undefined
      }

      let params = setUrlParameter(UrlParameterType.DataSource, lokiQuery.datasource?.uid);
      params = setUrlParameter(UrlParameterType.Filter, `service_name=${filter}`, params);

      const range = rangeUtil.convertRawToRange(context.timeRange)
      params = setUrlParameter(UrlParameterType.From, range.from, params);
      params = setUrlParameter(UrlParameterType.To, range.to, params);

      
      const fields = matchers.filter(filter => filter.key !== SERVICE_NAME)
      if (fields.length > 0) {
        //TODO
      }

      
      let parser = getParserFromQuery(expr);
      if (parser) {
        params = setUrlParameter(UrlParameterType.LogsFormat, parser, params);
      }
      return {
        path: createAppUrl(params),
      };
    },
  } as PluginExtensionLinkConfig<PluginExtensionPanelContext>,
];

const isLokiDatasource = (datasource?: any) => {
  if (!datasource || typeof datasource !== 'object') {
    return false;
  } 
  return datasource.type === 'loki';  
}

interface LokiQuery extends DataQuery {
  expr: string;
  datasource: DataSourceApi;
}

function createAppUrl(urlParams?: URLSearchParams): string {
  return `/a/${pluginJson.id}/explore?mode=logs&actionView=logs${urlParams ? `?${urlParams.toString()}` : ''}`;
}

export enum UrlParameterType {
  Filter = 'var-filters',
  Fields = 'var-fields',
  LogsFormat = 'var-logsFormat',
  DataSource = 'var-ds',
  From = 'from',
  To = 'to',
}

export function setUrlParameter<T>(key: UrlParameterType, value: T, initalParams?: URLSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.set(key, JSON.stringify(value));

  return searchParams;
}