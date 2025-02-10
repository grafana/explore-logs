// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!

import {
  Bytes,
  Duration,
  Eq,
  FilterOp,
  Gte,
  Gtr,
  Identifier,
  Json,
  LabelFilter,
  LineFilter,
  Logfmt,
  Lss,
  Lte,
  Matcher,
  Neq,
  Npa,
  Nre,
  Number,
  OrFilter,
  parser,
  PipeExact,
  PipeMatch,
  PipePattern,
  Re,
  Selector,
  String,
} from '@grafana/lezer-logql';
import { NodeType, SyntaxNode, Tree } from '@lezer/common';
import {
  FieldFilter,
  FilterOp as FilterOperator,
  FilterOpType,
  IndexedLabelFilter,
  LineFilterCaseSensitive,
  LineFilterOp,
  LineFilterType,
  PatternFilterOp,
  PatternFilterType,
} from './filterTypes';
import { PluginExtensionPanelContext } from '@grafana/data';
import { getLabelTypeFromFrame, LokiQuery } from './lokiQuery';
import { LabelType } from './fieldsTypes';
import { ParserType } from './variables';

export class NodePosition {
  from: number;
  to: number;
  type?: NodeType;
  syntaxNode?: SyntaxNode;

  constructor(from: number, to: number, syntaxNode?: SyntaxNode, type?: NodeType) {
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

/**
 * Returns the leaf nodes on the left-hand-side matching nodeTypes
 * @param query
 * @param nodeTypes
 */
export function getLHSLeafNodesFromQuery(query: string, nodeTypes: number[]): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  const tree: Tree = parser.parse(query);

  tree.iterate({
    enter: (node): false | void => {
      if (nodeTypes.includes(node.type.id)) {
        let leftChild: SyntaxNode | null;
        while ((leftChild = node.node.firstChild) !== null) {
          if (!nodeTypes.includes(leftChild.node.type.id)) {
            nodes.push(node.node);
            return false;
          }
          node = leftChild;
        }
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

function parseLabelFilters(query: string, filter: IndexedLabelFilter[]) {
  // `Matcher` will select field filters as well as indexed label filters
  const allMatcher = getNodesFromQuery(query, [Matcher]);
  for (const matcher of allMatcher) {
    const identifierPosition = getAllPositionsInNodeByType(matcher, Identifier);
    const valuePosition = getAllPositionsInNodeByType(matcher, String);
    const operator = query.substring(identifierPosition[0]?.to, valuePosition[0]?.from);
    const key = identifierPosition[0].getExpression(query);
    const value = valuePosition.map((position) => query.substring(position.from + 1, position.to - 1))[0];

    if (
      !key ||
      !value ||
      (operator !== FilterOperator.NotEqual &&
        operator !== FilterOperator.Equal &&
        operator !== FilterOperator.RegexEqual &&
        operator !== FilterOperator.RegexNotEqual)
    ) {
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

function parseNonPatternFilters(
  lineFilterValue: string,
  quoteString: string,
  lineFilters: LineFilterType[],
  index: number,
  operator: LineFilterOp
) {
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

  return lineFilterValue;
}

function parsePatternFilters(lineFilterValue: string, patternFilters: PatternFilterType[], operator: PatternFilterOp) {
  const replaceDoubleQuoteEscape = new RegExp(/\\"/, 'g');
  lineFilterValue = lineFilterValue.replace(replaceDoubleQuoteEscape, '"');
  patternFilters.push({
    operator,
    value: lineFilterValue,
  });
}

function parseLineFilters(query: string, lineFilters: LineFilterType[], patternFilters: PatternFilterType[]) {
  const allLineFilters = getNodesFromQuery(query, [LineFilter]);
  for (const [index, matcher] of allLineFilters.entries()) {
    const equal = getAllPositionsInNodeByType(matcher, PipeExact);
    const pipeRegExp = getAllPositionsInNodeByType(matcher, PipeMatch);
    const notEqual = getAllPositionsInNodeByType(matcher, Neq);
    const notEqualRegExp = getAllPositionsInNodeByType(matcher, Nre);
    const patternInclude = getAllPositionsInNodeByType(matcher, PipePattern);
    const patternExclude = getAllPositionsInNodeByType(matcher, Npa);

    const lineFilterValueNodes = getStringsFromLineFilter(matcher);

    for (const lineFilterValueNode of lineFilterValueNodes) {
      const quoteString = query.substring(lineFilterValueNode?.from + 1, lineFilterValueNode?.from);

      // Remove quotes
      let lineFilterValue = query.substring(lineFilterValueNode?.from + 1, lineFilterValueNode?.to - 1);

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
        } else if (patternInclude.length) {
          operator = PatternFilterOp.match;
        } else if (patternExclude.length) {
          operator = PatternFilterOp.negativeMatch;
        } else {
          console.warn('unknown line filter', {
            query: query.substring(matcher.from, matcher.to),
          });

          continue;
        }

        if (!(operator === PatternFilterOp.match || operator === PatternFilterOp.negativeMatch)) {
          parseNonPatternFilters(lineFilterValue, quoteString, lineFilters, index, operator);
        } else {
          parsePatternFilters(lineFilterValue, patternFilters, operator);
        }
      }
    }
  }
}

function getNumericFieldOperator(matcher: SyntaxNode) {
  if (getAllPositionsInNodeByType(matcher, Lte).length) {
    return FilterOperator.lte;
  } else if (getAllPositionsInNodeByType(matcher, Lss).length) {
    return FilterOperator.lt;
  } else if (getAllPositionsInNodeByType(matcher, Gte).length) {
    return FilterOperator.gte;
  } else if (getAllPositionsInNodeByType(matcher, Gtr).length) {
    return FilterOperator.gt;
  }

  console.warn('unknown numeric operator');

  return undefined;
}

function getStringFieldOperator(matcher: SyntaxNode) {
  if (getAllPositionsInNodeByType(matcher, Eq).length) {
    return FilterOperator.Equal; // =
  } else if (getAllPositionsInNodeByType(matcher, Neq).length) {
    return FilterOperator.NotEqual; // !=
  } else if (getAllPositionsInNodeByType(matcher, Re).length) {
    return FilterOperator.RegexEqual; // =~
  } else if (getAllPositionsInNodeByType(matcher, Nre).length) {
    return FilterOperator.RegexNotEqual; // !~
  }

  return undefined;
}

function parseFields(query: string, fields: FieldFilter[], context: PluginExtensionPanelContext, lokiQuery: LokiQuery) {
  const dataFrame = context.data?.series.find((frame) => frame.refId === lokiQuery.refId);
  // We do not currently support "or" in Logs Drilldown, so grab the left hand side LabelFilter leaf nodes as this will be the first filter expression in a given pipeline stage
  const allFields = getLHSLeafNodesFromQuery(query, [LabelFilter]);

  for (const matcher of allFields) {
    const position = NodePosition.fromNode(matcher);
    const expression = position.getExpression(query);

    // Skip error expression, it will get added automatically when logs drilldown adds a parser
    if (expression.substring(0, 9) === `__error__`) {
      continue;
    }

    // @todo we need to use detected_fields API to get the "right" parser for a specific field
    // Currently we just check to see if there is a parser before the current node, this means that queries that are placing metadata filters after the parser will query the metadata field as a parsed field, which will lead to degraded performance
    const logFmtParser = getNodesFromQuery(query.substring(0, matcher.node.to), [Logfmt]);
    const jsonParser = getNodesFromQuery(query.substring(0, matcher.node.to), [Json]);

    // field filter key
    const fieldNameNode = getAllPositionsInNodeByType(matcher, Identifier);
    const fieldName = fieldNameNode[0]?.getExpression(query);

    // field filter value
    const fieldStringValue = getAllPositionsInNodeByType(matcher, String);
    const fieldNumberValue = getAllPositionsInNodeByType(matcher, Number);
    const fieldBytesValue = getAllPositionsInNodeByType(matcher, Bytes);
    const fieldDurationValue = getAllPositionsInNodeByType(matcher, Duration);

    let fieldValue: string, operator: FilterOpType | undefined;
    if (fieldStringValue.length) {
      operator = getStringFieldOperator(matcher);
      // Strip out quotes
      fieldValue = query.substring(fieldStringValue[0].from + 1, fieldStringValue[0].to - 1);
    } else if (fieldNumberValue.length) {
      fieldValue = fieldNumberValue[0].getExpression(query);
      operator = getNumericFieldOperator(matcher);
    } else if (fieldDurationValue.length) {
      operator = getNumericFieldOperator(matcher);
      fieldValue = fieldDurationValue[0].getExpression(query);
    } else if (fieldBytesValue.length) {
      operator = getNumericFieldOperator(matcher);
      fieldValue = fieldBytesValue[0].getExpression(query);
    } else {
      continue;
    }

    // Label type
    let labelType: LabelType | undefined;
    if (dataFrame) {
      // @todo if the field label is not in the first line, we'll always add this filter as a field filter
      // Also negative filters that exclude all values of a field will always fail to get a label type for that exclusion filter?
      labelType = getLabelTypeFromFrame(fieldName, dataFrame) ?? undefined;
    }

    if (operator) {
      let parser: ParserType | undefined;
      if (logFmtParser.length && jsonParser.length) {
        parser = 'mixed';
      } else if (logFmtParser.length) {
        parser = 'logfmt';
      } else if (jsonParser.length) {
        parser = 'json';
      } else {
        // If there is no parser in the query, the field would have to be metadata or an invalid query?
        labelType = LabelType.StructuredMetadata;
      }

      fields.push({
        key: fieldName,
        operator: operator,
        type: labelType ?? LabelType.Parsed,
        parser,
        value: fieldValue,
      });
    }
  }
}

export function getMatcherFromQuery(
  query: string,
  context: PluginExtensionPanelContext,
  lokiQuery: LokiQuery
): {
  labelFilters: IndexedLabelFilter[];
  lineFilters?: LineFilterType[];
  fields?: FieldFilter[];
  patternFilters?: PatternFilterType[];
} {
  const filter: IndexedLabelFilter[] = [];
  const lineFilters: LineFilterType[] = [];
  const patternFilters: PatternFilterType[] = [];
  const fields: FieldFilter[] = [];
  const selector = getNodesFromQuery(query, [Selector]);

  if (selector.length === 0) {
    return { labelFilters: filter };
  }

  // Get the stream selector portion of the query
  const selectorQuery = getAllPositionsInNodeByType(selector[0], Selector)[0].getExpression(query);

  parseLabelFilters(selectorQuery, filter);
  parseLineFilters(query, lineFilters, patternFilters);
  parseFields(query, fields, context, lokiQuery);

  return { labelFilters: filter, lineFilters, fields, patternFilters };
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
