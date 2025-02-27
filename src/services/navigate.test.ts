import { getDrillDownIndexLink, navigateToDrilldownPage, navigateToValueBreakdown } from './navigate';
import { PageSlugs, ValueSlugs } from './routing';
import { ServiceScene, ServiceSceneCustomState } from '../Components/ServiceScene/ServiceScene';
import { locationService } from '@grafana/runtime';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { getMetadataService, initializeMetadataService } from './metadata';

const locationSpy = jest.spyOn(locationService, 'push');
let mockIndexScene: IndexScene;
jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    getAncestor: () => mockIndexScene,
  },
}));
describe('navigate', () => {
  beforeAll(() => {
    initializeMetadataService();
  });

  describe('navigateToValueBreakdown', () => {
    let drillDownLabel: string, serviceLabel: string, mockServiceSceneState: ServiceSceneCustomState;
    beforeAll(() => {
      drillDownLabel = 'label_name';
      serviceLabel = 'tempo-ingester';
      mockIndexScene = {
        state: {
          routeMatch: {
            path: '',
            isExact: true,
            url: '',
            params: {
              labelValue: serviceLabel,
              labelName: 'service',
              breakdownLabel: drillDownLabel,
            },
          },
        },
      } as IndexScene;

      mockServiceSceneState = {
        patternsCount: 2,
        fieldsCount: 2,
        loading: true,
      };
    });
    test.each(Object.values(ValueSlugs))('should push value slug %s and update metadata', (slug) => {
      const serviceScene = new ServiceScene({ ...mockServiceSceneState, drillDownLabel });
      navigateToValueBreakdown(slug, drillDownLabel, serviceScene);

      expect(locationSpy).toHaveBeenCalledWith(
        `/a/grafana-lokiexplore-app/explore/service/${serviceLabel}/${slug}/${drillDownLabel}`
      );
      expect(getMetadataService().getServiceSceneState()).toEqual(mockServiceSceneState);
    });
  });
  describe('navigateToDrilldownPage', () => {
    let serviceLabel: string;
    beforeAll(() => {
      serviceLabel = 'tempo-ingester';
      mockIndexScene = {
        state: {
          routeMatch: {
            path: '',
            isExact: true,
            url: '',
            params: {
              labelName: 'service',
              labelValue: serviceLabel,
            },
          },
        },
      } as IndexScene;
    });
    test.each(Object.values(PageSlugs))('should push url for slug %s', (slug) => {
      const serviceScene = new ServiceScene({});
      navigateToDrilldownPage(slug, serviceScene);
      expect(locationSpy).toHaveBeenCalledWith(`/a/grafana-lokiexplore-app/explore/service/${serviceLabel}/${slug}`);
    });
  });
  describe('navigateToInitialPageAfterServiceSelection', () => {
    it('should navigate to initial (logs) page', () => {
      const labelValue = 'label_value_string';
      const labelName = 'label_name_string';

      const link = getDrillDownIndexLink(labelName, labelValue);
      expect(link).toEqual(`/a/grafana-lokiexplore-app/explore/${labelName}/${labelValue}/logs`);
    });
  });
});
