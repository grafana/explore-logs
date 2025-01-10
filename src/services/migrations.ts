import { locationService } from '@grafana/runtime';
import { getLineFiltersVariable } from './variableGetters';
import { LineFilterCaseSensitive } from '../Components/ServiceScene/LineFilter/LineFilterScene';
import { LineFilterOp } from './filterTypes';
import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { urlUtil } from '@grafana/data';

function removeEscapeChar(value: string, caseSensitive: boolean) {
  const charsEscapedByEscapeRegExp = ['^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|'];
  if (!caseSensitive) {
    charsEscapedByEscapeRegExp.push('\\');
  }
  return value
    .split('')
    .filter((char, index, stringArray) => {
      // We need to differentiate between user entered escape chars, and escape chars added by lodash escapeRegExp to return the same query results in urls from before the line filter regex feature
      // Since there is no reverse of the escapeRegExp method provided by lodash we're essentially building our own "unescapeRegExp"
      const nextChar = stringArray[index + 1];
      const isNextCharRegex = charsEscapedByEscapeRegExp.includes(nextChar);
      return !(char === '\\' && isNextCharRegex);
    })
    .join('');
}

/**
 * Migrates old line filter to new variables
 */
export function migrateLineFilterV1(serviceScene: ServiceScene) {
  const search = urlUtil.getUrlSearchParams();

  const deprecatedLineFilterArray = search['var-lineFilter'];
  if (!Array.isArray(deprecatedLineFilterArray) || !deprecatedLineFilterArray.length) {
    return;
  }
  const deprecatedLineFilter = deprecatedLineFilterArray[0];
  if (typeof deprecatedLineFilter !== 'string' || !deprecatedLineFilter) {
    return;
  }

  const globalLineFilterVars = getLineFiltersVariable(serviceScene);
  const caseSensitiveMatches = deprecatedLineFilter?.match(/\|=.`(.+?)`/);

  if (caseSensitiveMatches && caseSensitiveMatches.length === 2) {
    globalLineFilterVars.addActivationHandler(() => {
      globalLineFilterVars.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseSensitive,
            operator: LineFilterOp.match,
            value: removeEscapeChar(caseSensitiveMatches[1], true),
            keyLabel: '0',
          },
        ],
      });
    });
  }

  const caseInsensitiveMatches = deprecatedLineFilter?.match(/`\(\?i\)(.+)`/);
  if (caseInsensitiveMatches && caseInsensitiveMatches.length === 2) {
    globalLineFilterVars.addActivationHandler(() => {
      globalLineFilterVars.updateFilters([
        {
          key: LineFilterCaseSensitive.caseInsensitive,
          operator: LineFilterOp.match,
          value: removeEscapeChar(caseInsensitiveMatches[1], false),
          keyLabel: '0',
        },
      ]);
    });
  }

  // Remove from url without refreshing
  delete search['var-lineFilter'];
  locationService.replace(urlUtil.renderUrl(location.pathname, search));
}
