import pluginJson from '../src/plugin.json';
import { test, expect } from '@grafana/plugin-e2e';
import { ROUTES } from '../src/utils/routing';

test.describe('navigating app', () => {
  test('explore page should render successfully', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/${ROUTES.Explore}`);
    await expect(page.getByText('Data source')).toBeVisible();
  });

  test('mega menu click should reset url params', async ({ page }) => {
    await page.goto(
      `/a/${pluginJson.id}/${ROUTES.Explore}?mode=logs&var-patterns=&var-filters=service_name%7C%3D%7Ctempo-distributor&actionView=logs&var-logsFormat=%20%7C%20logfmt`
    );
    await page.getByTestId('data-testid Toggle menu').click();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(
      `/a/${pluginJson.id}/${ROUTES.Explore}?var-fields=&var-filters=&var-ds=gdev-loki&var-patterns=&var-lineFilter=`
    );
  });
});
