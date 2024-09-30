// Warning: This file is included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!
// copied from public/app/plugins/datasource/loki/types.ts
export enum LabelType {
  Indexed = 'I',
  StructuredMetadata = 'S',
  Parsed = 'P',
}
