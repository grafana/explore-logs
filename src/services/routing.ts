import pluginJson from '../plugin.json';

export function createAppUrl(urlParams?: URLSearchParams): string {
  return `/a/${pluginJson.id}/${urlParams ? `?${urlParams.toString()}` : ''}`;
}

export enum UrlParameterType {
  DatasourceId = 'dsUid',
  Labels = 'selectedLabels',
  LogsVolumeLabel = 'logsVolumeLabel',
  SelectedLine = 'selectedLine',
  From = 'from',
  To = 'to',
}

export function setUrlParameter<T>(key: UrlParameterType, value: T, initalParams?: URLSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.set(key, JSON.stringify(value));

  return searchParams;
}
