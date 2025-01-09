import { locationService } from '@grafana/runtime';
import { getLineFiltersVariable } from './variableGetters';
import { LineFilterCaseSensitive } from '../Components/ServiceScene/LineFilter/LineFilterScene';
import { LineFilterOp } from './filterTypes';
import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { urlUtil } from '@grafana/data';

/**
 * Migrates old line filter to new variables
 */
export function migrateLineFilterV1(serviceScene: ServiceScene) {
  const search = urlUtil.getUrlSearchParams();

  const deprecatedLineFilterArray = search['var-lineFilter'];
  console.log('deprecatedLineFilter', deprecatedLineFilterArray);
  if (!Array.isArray(deprecatedLineFilterArray) || !deprecatedLineFilterArray.length) {
    return;
  }
  const deprecatedLineFilter = deprecatedLineFilterArray[0];
  if (typeof deprecatedLineFilter !== 'string') {
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
            value: caseSensitiveMatches[1],
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
          value: caseInsensitiveMatches[1],
          keyLabel: '0',
        },
      ]);
    });
  }

  // Remove from url without refreshing
  delete search['var-lineFilter'];
  locationService.replace(urlUtil.renderUrl(location.pathname, search));
}
