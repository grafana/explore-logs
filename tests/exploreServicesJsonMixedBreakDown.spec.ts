import { expect, test } from '@grafana/plugin-e2e';
import { E2EComboboxStrings, ExplorePage, PlaywrightRequest } from './fixtures/explore';

import { LokiQuery } from '../src/services/lokiQuery';

const mixedFieldName = 'method';
const logFmtFieldName = 'caller';
const jsonFmtFieldName = 'status';
const metadataFieldName = 'pod';
const serviceName = 'nginx-json-mixed';
// const levelName = 'cluster'
test.describe('explore nginx-json-mixed breakdown pages ', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);
    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    await explorePage.gotoServicesBreakdownOldUrl(serviceName);
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', mixedFieldName],
    });
  });

  test.afterEach(async ({ page }) => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test(`should exclude ${mixedFieldName}, request should contain both parsers`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [mixedFieldName],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();

    await page
      .getByTestId(`data-testid Panel header ${mixedFieldName}`)
      .getByRole('button', { name: 'Select' })
      .click();
    const allPanels = explorePage.getAllPanelsLocator();
    // We should have 6 panels
    await expect(allPanels).toHaveCount(7);
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // Should be removed from the UI, and also lets us know when the query is done loading
    await expect(allPanels).toHaveCount(6);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(mixedFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr).toContain(
          `sum by (${mixedFieldName}) (count_over_time({service_name="${serviceName}"}      | json | logfmt | drop __error__, __error_details__ | ${mixedFieldName}!=""`
        );
      });
    });
    expect(requests).toHaveLength(3);
  });
  test(`should exclude ${logFmtFieldName}, request should contain logfmt`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [logFmtFieldName],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();
    const allPanels = explorePage.getAllPanelsLocator();

    // Should be 16 fields coming back from the detected_fields, but one is detected_level
    await expect(allPanels).toHaveCount(16);

    await page
      .getByTestId(`data-testid Panel header ${logFmtFieldName}`)
      .getByRole('button', { name: 'Select' })
      .click();

    // We should have 2 panels for 1 field value
    await expect(allPanels).toHaveCount(2);
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // There is only one panel/value, so we should be redirected back to the aggregation after excluding it
    // We'll have all 12 responses from detected_fields
    await expect(allPanels).toHaveCount(13);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(logFmtFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    requests.forEach((req, index) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        if (index < 2) {
          expect(query.expr).toContain(
            `sum by (${logFmtFieldName}) (count_over_time({service_name="${serviceName}"}      | logfmt | ${logFmtFieldName}!=""  [$__auto]))`
          );
        }
        if (index >= 2) {
          expect(query.expr).toContain(
            `sum by (${logFmtFieldName}) (count_over_time({service_name="${serviceName}"}      | logfmt | ${logFmtFieldName}!="" | caller!="flush.go:253" [$__auto]))`
          );
        }
      });
    });

    expect(requests.length).toBeGreaterThanOrEqual(3);
  });

  test(`should exclude ${jsonFmtFieldName}, request should contain logfmt`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [jsonFmtFieldName],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();

    await page
      .getByTestId(`data-testid Panel header ${jsonFmtFieldName}`)
      .getByRole('button', { name: 'Select' })
      .click();
    const allPanels = explorePage.getAllPanelsLocator();
    // We should have 4 panels
    await expect(allPanels).toHaveCount(4);
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // Should be removed from the UI, and also lets us know when the query is done loading
    await expect(allPanels).toHaveCount(3);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(jsonFmtFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr).toContain(
          `sum by (${jsonFmtFieldName}) (count_over_time({service_name="${serviceName}"}      | json | drop __error__, __error_details__ | ${jsonFmtFieldName}!=""`
        );
      });
    });
    expect(requests).toHaveLength(3);
  });
  test(`should exclude ${metadataFieldName}, request should contain no parser`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [metadataFieldName],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();

    await page
      .getByTestId(`data-testid Panel header ${metadataFieldName}`)
      .getByRole('button', { name: 'Select' })
      .click();
    const allPanels = explorePage.getAllPanelsLocator();
    // We should have more than 1 panels
    await expect.poll(() => allPanels.count()).toBeGreaterThanOrEqual(4);
    const actualCount = await allPanels.count();
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    await expect.poll(() => allPanels.count()).toBeGreaterThanOrEqual(actualCount - 1);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(metadataFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    await expect.poll(() => requests).toHaveLength(3);

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr).toContain(
          `sum by (${metadataFieldName}) (count_over_time({service_name="${serviceName}"} | ${metadataFieldName}!=""`
        );
      });
    });
  });
});
