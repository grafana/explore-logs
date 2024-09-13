import { Filter, FilterOp } from './filters';
import { Identifier, Matcher, parser, Selector, String } from '@grafana/lezer-logql';
import { NodeType, SyntaxNode, Tree } from '@lezer/common';
import { LabelType } from './fieldsTypes';

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
