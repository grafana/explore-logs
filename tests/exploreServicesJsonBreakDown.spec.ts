import { expect, test } from '@grafana/plugin-e2e';
import { ExplorePage, PlaywrightRequest } from './fixtures/explore';
import { LokiQuery } from '../src/services/query';

const fieldName = 'method';
// const levelName = 'cluster'
test.describe('explore nginx-json breakdown pages ', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);
    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    await explorePage.gotoServicesBreakdown('nginx-json');
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', fieldName],
    });
    explorePage.captureConsoleLogs();
  });

  test.afterEach(async ({ page }) => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test(`should exclude ${fieldName}, request should contain json`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();

    await page.getByTestId(`data-testid Panel header ${fieldName}`).getByRole('button', { name: 'Select' }).click();
    const allPanels = explorePage.getAllPanelsLocator();
    // We should have 6 panels
    await expect(allPanels).toHaveCount(6);
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // Should be removed from the UI, and also lets us know when the query is done loading
    await expect(allPanels).toHaveCount(5);

    // Adhoc content filter should be added
    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${fieldName}`)).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr).toContain(
          `sum by (${fieldName}) (count_over_time({service_name=\`nginx-json\`}     | json | drop __error__, __error_details__ | ${fieldName}!=""`
        );
      });
    });
    expect(requests).toHaveLength(3);
  });

  test('should see too many series button', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', '_25values'],
    });
    await explorePage.goToFieldsTab();
    const showAllButtonLocator = page.getByText('Show all');
    await expect(showAllButtonLocator).toHaveCount(1);
    await expect(showAllButtonLocator).toBeVisible();

    await showAllButtonLocator.click();

    await expect(showAllButtonLocator).toHaveCount(0);
  });
});
