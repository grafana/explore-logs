// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!

import {
  Eq,
  FilterOp,
  Gte,
  Gtr,
  Identifier,
  LabelFilter,
  LineFilter,
  Lss,
  Lte,
  Matcher,
  Neq,
  Nre,
  NumberFilter,
  OrFilter,
  parser,
  PipeExact,
  PipeMatch,
  Re,
  Selector,
  String,
} from '@grafana/lezer-logql';
import { NodeType, SyntaxNode, Tree } from '@lezer/common';
import {
  FieldFilter,
  FilterOp as FilterOperator,
  IndexedLabelFilter,
  LineFilterCaseSensitive,
  LineFilterOp,
  LineFilterType,
} from './filterTypes';
import { FieldType, PluginExtensionPanelContext } from '@grafana/data';
import { getLabelTypeFromFrame, LabelType, LokiQuery } from './lokiQuery';

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

function parseLabelFilters(selector: SyntaxNode[], query: string, filter: IndexedLabelFilter[]) {
  const selectorPosition = NodePosition.fromNode(selector[0]);

  const allMatcher = getNodesFromQuery(query, [Matcher]);
  for (const matcher of allMatcher) {
    const matcherPosition = NodePosition.fromNode(matcher);
    const identifierPosition = getAllPositionsInNodeByType(matcher, Identifier);
    const valuePosition = getAllPositionsInNodeByType(matcher, String);
    const operation = query.substring(identifierPosition[0].to, valuePosition[0].from);
    const op = operation === '=' ? FilterOperator.Equal : FilterOperator.NotEqual;
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

function parseFields(query: string, fields: FieldFilter[], context: PluginExtensionPanelContext, lokiQuery: LokiQuery) {
  const frame = context.data?.series.find((frame) => frame.refId === lokiQuery.refId);
  const labels = frame?.fields.find((field) => field.type === FieldType.other && field.name === 'labels');
  const allFields = getNodesFromQuery(query, [LabelFilter]);

  for (const matcher of allFields) {
    const position = NodePosition.fromNode(matcher);
    const expression = position.getExpression(query);

    if (expression.substring(0, 9) === `__error__`) {
      console.log('skipping error expression');
      continue;
    }

    const numberFilter = getAllPositionsInNodeByType(matcher, NumberFilter); // bytes, duration or float
    if (numberFilter.length) {
      const lte = getAllPositionsInNodeByType(matcher, Lte); // <=
      const lss = getAllPositionsInNodeByType(matcher, Lss); // <
      const gte = getAllPositionsInNodeByType(matcher, Gte); // >=
      const gtr = getAllPositionsInNodeByType(matcher, Gtr); // >

      console.log('number position', {
        position,
        expression,
        lte,
        lss,
        gte,
        gtr,
        numberFilter,
      });
    } else {
      // Operator
      let operator;
      if (getAllPositionsInNodeByType(matcher, Eq).length) {
        // =
        operator = FilterOperator.Equal;
      } else if (getAllPositionsInNodeByType(matcher, Neq).length) {
        // !=
        operator = FilterOperator.NotEqual;
      } else if (getAllPositionsInNodeByType(matcher, Re).length) {
        // =~
        console.warn('field regex not currently supported');
      } else if (getAllPositionsInNodeByType(matcher, Nre).length) {
        // !~
        console.warn('field exclusive regex not currently supported');
      }

      // field filter key
      const fieldNameNode = getAllPositionsInNodeByType(matcher, Identifier)[0];
      const fieldName = fieldNameNode?.getExpression(query);

      // field filter value
      const fieldValueNode = getAllPositionsInNodeByType(matcher, String)[0];
      // @todo do double-quotes vs back-ticks change anything?
      const fieldValue = query.substring(fieldValueNode.from + 1, fieldValueNode.to - 1);

      // Label type
      let labelType;
      if (frame) {
        // @todo if the label is not in the first line we'll fall back to mixed field which will negatively impact query performance
        // Also negative filters that exclude all values of a field will always fail
        labelType = getLabelTypeFromFrame(fieldName, frame);
      }

      if (operator) {
        fields.push({
          key: fieldName,
          operator: operator,
          type: labelType ?? LabelType.Parsed,
          value: fieldValue,
        });
      }

      console.log('field position', {
        position,
        expression,
        labelType,
        labels,
        fields,
        fieldName,
        fieldValue,
      });
    }
  }
}

export function getMatcherFromQuery(
  query: string,
  context: PluginExtensionPanelContext,
  lokiQuery: LokiQuery
): { labelFilters: IndexedLabelFilter[]; lineFilters?: LineFilterType[]; fields?: FieldFilter[] } {
  const filter: IndexedLabelFilter[] = [];
  const lineFilters: LineFilterType[] = [];
  const fields: FieldFilter[] = [];
  const selector = getNodesFromQuery(query, [Selector]);
  if (selector.length === 0) {
    return { labelFilters: filter };
  }

  parseLabelFilters(selector, query, filter);
  parseLineFilters(query, lineFilters);
  parseFields(query, fields, context, lokiQuery);

  return { labelFilters: filter, lineFilters, fields };
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
