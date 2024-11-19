import { buildServicesUrl, PageSlugs, ROUTES } from './routing';
import { buildDrilldownPageUrl } from './navigate';

describe('buildBreakdownUrl', () => {
  const OLD_LOCATION = window.location;

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      value: OLD_LOCATION,
      writable: true,
    });
  });

  it('generates correct url for each page slug', () => {
    Object.defineProperty(window, 'location', {
      value: new URL(
        'http://localhost:3000/a/grafana-lokiexplore-app/explore?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields='
      ),
      writable: true,
    });
    Object.keys(PageSlugs).forEach((slug) => {
      const breakdownUrl = buildDrilldownPageUrl(slug);
      expect(breakdownUrl).toBe(`${slug}?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=`);
    });
  });

  it('removes invalid url keys', () => {
    Object.defineProperty(window, 'location', {
      value: new URL(
        'http://localhost:3000/a/grafana-lokiexplore-app/explore?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&notAThing=whoopsie'
      ),
      writable: true,
    });

    Object.keys(PageSlugs).forEach((slug) => {
      const breakdownUrl = buildDrilldownPageUrl(slug);
      expect(breakdownUrl).toBe(`${slug}?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=`);
    });
  });

  it('preserves valid url keys', () => {
    Object.defineProperty(window, 'location', {
      value: new URL(
        'http://localhost:3000/a/grafana-lokiexplore-app/explore/service/tempo-distributor/logs?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&var-filters=service_name%7C%3D%7Ctempo-distributor&urlColumns=%5B%22Time%22,%22Line%22%5D&visualizationType=%22table%22'
      ),
      writable: true,
    });

    Object.keys(PageSlugs).forEach((slug) => {
      const breakdownUrl = buildDrilldownPageUrl(slug);
      expect(breakdownUrl).toBe(
        `${slug}?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&var-filters=service_name%7C%3D%7Ctempo-distributor&urlColumns=%5B%22Time%22,%22Line%22%5D&visualizationType=%22table%22`
      );
    });
  });

  it('service page will remove keys from breakdown routes, but keep datasource and label filters', () => {
    Object.defineProperty(window, 'location', {
      value: new URL(
        'http://localhost:3000/a/grafana-lokiexplore-app/explore/service/tempo-distributor/logs?var-ds=DSID&from=now-5m&to=now&patterns=%5B%5D&var-fields=&var-filters=service_name%7C%3D%7Ctempo-distributor&urlColumns=%5B%22Time%22,%22Line%22%5D&visualizationType=%22table%22'
      ),
      writable: true,
    });

    const breakdownUrl = buildServicesUrl(ROUTES.explore());
    expect(breakdownUrl).toBe(
      `/a/grafana-lokiexplore-app/${PageSlugs.explore}?var-ds=DSID&from=now-5m&to=now&var-filters=service_name%7C%3D%7Ctempo-distributor`
    );
  });
});
