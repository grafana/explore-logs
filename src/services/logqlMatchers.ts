// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!

import {
  FilterOp,
  Identifier,
  LineFilter,
  Matcher,
  Neq,
  Nre,
  OrFilter,
  parser,
  PipeExact,
  PipeMatch,
  Selector,
  String,
} from '@grafana/lezer-logql';
import { NodeType, SyntaxNode, Tree } from '@lezer/common';
import { LabelType } from './fieldsTypes';
import {
  Filter,
  FilterOp as FilterOperator,
  LineFilterCaseSensitive,
  LineFilterOp,
  LineFilterType,
} from './filterTypes';

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

function parseLabelFilters(query: string, filter: Filter[]) {
  // `Matcher` will select field filters as well as indexed label filters
  const allMatcher = getNodesFromQuery(query, [Matcher]);
  for (const matcher of allMatcher) {
    const identifierPosition = getAllPositionsInNodeByType(matcher, Identifier);
    const valuePosition = getAllPositionsInNodeByType(matcher, String);
    const operator = query.substring(identifierPosition[0].to, valuePosition[0].from);
    const key = identifierPosition[0].getExpression(query);
    const value = valuePosition.map((position) => query.substring(position.from + 1, position.to - 1))[0];

    if (!key || !value || (operator !== FilterOperator.NotEqual && operator !== FilterOperator.Equal)) {
      continue;
    }

    filter.push({
      key,
      operator,
      value,
      type: LabelType.Indexed,
    });
  }
}

function parseLineFilters(query: string, lineFilters: LineFilterType[]) {
  const allLineFilters = getNodesFromQuery(query, [LineFilter]);
  for (const [index, matcher] of allLineFilters.entries()) {
    const equal = getAllPositionsInNodeByType(matcher, PipeExact);
    const pipeRegExp = getAllPositionsInNodeByType(matcher, PipeMatch);
    const notEqual = getAllPositionsInNodeByType(matcher, Neq);
    const notEqualRegExp = getAllPositionsInNodeByType(matcher, Nre);

    const lineFilterValueNode = getStringsFromLineFilter(matcher);

    const quoteString = query.substring(lineFilterValueNode[0]?.from + 1, lineFilterValueNode[0]?.from);

    // Remove quotes
    let lineFilterValue = query.substring(lineFilterValueNode[0]?.from + 1, lineFilterValueNode[0]?.to - 1);

    if (lineFilterValue.length) {
      let operator;
      if (equal.length) {
        operator = LineFilterOp.match;
      } else if (notEqual.length) {
        operator = LineFilterOp.negativeMatch;
      } else if (notEqualRegExp.length) {
        operator = LineFilterOp.negativeRegex;
      } else if (pipeRegExp.length) {
        operator = LineFilterOp.regex;
      } else {
        throw new Error('unknown line filter operator');
      }

      const isRegexSelector = operator === LineFilterOp.regex || operator === LineFilterOp.negativeRegex;

      const isCaseInsensitive = lineFilterValue.includes('(?i)') && isRegexSelector;

      // If quoteString is `, we shouldn't need to un-escape anything
      // But if the quoteString is ", we'll need to remove double escape chars, as these values are re-escaped when building the query expression (but not stored in the value/url)
      if (quoteString === '"' && isRegexSelector) {
        const replaceDoubleEscape = new RegExp(/\\\\/, 'g');
        lineFilterValue = lineFilterValue.replace(replaceDoubleEscape, '\\');
      } else if (quoteString === '"') {
        const replaceDoubleQuoteEscape = new RegExp(/\\\\\"/, 'g');
        lineFilterValue = lineFilterValue.replace(replaceDoubleQuoteEscape, '"');

        const replaceDoubleEscape = new RegExp(/\\\\/, 'g');
        lineFilterValue = lineFilterValue.replace(replaceDoubleEscape, '\\');
      }

      if (isCaseInsensitive) {
        // If `(?i)` exists in a regex it would need to be escaped to match log lines containing `(?i)`, so it should be safe to replace all instances of `(?i)` in the line filter?
        lineFilterValue = lineFilterValue.replace('(?i)', '');
      }

      lineFilters.push({
        key: isCaseInsensitive
          ? LineFilterCaseSensitive.caseInsensitive.toString()
          : LineFilterCaseSensitive.caseSensitive.toString() + ',' + index.toString(),
        operator: operator,
        value: lineFilterValue,
      });
    }
  }
}

export function getMatcherFromQuery(query: string): { labelFilters: Filter[]; lineFilters?: LineFilterType[] } {
  const filter: Filter[] = [];
  const lineFilters: LineFilterType[] = [];
  const selector = getNodesFromQuery(query, [Selector]);

  if (selector.length === 0) {
    return { labelFilters: filter };
  }

  // Get the stream selector portion of the query
  const selectorQuery = getAllPositionsInNodeByType(selector[0], Selector)[0].getExpression(query);

  parseLabelFilters(selectorQuery, filter);
  parseLineFilters(query, lineFilters);

  return { labelFilters: filter, lineFilters };
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

/**
 * Parses the query and looks for error nodes. If there is at least one, it returns true.
 * Grafana variables are considered errors, so if you need to validate a query
 * with variables you should interpolate it first.
 */
export const ErrorId = 0;
export function isValidQuery(query: string): boolean {
  return isQueryWithNode(query, ErrorId) === false;
}

function getStringsFromLineFilter(filter: SyntaxNode): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  let node: SyntaxNode | null = filter;
  do {
    const string = node.getChild(String);
    if (string && !node.getChild(FilterOp)) {
      nodes.push(string);
    }
    node = node.getChild(OrFilter);
  } while (node != null);

  return nodes;
}
