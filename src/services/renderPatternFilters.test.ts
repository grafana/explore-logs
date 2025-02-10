import { renderPatternFilters } from './renderPatternFilters';

describe('renderPatternFilters', () => {
  it('returns empty string if no patterns', () => {
    expect(renderPatternFilters([])).toEqual('');
  });
  it('wraps in double quotes', () => {
    expect(
      renderPatternFilters([
        {
          pattern: 'level=info ts=<_> msg="completing block"',
          type: 'include',
        },
      ])
    ).toEqual(`|> "level=info ts=<_> msg=\\"completing block\\""`);
  });
  it('ignores backticks', () => {
    expect(
      renderPatternFilters([
        {
          pattern:
            'logger=sqlstore.metrics traceID=<_> msg="query finished" sql="INSERT INTO instance (`org_id`, `result`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `org_id`=VALUES(`org_id`)" error=null',
          type: 'include',
        },
      ])
    ).toEqual(
      `|> "logger=sqlstore.metrics traceID=<_> msg=\\"query finished\\" sql=\\"INSERT INTO instance (\`org_id\`, \`result\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`org_id\`=VALUES(\`org_id\`)\\" error=null"`
    );
  });
  it('handles "or"', () => {
    expect(
      renderPatternFilters([
        {
          pattern: 'logger=sqlstore.metrics traceID=<_> error=null',
          type: 'include',
        },
        {
          pattern: 'logger=sqlstore.metrics `org_id`=VALUES(`org_id`)" error=null',
          type: 'include',
        },
      ])
    ).toEqual(
      `|> "logger=sqlstore.metrics traceID=<_> error=null" or "logger=sqlstore.metrics \`org_id\`=VALUES(\`org_id\`)\\" error=null"`
    );
  });
  it('handles exclusion', () => {
    expect(
      renderPatternFilters([
        {
          pattern: 'logger=sqlstore.metrics traceID=<_> error=null',
          type: 'exclude',
        },
        {
          pattern: 'logger=sqlstore.metrics `org_id`=VALUES(`org_id`)" error=null',
          type: 'exclude',
        },
      ])
    ).toEqual(
      `!> "logger=sqlstore.metrics traceID=<_> error=null" !> "logger=sqlstore.metrics \`org_id\`=VALUES(\`org_id\`)\\" error=null"`
    );
  });
});
