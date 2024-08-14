import pluginJson from '../src/plugin.json';
import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';

test.describe('navigating app', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => window.localStorage.clear());
    explorePage = new ExplorePage(page);
  });

  test('explore page should render successfully', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/explore`);
    await expect(page.getByText('Data source')).toBeVisible();
  });

  test('mega menu click should reset url params', async ({ page }) => {
    await explorePage.gotoServicesBreakdown();
    await page.getByTestId('data-testid Toggle menu').click();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/a\/grafana\-lokiexplore\-app\/explore\?patterns\=%5B%5D&var\-ds\=gdev\-loki&var\-patterns\=&var\-lineFilter\=&var\-logsFormat\=/);
  });
});
