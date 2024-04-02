import { createAppUrl } from './routing';

describe('createAppUrl', () => {
  it('takes in a route string and return the correct route with the base url', () => {
    const queryParams = new URLSearchParams();
    queryParams.set('dsUid', 'test');

    const result = '/a/grafana-logs-app/?dsUid=test';

    expect(createAppUrl(queryParams)).toBe(result);
  });
});
