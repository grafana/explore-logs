import {
  navigateToDrilldownPage,
  navigateToIndex,
  navigateToInitialPageAfterServiceSelection,
  navigateToValueBreakdown,
} from './navigate';
import { PageSlugs, ValueSlugs } from './routing';
import { ServiceScene, ServiceSceneCustomState } from '../Components/ServiceScene/ServiceScene';
import { locationService } from '@grafana/runtime';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { getMetadataService, initializeMetadataService } from './metadata';
import { DetectedLabel } from './fields';

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
    let drillDownLabel: string,
      serviceLabel: string,
      labels: DetectedLabel[],
      mockServiceSceneState: ServiceSceneCustomState;
    beforeAll(() => {
      drillDownLabel = 'label_name';
      serviceLabel = 'service_name';
      mockIndexScene = {
        state: {
          routeMatch: {
            path: '',
            isExact: true,
            url: '',
            params: {
              service: serviceLabel,
              label: drillDownLabel,
            },
          },
        },
      } as IndexScene;

      labels = [
        {
          label: drillDownLabel,
          cardinality: 10,
        },
      ];

      mockServiceSceneState = {
        labels,
        // patterns: [
        //   {
        //     pattern: 'error <_> message',
        //     samples: [
        //       [1721220640, '270'],
        //       [1721220650, '341'],
        //     ],
        //   },
        // ],
        fields: ['field1', 'field2'],
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
      serviceLabel = 'service_name';
      mockIndexScene = {
        state: {
          routeMatch: {
            path: '',
            isExact: true,
            url: '',
            params: {
              service: serviceLabel,
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
  describe('navigateToIndex', () => {
    it('should navigate to service selection', () => {
      navigateToIndex();
      expect(locationSpy).toHaveBeenCalledWith('/a/grafana-lokiexplore-app/explore');
    });
  });
  describe('navigateToInitialPageAfterServiceSelection', () => {
    it('should navigate to initial (logs) page', () => {
      const serviceName = 'service_name_string';
      navigateToInitialPageAfterServiceSelection(serviceName);
      expect(locationSpy).toHaveBeenCalledWith(`/a/grafana-lokiexplore-app/explore/service/${serviceName}/logs`);
    });
  });
});
