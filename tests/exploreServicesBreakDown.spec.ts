import pluginJson from '../src/plugin.json';
import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import { ROUTES } from '../src/utils/routing';

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
    await expect(page).toHaveURL(
      `/a/${pluginJson.id}/${ROUTES.Explore}?mode=logs&var-patterns=&var-filters=service_name%7C%3D%7Ctempo-distributor&actionView=logs&var-logsFormat=%20%7C%20logfmt&var-fields=&var-ds=gdev-loki&var-lineFilter=%7C%3D%20%60broadcast%60`
    );
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
