import pluginJson from '../src/plugin.json';
import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import { ROUTES } from '../src/services/routing';

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
    await page.getByLabel('Tab Labels').click();
    await page.getByLabel('namespace').click();
    await page
      .getByTestId('data-testid Panel header tempo-dev')
      .getByRole('button', { name: 'Add to filters' })
      .click();
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label namespace')).toBeVisible();
    const page1Promise = page.waitForEvent('popup');
    await explorePage.serviceBreakdownOpenExplore.click();
    const page1 = await page1Promise;
    await expect(page1.getByText('{service_name=`tempo-distributor`}')).toBeVisible();
  });

  test('should select a detected field, update filters, open log panel', async ({ page }) => {
    await page.getByLabel('Tab Detected fields').click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Add to filters' }).nth(0).click();
    // Should see the logs panel full of errors
    await expect(page.getByTestId('data-testid search-logs')).toBeVisible();
    // Adhoc err filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label err')).toBeVisible();
  });

  test('should select a pattern field, update filters, open log panel', async ({ page }) => {
    await page.getByLabel('Tab Patterns').click();
    await page
      .getByTestId('data-testid Panel header level=info <_> caller=flush.go:253 msg="completing block" <_>')
      .getByRole('button', { name: 'Add to filters' })
      .click();
    // Should see the logs panel full of patterns
    await expect(page.getByTestId('data-testid search-logs')).toBeVisible();
    // Pattern filter should be added
    await expect(page.getByText('Patterns', { exact: true })).toBeVisible();
    await expect(page.getByText('level=info < … g block" <_>')).toBeVisible();
  });

  test('patterns should be lazy loaded', async ({ page }) => {
    await page.getByLabel('Tab Patterns').click();
    const addToFilterButtons = page
        .getByRole('button', { name: 'Add to filters' })

    // Only the first 4 patterns are visible above the fold
    await expect(addToFilterButtons).toHaveCount(4)

    page.mouse.wheel(0, 600)

    // Fake data only generates 8 patterns, they should all be rendered after scrolling down a bit
    await expect(addToFilterButtons).toHaveCount(8)
  });

  test('should update a filter and run new logs', async ({ page }) => {
    await page.getByTestId('AdHocFilter-service_name').getByRole('img').nth(1).click();
    await page.getByText('mimir-distributor').click();

    // open logs panel
    await page.getByTitle('See log details').nth(1).click();

    // find text corresponding text to match adhoc filter
    await expect(page.getByTestId('data-testid Panel header Logs').getByText('mimir-distributor').nth(0)).toBeVisible();
  });
});
