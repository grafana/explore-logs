import { expect, test } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import { testIds } from "../src/services/testIds";

test.describe('explore services breakdown page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
    await explorePage.gotoServicesBreakdown();
  });

  test('should filter logs panel on search', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(page.getByRole('table').locator('tr').first().getByText('broadcast')).toBeVisible();
    await expect(page).toHaveURL(/broadcast/);
  });

  test('should select a label, update filters, open in explore', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await page.getByLabel('Select detected_level').click();
    await page.getByTestId('data-testid Panel header info').getByRole('button', { name: 'Include' }).click();
    await expect(
      page.getByTestId('data-testid Dashboard template variables submenu Label detected_level')
    ).toBeVisible();
    const page1Promise = page.waitForEvent('popup');
    await explorePage.serviceBreakdownOpenExplore.click();
    const page1 = await page1Promise;
    await expect(page1.getByText('{service_name=`tempo-distributor`}')).toBeVisible();
  });

  test('should select a detected field, update filters, open log panel', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabDetectedFields).click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    // Should see the logs panel full of errors
    await expect(page.getByTestId(testIds.exploreServiceDetails.searchLogs)).toBeVisible();
    // Adhoc err filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label err')).toBeVisible();
  });

  test('should select an include pattern field in default single view, update filters, not open log panel', async ({
    page,
  }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    // Include pattern
    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    await firstIncludeButton.click();
    // Should not open logs panel and should stay in patterns tab as we allow multiple  patterns
    await expect(page.getByTestId(testIds.exploreServiceDetails.searchLogs)).not.toBeVisible();
    await expect(page.getByTestId(testIds.patterns.tableWrapper)).toBeVisible();
    // Pattern filter should be added
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
  });

  test('Should add multiple exclude patterns, which are replaced by include pattern', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const firstExcludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterExclude);

    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).toBeVisible();

    // Include pattern
    await firstExcludeButton.click();

    // Both buttons should be visible
    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).toBeVisible();

    const secondExcludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(3)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterExclude);
    await secondExcludeButton.click();

    // Both exclude patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).not.toBeVisible();
    await expect(page.getByTestId(testIds.patterns.buttonExcludedPattern)).toBeVisible();


    await firstIncludeButton.click();
    // Include and exclude patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
    await expect(page.getByTestId(testIds.patterns.buttonExcludedPattern)).toBeVisible();
  });

  test('Should add multiple include patterns', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const secondIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(3)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);

    await expect(firstIncludeButton).toBeVisible();
    await expect(secondIncludeButton).toBeVisible();

    // Include pattern
    await firstIncludeButton.click();


    // Both buttons should be visible
    await expect(firstIncludeButton).toBeVisible();
    await expect(secondIncludeButton).toBeVisible();

    await secondIncludeButton.click();

    // Both include patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonRemovePattern).nth(0)).toBeVisible();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonRemovePattern).nth(1)).toBeVisible();
  });

  test('should update a filter and run new logs', async ({ page }) => {
    await page.getByTestId('AdHocFilter-service_name').getByRole('img').nth(1).click();
    await page.getByText('mimir-distributor').click();

    // open logs panel
    await page.getByTitle('See log details').nth(1).click();

    // find text corresponding text to match adhoc filter
    await expect(
      page.getByRole('cell', { name: 'Fields Ad-hoc statistics' }).getByText('mimir-distributor').nth(0)
    ).toBeVisible();
  });
});
