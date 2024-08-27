import { NodeType, SyntaxNode, Tree } from '@lezer/common';

import { Identifier, Matcher, MetricExpr, parser, Selector, String } from '@grafana/lezer-logql';
import { Filter, FilterOp } from './filters';
import { LabelType } from './fields';
import { LokiQuery } from './query';

export class NodePosition {
  from: number;
  to: number;
  type: NodeType;
  syntaxNode: SyntaxNode;

  constructor(from: number, to: number, syntaxNode: SyntaxNode, type: NodeType) {
    this.from = from;
    this.to = to;
    this.type = type;
    this.syntaxNode = syntaxNode;
  }

  static fromNode(node: SyntaxNode): NodePosition {
    return new NodePosition(node.from, node.to, node, node.type);
  }

  contains(position: NodePosition): boolean {
    return this.from <= position.from && this.to >= position.to;
  }

  getExpression(query: string): string {
    return query.substring(this.from, this.to);
  }
}

export function getNodesFromQuery(query: string, nodeTypes?: number[]): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  const tree: Tree = parser.parse(query);
  tree.iterate({
    enter: (node): false | void => {
      if (nodeTypes === undefined || nodeTypes.includes(node.type.id)) {
        nodes.push(node.node);
      }
    },
  });
  return nodes;
}

function getAllPositionsInNodeByType(node: SyntaxNode, type: number): NodePosition[] {
  if (node.type.id === type) {
    return [NodePosition.fromNode(node)];
  }

  const positions: NodePosition[] = [];
  let pos = 0;
  let child = node.childAfter(pos);
  while (child) {
    positions.push(...getAllPositionsInNodeByType(child, type));
    pos = child.to;
    child = node.childAfter(pos);
  }
  return positions;
}

export function getMatcherFromQuery(query: string): Filter[] {
  const filter: Filter[] = [];
  const selector = getNodesFromQuery(query, [Selector]);
  if (selector.length === 0) {
    return filter;
  }
  const selectorPosition = NodePosition.fromNode(selector[0]);

  const allMatcher = getNodesFromQuery(query, [Matcher]);
  for (const matcher of allMatcher) {
    const matcherPosition = NodePosition.fromNode(matcher);
    const identifierPosition = getAllPositionsInNodeByType(matcher, Identifier);
    const valuePosition = getAllPositionsInNodeByType(matcher, String);
    const operation = query.substring(identifierPosition[0].to, valuePosition[0].from);
    const op = operation === '=' ? FilterOp.Equal : FilterOp.NotEqual;
    const key = identifierPosition[0].getExpression(query);
    const value = valuePosition.map((position) => query.substring(position.from + 1, position.to - 1))[0];

    if (!key || !value) {
      continue;
    }

    filter.push({
      key,
      operator: op,
      value,
      type: selectorPosition.contains(matcherPosition) ? LabelType.Indexed : undefined,
    });
  }

  return filter;
}

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

  const shardValue = shards[i].join('|');

  // -1 means empty shard value
  if (shardValue === '-1') {
    return queries.map((query) => ({
      ...query,
      expr: query.expr.replace(`, __stream_shard__=~"${SHARDING_PLACEHOLDER}"}`, `, __stream_shard__=""}`),
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
