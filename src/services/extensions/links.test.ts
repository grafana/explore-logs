import { dateTime, PluginExtensionPanelContext } from '@grafana/data';
import { LokiQuery } from '../lokiQuery';
import { LinkConfigs, linkConfigs } from './links';
import {
  ValidByteUnitValues,
  validDurationValues,
} from '../../Components/ServiceScene/Breakdowns/NumericFilterPopoverScene';

function getTestConfig(
  links: LinkConfigs,
  target: Partial<LokiQuery> & { refId: string },
  context?: Partial<PluginExtensionPanelContext>
) {
  return links?.[0].configure?.({
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
    ...context,
    targets: [target],
  });
}

function getTestTarget(lokiQuery?: Partial<LokiQuery>): Partial<LokiQuery> & { refId: string } {
  return {
    expr: '{cluster="eu-west-1"} |= "\\\\n" ',
    datasource: {
      type: 'loki',
      uid: '123abc',
    },
    ...lokiQuery,
    refId: lokiQuery?.refId ?? 'A', // Ensure refId is defined
  };
}

describe('contextToLink', () => {
  it('should strip slashes', () => {
    const target = getTestTarget({
      expr: '{service_name=`cloud/gcp`, resource_type!=`gce_firewall_rule`} | json | logfmt | drop __error__, __error_details__',
    });
    const config = getTestConfig(linkConfigs, target);

    expect(config).toEqual({
      path: '/a/grafana-lokiexplore-app/explore/service/cloud-gcp/logs?var-ds=123abc&from=1675828800000&to=1675854000000&var-filters=service_name%7C%3D%7Ccloud%2Fgcp&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule',
    });
  });
  describe('line-filters', () => {
    it('should parse case sensitive regex line-filters in double quotes and backticks', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |~ "((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" != ` ((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`| json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        '&var-filters=cluster%7C%3D%7Ceu-west-1' + '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';
      const expectedLineFiltersUrlString =
        '&var-lineFilters=caseSensitive%2C0%7C__gfp__%7E%7C%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D' +
        '&var-lineFilters=caseSensitive%2C1%7C%21%3D%7C+%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
      });
    });
    it('should parse case sensitive non-regex line-filters in double quotes and backticks', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |= " (?i)caller,__gfp__" |= ` (?i)caller,__gfc__` | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString =
        '&var-filters=cluster%7C%3D%7Ceu-west-1' + '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';
      const expectedLineFiltersUrlString =
        '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7C+%28%3Fi%29caller__gfc__' +
        // Note: This is a bug! If searching for log lines containing `__gfp__` or `__gfc__`, it will be interpolated as a pipe or a comma in the evaluated string
        '__gfp__' +
        '&var-lineFilters=caseSensitive%2C1%7C__gfp__%3D%7C+%28%3Fi%29caller__gfc__' +
        '__gfc__';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
      });
    });
    it('should parse case insensitive regex line-filters in double quotes and backticks', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |~ "(?i)((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}" !~ `(?i) ((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`| json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      // &var-filters=cluster|=|eu-west-1
      const expectedLabelFiltersUrlString =
        '&var-filters=cluster%7C%3D%7Ceu-west-1' +
        // &var-filters=resource_type|!=|gce_firewall_rule
        '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';

      // &var-lineFilters=caseInsensitive|__gfp__~|((25[0-5]__gfp__(2[0-4]__gfp__1\d__gfp__[1-9]__gfp__)\d)\.?\b){4}
      const expectedLineFiltersUrlString =
        '&var-lineFilters=caseInsensitive%7C__gfp__%7E%7C%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D' +
        // &var-lineFilters=caseInsensitive|!~|+((25[0-5]__gfp__(2[0-4]__gfp__1\d__gfp__[1-9]__gfp__)\d)\.?\b){4}
        '&var-lineFilters=caseInsensitive%7C%21%7E%7C+%28%2825%5B0-5%5D__gfp__%282%5B0-4%5D__gfp__1%5Cd__gfp__%5B1-9%5D__gfp__%29%5Cd%29%5C.%3F%5Cb%29%7B4%7D';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
      });
    });
    it('should parse case sensitive non-regex line-filters in double quotes and backticks containing case insensitive string, newlines, and double quotes', () => {
      const target = getTestTarget({
        expr: '{cluster="eu-west-1", resource_type!=`gce_firewall_rule`} |= `" (?i)caller"` |=  " (?i)caller.+\\\\\\\\n" | json | logfmt | drop __error__, __error_details__',
      });
      const config = getTestConfig(linkConfigs, target);

      // &var-filters=cluster|=|eu-west-1
      const expectedLabelFiltersUrlString =
        '&var-filters=cluster%7C%3D%7Ceu-west-1' +
        // &var-filters=resource_type|!=|gce_firewall_rule
        '&var-filters=resource_type%7C%21%3D%7Cgce_firewall_rule';

      // &var-lineFilters=caseSensitive,0|__gfp__=|"+(?i)caller"
      const expectedLineFiltersUrlString =
        '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7C%22+%28%3Fi%29caller%22' +
        // &var-lineFilters=caseSensitive,1|__gfp__=|+(?i)caller.+\\\\n
        '&var-lineFilters=caseSensitive%2C1%7C__gfp__%3D%7C+%28%3Fi%29caller.%2B%5C%5Cn';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
      });
    });
    it('should parse case sensitive non-regex line-filter containing double quotes', () => {
      const target = getTestTarget({ expr: '{cluster="eu-west-1"} |= "thread \\\\\\"main\\\\\\""' });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

      // &var-lineFilters=caseSensitive,0|__gfp__=|thread \"main\"
      const expectedLineFiltersUrlString = '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7Cthread+%5C%22main%5C%22';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
      });
    });
    it('should parse case sensitive non-regex line-filter containing newline match', () => {
      const target = getTestTarget({ expr: `{cluster="eu-west-1"} |= "\\\\n"` });
      const config = getTestConfig(linkConfigs, target);

      const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

      // &var-lineFilters=caseSensitive,0|__gfp__=|\n
      const expectedLineFiltersUrlString = '&var-lineFilters=caseSensitive%2C0%7C__gfp__%3D%7C%5Cn';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}`,
      });
    });
    it('should parse regex labels, fields, and line filters', () => {
      const target = getTestTarget({
        expr: `sort_desc(sum by (error) (count_over_time({service_name=~"grafana/.*", cluster=~"prod-eu-west-2"} | logfmt | level="error" | logger=~".*grafana-datasource.*|.*coreplugin" | statusSource!="downstream" | error!="" |~"Partial data response error|Plugin Request Completed" | endpoint="queryData" [$__auto])))`,
      });
      const config = getTestConfig(linkConfigs, target);
      // &var-filters=service_name|=~|grafana/.*
      const expectedLabelFiltersUrlString =
        '&var-filters=service_name%7C%3D%7E%7Cgrafana%2F.*' +
        //&var-filters=cluster|=~|prod-eu-west-2
        '&var-filters=cluster%7C%3D%7E%7Cprod-eu-west-2';

      const expectedLineFiltersUrlString =
        // caseSensitive,0|__gfp__~|Partial+data+response+error__gfp__Plugin+Request+Completed
        '&var-lineFilters=caseSensitive%2C0%7C__gfp__%7E%7CPartial+data+response+error__gfp__Plugin+Request+Completed';

      const expectedFieldsUrlString =
        // level|=|{"value":"error"__gfc__"parser":"logfmt"},error
        '&var-fields=level%7C%3D%7C%7B%22value%22%3A%22error%22__gfc__%22parser%22%3A%22logfmt%22%7D%2Cerror' +
        // statusSource|!=|{"value":"downstream"__gfc__"parser":"logfmt"},downstream
        '&var-fields=statusSource%7C%21%3D%7C%7B%22value%22%3A%22downstream%22__gfc__%22parser%22%3A%22logfmt%22%7D%2Cdownstream' +
        // error|!=|{"value":""__gfc__"parser":"logfmt"},""
        '&var-fields=error%7C%21%3D%7C%7B%22value%22%3A%22%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C%22%22' +
        // endpoint|=|{"value":"queryData"__gfc__"parser":"logfmt"},queryData
        '&var-fields=endpoint%7C%3D%7C%7B%22value%22%3A%22queryData%22__gfc__%22parser%22%3A%22logfmt%22%7D%2CqueryData';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/service/grafana-.*/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}${expectedFieldsUrlString}`,
      });
    });
    it('should not confuse field filters with indexed label filters', () => {
      const target = getTestTarget({
        expr: `sort_desc(sum by (error) (count_over_time({cluster="eu-west-1", service_name=~"grafana/.*"} | logfmt | level="error" | logger=~".*grafana-datasource.*|.*coreplugin" | statusSource!="downstream" | error!="" |~"Partial data response error|Plugin Request Completed" | endpoint="queryData" [$__auto])))`,
      });
      const config = getTestConfig(linkConfigs, target);

      // &var-filters=cluster|=|eu-west-1
      const expectedLabelFiltersUrlString =
        '&var-filters=cluster%7C%3D%7Ceu-west-1' +
        //&var-filters=service_name|=~|grafana/.*
        '&var-filters=service_name%7C%3D%7E%7Cgrafana%2F.*';

      // var-lineFilters=caseSensitive,0|__gfp__~|Partial data response error__gfp__Plugin Request Completed
      const expectedLineFiltersUrlString =
        '&var-lineFilters=caseSensitive%2C0%7C__gfp__%7E%7CPartial+data+response+error__gfp__Plugin+Request+Completed';

      // level|=|{"value":"error"__gfc__"parser":"logfmt"},error
      // statusSource|!=|{"value":"downstream"__gfc__"parser":"logfmt"},downstream
      // error|!=|{"value":""__gfc__"parser":"logfmt"},""
      // endpoint|=|{"value":"queryData"__gfc__"parser":"logfmt"},queryData
      const expectedFieldsUrlString =
        '&var-fields=level%7C%3D%7C%7B%22value%22%3A%22error%22__gfc__%22parser%22%3A%22logfmt%22%7D%2Cerror' +
        '&var-fields=statusSource%7C%21%3D%7C%7B%22value%22%3A%22downstream%22__gfc__%22parser%22%3A%22logfmt%22%7D%2Cdownstream' +
        '&var-fields=error%7C%21%3D%7C%7B%22value%22%3A%22%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C%22%22' +
        '&var-fields=endpoint%7C%3D%7C%7B%22value%22%3A%22queryData%22__gfc__%22parser%22%3A%22logfmt%22%7D%2CqueryData';

      expect(config).toEqual({
        path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedLineFiltersUrlString}${expectedFieldsUrlString}`,
      });
    });
  });
  describe('fields', () => {
    describe('string fields', () => {
      it('should parse structured metadata field', () => {
        const target = getTestTarget({ expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` ` });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|!=|mimir-ingester-xjntw
        const expectedFiltersString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should parse structured metadata field with parser(s)', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | json `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|!=|mimir-ingester-xjntw
        const expectedFiltersString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should parse field with logfmt parser', () => {
        const target = getTestTarget({ expr: `{cluster="eu-west-1"} | logfmt | pod=\`mimir-ingester-xjntw\`  ` });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"logfmt"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22logfmt%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should parse field with json parser', () => {
        const target = getTestTarget({ expr: `{cluster="eu-west-1"} | json | pod=\`mimir-ingester-xjntw\`  ` });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"json"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22json%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should parse field with mixed parser', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | pod=\`mimir-ingester-xjntw\`  `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22mixed%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should ignore __error__ filters', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | drop __error__, __error_details__ | pod=\`mimir-ingester-xjntw\` | __error__=""  `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22mixed%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should ignore metric queries', () => {
        const target = getTestTarget({
          expr: `sum(count_over_time({cluster=\`eu-west-1\`} | logfmt | json | pod=\`mimir-ingester-xjntw\` [$__auto])) by (detected_level)`,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22mixed%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should ignore unwrap', () => {
        const target = getTestTarget({
          expr: `avg_over_time({cluster=\`eu-west-1\`} | logfmt | pod=\`mimir-ingester-xjntw\` | unwrap duration(duration) | __error__="" [$__auto]) by ()`,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22logfmt%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should ignore regex match', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | pod=\`mimir-ingester-xjntw\` pod=~\`mimir-ingester-.+\``,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22mixed%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
      it('should ignore regex exclusion', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | logfmt | json | pod=\`mimir-ingester-xjntw\` | pod!~\`mimir-ingester-.+\``,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|=|{"value":"mimir-ingester-xjntw"__gfc__"parser":"mixed"},mimir-ingester-xjntw
        const expectedFiltersString =
          '&var-fields=pod%7C%3D%7C%7B%22value%22%3A%22mimir-ingester-xjntw%22__gfc__%22parser%22%3A%22mixed%22%7D%2Cmimir-ingester-xjntw';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedFiltersString}`,
        });
      });
    });
    describe('numeric fields', () => {
      it('should parse gt', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration > 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|!=|mimir-ingester-xjntw
        const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
        // duration|>|{"value":"10s"__gfc__"parser":"logfmt"},10s
        const expectedFiltersString =
          '&var-fields=duration%7C%3E%7C%7B%22value%22%3A%2210s%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C10s';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
        });
      });
      it('should parse gte', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration >= 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|!=|mimir-ingester-xjntw
        const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
        // duration|>=|{"value":"10s"__gfc__"parser":"logfmt"},10s
        const expectedFiltersString =
          '&var-fields=duration%7C%3E%3D%7C%7B%22value%22%3A%2210s%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C10s';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
        });
      });
      it('should parse lt', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration < 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|!=|mimir-ingester-xjntw
        const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
        // duration|<|{"value":"10s"__gfc__"parser":"logfmt"},10s
        const expectedFiltersString =
          '&var-fields=duration%7C%3C%7C%7B%22value%22%3A%2210s%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C10s';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
        });
      });
      it('should parse lte', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration <= 10s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|!=|mimir-ingester-xjntw
        const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
        // duration|<=|{"value":"10s"__gfc__"parser":"logfmt"},10s
        const expectedFiltersString =
          '&var-fields=duration%7C%3C%3D%7C%7B%22value%22%3A%2210s%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C10s';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
        });
      });
      it('should ignore "or" expressions', () => {
        const target = getTestTarget({
          expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration <= 10s or duration > 10.2s `,
        });
        const config = getTestConfig(linkConfigs, target);

        const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

        // pod|!=|mimir-ingester-xjntw
        const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
        // duration|<=|{"value":"10s"__gfc__"parser":"logfmt"},10s
        const expectedFiltersString =
          '&var-fields=duration%7C%3C%3D%7C%7B%22value%22%3A%2210s%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C10s';

        expect(config).toEqual({
          path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
        });
      });

      describe('duration', () => {
        it.each(Object.values(validDurationValues))('should parse duration with %s unit', (...units) => {
          units.forEach((unit) => {
            const target = getTestTarget({
              expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration >= 10.1${unit}`,
            });
            const config = getTestConfig(linkConfigs, target);

            const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';
            // pod|!=|mimir-ingester-xjntw
            const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
            // duration|>=|{"value":"10.1ms"__gfc__"parser":"logfmt"},10.1ms
            const expectedFiltersString = `&var-fields=duration%7C%3E%3D%7C%7B%22value%22%3A%2210.1${encodeURIComponent(
              unit
            )}%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C10.1${encodeURIComponent(unit)}`;

            expect(config).toEqual({
              path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
            });
          });
        });

        const cases = ['1h15m30.918273645s', '1h0.0m0s', '-1s'];
        it.each(cases)('should parse complex duration units: %s', (unit) => {
          const target = getTestTarget({
            expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | duration <= ${unit} `,
          });
          const config = getTestConfig(linkConfigs, target);

          const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';

          // pod|!=|mimir-ingester-xjntw
          const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
          // duration|<=|{"value":"${unit}"__gfc__"parser":"logfmt"},${unit}
          const expectedFiltersString = `&var-fields=duration%7C%3C%3D%7C%7B%22value%22%3A%22${unit}%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C${unit}`;

          expect(config).toEqual({
            path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
          });
        });
      });
      describe('bytes', () => {
        it.each(Object.values(ValidByteUnitValues))('should parse bytes with %s unit', (unit: string) => {
          const target = getTestTarget({
            expr: `{cluster="eu-west-1"} | pod!=\`mimir-ingester-xjntw\` | logfmt | bytes >= 10.1${unit}`,
          });
          const config = getTestConfig(linkConfigs, target);
          const expectedLabelFiltersUrlString = '&var-filters=cluster%7C%3D%7Ceu-west-1';
          // pod|!=|mimir-ingester-xjntw
          const expectedMetadataString = '&var-metadata=pod%7C%21%3D%7Cmimir-ingester-xjntw';
          // bytes|>=|{"value":"10.1KiB"__gfc__"parser":"logfmt"},10.1KiB
          const expectedFiltersString = `&var-fields=bytes%7C%3E%3D%7C%7B%22value%22%3A%2210.1${unit}%22__gfc__%22parser%22%3A%22logfmt%22%7D%2C10.1${unit}`;

          expect(config).toEqual({
            path: `/a/grafana-lokiexplore-app/explore/cluster/eu-west-1/logs?var-ds=123abc&from=1675828800000&to=1675854000000${expectedLabelFiltersUrlString}${expectedMetadataString}${expectedFiltersString}`,
          });
        });
      });
    });
  });
});
