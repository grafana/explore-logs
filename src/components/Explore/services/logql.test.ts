import { Eq, LogQL } from '@grafana/lezer-logql';

import { FilterOp, FilterType } from '../Context/QueryContext';

import { getMatcherFromQuery, getNodesFromQuery } from './logql';

const streamSelectorExpression = `{foo="bar"}`;
const streamSelectorAndLabelFilterExpression = `{foo="bar"} | baz="qux"`;

describe('logql service', () => {
  describe('getNodesFromQuery', () => {
    it('returns all nodes without a nodetype', () => {
      const expected = ['LogQL', 'Expr', 'LogExpr', 'Selector', 'Matchers', 'Matcher', 'Identifier', 'Eq', 'String'];

      expect(getNodesFromQuery(streamSelectorExpression).map((i) => i.name)).toStrictEqual(expected);
    });

    it('returns the correct position of a LogQL node', () => {
      const nodes = getNodesFromQuery(streamSelectorExpression, [LogQL]);
      expect(nodes.length).toBe(1);
      expect(nodes[0].from).toEqual(0);
      expect(nodes[0].to).toEqual(11);
    });

    it('returns the correct positions of a LogQL and Eq node', () => {
      const nodes = getNodesFromQuery(streamSelectorExpression, [LogQL, Eq]);
      expect(nodes.length).toBe(2);
      expect(nodes[0].from).toEqual(0);
      expect(nodes[0].to).toEqual(11);

      expect(nodes[1].from).toEqual(4);
      expect(nodes[1].to).toEqual(5);
    });
  });

  describe('getMatcherFromQuery', () => {
    it.each([
      [streamSelectorExpression, [{ key: 'foo', values: ['bar'], type: FilterType.IndexedLabel, op: FilterOp.Equal }]],
      [
        streamSelectorAndLabelFilterExpression,
        [
          { key: 'foo', values: ['bar'], type: FilterType.IndexedLabel, op: FilterOp.Equal },
          { key: 'baz', values: ['qux'], type: FilterType.NonIndexedLabel, op: FilterOp.Equal },
        ],
      ],
      [
        `{foo="bar", baz="qux"}`,
        [
          { key: 'foo', values: ['bar'], type: FilterType.IndexedLabel, op: FilterOp.Equal },
          { key: 'baz', values: ['qux'], type: FilterType.IndexedLabel, op: FilterOp.Equal },
        ],
      ],
      [
        `{foo="bar", baz=!"qux"}`,
        [
          { key: 'foo', values: ['bar'], type: FilterType.IndexedLabel, op: FilterOp.Equal },
          { key: 'baz', values: ['qux'], type: FilterType.IndexedLabel, op: FilterOp.NotEqual },
        ],
      ],
    ])('returns the filters from an easy stream selector', (query, expected) => {
      expect(getMatcherFromQuery(query)).toStrictEqual(expected);
    });
  });
});
