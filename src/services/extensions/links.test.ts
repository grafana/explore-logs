import { dateTime } from '@grafana/data';
import { LokiQuery } from '../lokiQuery';
import { linkConfigs } from './links';

describe('contextToLink', () => {
  it('should strip slashes', () => {
    const links = linkConfigs;
    const target: { refId: string } & Partial<LokiQuery> = {
      expr: '{service_name=`cloud/gcp`, resource_type!=`gce_firewall_rule`} | json | logfmt | drop __error__, __error_details__',
      datasource: {
        type: 'loki',
        uid: '123abc',
      },
      refId: 'A', // Ensure refId is defined
    };
    const config = links?.[0].configure?.({
      timeRange: {
        from: dateTime('2023-02-08T04:00:00.000Z'),
        to: dateTime('2023-02-08T11:00:00.000Z'),
      },
      pluginId: 'grafana-lokiexplore-app',
      timeZone: 'browser',
      id: 0,
      title: 'test',
      dashboard: {
        tags: [],
        title: 'test',
        uid: 'test',
      },
      targets: [target],
    });

    expect(config).toEqual({
      path: '/a/grafana-lokiexplore-app/explore/service/cloud-gcp/logs?var-ds=123abc&from=1675828800000&to=1675854000000&var-filters=service_name%7C%3D%7Ccloud%2Fgcp&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule',
    });
  });
});
