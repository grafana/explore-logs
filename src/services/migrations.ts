import { locationService } from '@grafana/runtime';
import { getLineFiltersVariable } from './variableGetters';
import { LineFilterCaseSensitive } from '../Components/ServiceScene/LineFilter/LineFilterScene';
import { LineFilterOp } from './filterTypes';
import { ServiceScene } from '../Components/ServiceScene/ServiceScene';

/**
 * Migrates old line filter to new variables
 */
export function migrateLineFilterV1(serviceScene: ServiceScene) {
  const search = locationService.getSearch();

  const deprecatedLineFilter = search.get('var-lineFilter');

  if (!deprecatedLineFilter) {
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
  const newLocation = locationService.getLocation();
  search.delete('var-lineFilter');
  newLocation.search = search.toString();
  locationService.replace(newLocation.pathname + '?' + newLocation.search);
}
