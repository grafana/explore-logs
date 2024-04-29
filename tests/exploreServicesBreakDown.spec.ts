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
});
