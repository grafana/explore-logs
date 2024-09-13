import { Identifier, Matcher, MetricExpr, parser, String } from '@grafana/lezer-logql';
import { LokiQuery } from './lokiQuery';
import { getNodesFromQuery } from './logqlMatchers';
import { SceneDataQueryRequest } from './datasourceTypes';

export function isQueryWithNode(query: string, nodeType: number): boolean {
  let isQueryWithNode = false;
  const tree = parser.parse(query);
  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === nodeType) {
        isQueryWithNode = true;
        return false;
      }
    },
  });
  return isQueryWithNode;
}

export function isLogsQuery(query: string): boolean {
  // As a safeguard we are checking for a length of 2, because at least the query should be `{}`
  return query.trim().length > 2 && !isQueryWithNode(query, MetricExpr);
}

export function isLogsRequest(request: SceneDataQueryRequest) {
  return request.targets.find((query) => isLogsQuery(query.expr)) !== undefined;
}

export function requestSupportsSharding(request: SceneDataQueryRequest) {
  if (isLogsRequest(request)) {
    return false;
  }
  for (let i = 0; i < request.targets.length; i++) {
    if (request.targets[i].expr?.includes('avg_over_time')) {
      return false;
    }
  }
  return true;
}

const SHARDING_PLACEHOLDER = '__stream_shard_number__';
export const addShardingPlaceholderSelector = (query: string) => {
  return query.replace('}', `, __stream_shard__=~"${SHARDING_PLACEHOLDER}"}`);
};

export const interpolateShardingSelector = (queries: LokiQuery[], shards?: number[][], i?: number) => {
  if (shards === undefined || i === undefined) {
    return queries.map((query) => ({
      ...query,
      expr: query.expr.replace(`, __stream_shard__=~"${SHARDING_PLACEHOLDER}"}`, '}'),
    }));
  }

  let shardValue = shards[i].join('|');

  // -1 means empty shard value
  if (shardValue === '-1' || shards[i].length === 1) {
    shardValue = shardValue === '-1' ? '' : shardValue;
    return queries.map((query) => ({
      ...query,
      expr: query.expr.replace(`, __stream_shard__=~"${SHARDING_PLACEHOLDER}"}`, `, __stream_shard__="${shardValue}"}`),
    }));
  }

  return queries.map((query) => ({
    ...query,
    expr: query.expr.replace(new RegExp(`${SHARDING_PLACEHOLDER}`, 'g'), shardValue),
  }));
};

export const getServiceNameFromQuery = (query: string) => {
  const matchers = getNodesFromQuery(query, [Matcher]);
  for (let i = 0; i < matchers.length; i++) {
    const idNode = matchers[i].getChild(Identifier);
    const stringNode = matchers[i].getChild(String);
    if (!idNode || !stringNode) {
      continue;
    }
    const identifier = query.substring(idNode.from, idNode.to);
    const value = query.substring(stringNode.from, stringNode.to);
    if (identifier === 'service_name') {
      return value;
    }
  }
  return '';
};
