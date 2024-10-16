import pluginJson from '../src/plugin.json';
import { expect, test } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';

test.describe('navigating app', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    await page.evaluate(() => window.localStorage.clear());
    explorePage = new ExplorePage(page, testInfo);
  });

  test('explore page should render successfully', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/explore`);
    await expect(page.getByText('Data source')).toBeVisible();
  });

  test('mega menu click should reset url params (deprecated url)', async ({ page }) => {
    await explorePage.gotoServicesBreakdownOldUrl();
    await page.getByTestId('data-testid Toggle menu').click();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/a\/grafana\-lokiexplore\-app\/explore\?patterns\=%5B%5D/);
    await expect(page).toHaveURL(/var-primary_label=service_name/);
    const actualSearchParams = new URLSearchParams(page.url().split('?')[1]);
    const expectedSearchParams = new URLSearchParams(
      '?patterns=%5B%5D&from=now-15m&to=now&var-ds=gdev-loki&var-filters=&var-fields=&var-levels=&var-patterns=&var-lineFilter=&var-metadata=&refresh=&var-primary_label=service_name%7C%3D~%7C.%2B'
    );
    actualSearchParams.sort();
    expectedSearchParams.sort();
    expect(actualSearchParams.toString()).toEqual(expectedSearchParams.toString());
  });

  test('mega menu click should reset url params after visiting homepage', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/explore`);
    await explorePage.addServiceName();
    await page.getByTestId('data-testid Toggle menu').click();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/a\/grafana\-lokiexplore\-app\/explore\?patterns\=%5B%5D/);
    const actualSearchParams = new URLSearchParams(page.url().split('?')[1]);
    const expectedSearchParams = new URLSearchParams(
      '?patterns=%5B%5D&from=now-15m&to=now&var-ds=gdev-loki&var-filters=&var-fields=&var-levels=&var-patterns=&var-lineFilter=&var-metadata=&refresh=&var-primary_label=service_name%7C%3D~%7C.%2B'
    );
    actualSearchParams.sort();
    expectedSearchParams.sort();
    expect(actualSearchParams.toString()).toEqual(expectedSearchParams.toString());
  });
});
