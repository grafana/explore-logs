import { addAdHocFilterUserInputPrefix } from 'services/variables';
import { escapeUrlPipeDelimiters } from './links';

export function encodeFilter(input: string) {
  return encodeURIComponent(input)
    .replace(/!/g, '%21')
    .replace(/~/g, '%7E')
    .replace(/%20/g, '+')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Test helper method
 * Adds the custom input prefix
 * Adds the value to valueLabels
 */
export function addCustomInputPrefixAndValueLabels(value: string) {
  return `${escapeUrlPipeDelimiters(addAdHocFilterUserInputPrefix(value))},${escapeUrlPipeDelimiters(value)}`;
}

export function getPath(options: {
  slug: string;
  expectedLabelFiltersUrlString?: string;
  expectedMetadataString?: string;
  expectedLineFiltersUrlString?: string;
  expectedFieldsUrlString?: string;
  expectedLevelsFilterUrlString?: string;
}) {
  return `/a/grafana-lokiexplore-app/explore/${options.slug}/logs?var-ds=123abc&from=1675828800000&to=1675854000000${
    options.expectedLabelFiltersUrlString ?? ''
  }${options.expectedMetadataString ?? ''}${options.expectedLineFiltersUrlString ?? ''}${
    options.expectedFieldsUrlString ?? ''
  }${options.expectedLevelsFilterUrlString ?? ''}`;
}
