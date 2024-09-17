import { linkConfigs } from './links';
import { LokiQuery } from '../query';
import { dateTime } from '@grafana/data';

describe('contextToLink', () => {
  it('should strip slashes', () => {
    const links = linkConfigs;
    const target: Partial<LokiQuery> = {
      expr: '{service_name=`cloud/gcp`, resource_type!=`gce_firewall_rule`} | json | logfmt | drop __error__, __error_details__',
      datasource: {
        type: 'loki',
        uid: '123abc',
      },
    };
    const config = links?.[0].configure?.({
      timeRange: {
        from: dateTime('2023-02-08T04:00:00.000Z'),
        to: dateTime('2023-02-08T11:00:00.000Z'),
      },
      targets: [target],
    });

    expect(config).toEqual({
      path: '/a/grafana-lokiexplore-app/explore/service/cloud-gcp/logs?var-ds=123abc&from=1675828800000&to=1675854000000&var-filters=service_name%7C%3D%7Ccloud%2Fgcp&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule',
    });
  });
});
