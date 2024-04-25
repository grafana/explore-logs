import pluginJson from '../src/plugin.json';
import { test, expect } from '@grafana/plugin-e2e';
import { ROUTES } from '../src/utils/routing';
import { ExplorePage } from './fixtures/explore';

test.describe('navigating app', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
  });

  test('explore page should render successfully', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/${ROUTES.Explore}`);
    await expect(page.getByText('Data source')).toBeVisible();
  });

  test('mega menu click should reset url params', async ({ page }) => {
    await explorePage.gotoServicesBreakdown();
    await page.getByTestId('data-testid Toggle menu').click();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/mode=start/);
  });
});
