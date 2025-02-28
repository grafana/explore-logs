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
    await page.getByLabel('Open menu').click();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/a\/grafana\-lokiexplore\-app\/explore\?patterns\=%5B%5D/);
    await expect(page).toHaveURL(/var-primary_label=service_name/);
    await expect(page.getByTestId('data-testid Show logs').first()).toHaveCount(1);

    // assert panels are showing
    const actualSearchParams = new URLSearchParams(page.url().split('?')[1]);
    const expectedSearchParams = new URLSearchParams(
      '?patterns=%5B%5D&from=now-15m&to=now&var-all-fields=&var-ds=gdev-loki&var-filters=&var-fields=&var-levels=&var-patterns=&var-lineFilterV2=&var-lineFilters=&var-metadata=&timezone=browser&var-primary_label=service_name%7C%3D~%7C.%2B'
    );
    actualSearchParams.sort();
    expectedSearchParams.sort();
    expect(actualSearchParams.toString()).toEqual(expectedSearchParams.toString());
  });

  // Looks like mega menu clicks no longer trigger navigation, so whatever scene state is persisted after clicking on mega menu
  test('mega menu click should persist url params', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/explore`);

    // Filter results to tempo-ingester to prevent flake
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('Tempo-i');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'tempo-ingester' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'tempo-distributor' })).not.toBeVisible();

    await explorePage.addServiceName();
    await page.getByLabel('Open menu').click();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/a\/grafana\-lokiexplore\-app\/explore\?patterns\=%5B%5D/);

    // assert panels are showing
    await expect(page.getByTestId('data-testid Show logs').first()).toHaveCount(1);
    const actualSearchParams = new URLSearchParams(page.url().split('?')[1]);
    const expectedSearchParams = new URLSearchParams(
      '?patterns=%5B%5D&from=now-15m&to=now&var-all-fields=&var-ds=gdev-loki&var-filters=&var-fields=&var-filters_replica=&var-levels=&var-patterns=&var-lineFilterV2=&var-lineFilters=&var-metadata=&timezone=browser&var-primary_label=service_name%7C%3D~%7C%28%3Fi%29.%2ATempo-i.%2A'
    );
    actualSearchParams.sort();
    expectedSearchParams.sort();
    expect(actualSearchParams.toString()).toEqual(expectedSearchParams.toString());
  });
});
