import { buildLokiQuery } from './query';

test('Given an expression outputs a Loki query', () => {
  expect(buildLokiQuery('{place="luna"}')).toEqual({
    editorMode: 'code',
    expr: '{place="luna"}',
    queryType: 'range',
    refId: 'A',
    supportingQueryType: 'grafana-lokiexplore-app',
  });
});

test('Given an expression and overrides outputs a Loki query', () => {
  expect(buildLokiQuery('{place="luna"}', { editorMode: 'gpt', refId: 'C' })).toEqual({
    editorMode: 'gpt',
    expr: '{place="luna"}',
    queryType: 'range',
    refId: 'C',
    supportingQueryType: 'grafana-lokiexplore-app',
  });
});
