import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import { testIds } from "../src/services/testIds";
import { mockVolumeApiResponse } from "./mocks/mockVolumeApiResponse";

test.describe('explore services page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
    await page.evaluate(() => window.localStorage.clear());
    await explorePage.gotoServices();
  });

  test('should filter service labels on search', async ({ page }) => {
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('mimir');
    // service name should be in time series panel
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(0)).toBeVisible();
    // service name should also be in logs panel, just not visible to the user
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(1)).toBeVisible();

    // Exit out of the dropdown
    await page.keyboard.press('Escape');
    // Only the first title is visible
    await expect(page.getByText('mimir-ingester').nth(0)).toBeVisible()
    await expect(page.getByText('mimir-ingester').nth(1)).not.toBeVisible()
    await expect(page.getByText('Showing 4 services')).toBeVisible();
  });

  test('should filter service labels on exact search', async ({ page }) => {
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('mimir-ingester');
    // service name should be in time series panel
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(0)).toBeVisible();
    // service name should also be in logs panel, just not visible to the user
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(1)).toBeVisible();

    // Exit out of the dropdown
    await page.keyboard.press('Escape');
    // The matched string should exist in the search dropdown
    await expect(page.getByText('mimir-ingester').nth(0)).toBeVisible()
    // And the panel title
    await expect(page.getByText('mimir-ingester').nth(1)).toBeVisible()
    // And the logs panel title should be hidden
    await expect(page.getByText('mimir-ingester').nth(2)).not.toBeVisible()
    await expect(page.getByText('Showing 1 service')).toBeVisible();
  });

  test('should filter service labels on partial string', async ({ page }) => {
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('imi');
    // service name should be in time series panel
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(0)).toBeVisible();
    // service name should also be in logs panel, just not visible to the user
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(1)).toBeVisible();

    // Exit out of the dropdown
    await page.keyboard.press('Escape');
    // Only the first title is visible
    await expect(page.getByText('mimir-ingester').nth(0)).toBeVisible()
    await expect(page.getByText('mimir-ingester').nth(1)).not.toBeVisible()
    await expect(page.getByText('Showing 4 services')).toBeVisible();
  });

  test('should select a service label value and navigate to log view', async ({ page }) => {
    await explorePage.addServiceName();
    await expect(explorePage.logVolumeGraph).toBeVisible();
  });

  test('should filter logs by clicking on the chart levels', async ({ page }) => {
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('tempo-distributor');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Showing 1 service')).toBeVisible();
    await expect(page.getByText(/level=info/).first()).toBeVisible();
    await page.getByTitle('debug').first().click();
    await expect(page.getByText(/level=debug/).first()).toBeVisible();
    await expect(page.getByText(/level=info/)).not.toBeVisible();
  });

  test.describe('mock volume API calls', () => {
    let logsVolumeCount: number, logsQueryCount: number;

    test.beforeEach(async ({page}) => {
      logsVolumeCount = 0;
      logsQueryCount = 0;

      await page.route('**/index/volume*', async route => {
        const volumeResponse = mockVolumeApiResponse;
        logsVolumeCount++

        await route.fulfill({json: volumeResponse})
      })

      await page.route('**/ds/query*', async route => {
        logsQueryCount++
        await route.continue()
      })

      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('index/volume')),
        page.waitForResponse(resp => resp.url().includes('ds/query')),
      ]);
    })

    test('refreshing time range should request panel data once', async ({page}) => {
      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(4)
      await explorePage.refreshPicker.click()
      await explorePage.refreshPicker.click()
      await explorePage.refreshPicker.click()
      expect(logsVolumeCount).toEqual(4)
      expect(logsQueryCount).toEqual(16)
    });

    test('navigating back will not re-run volume query', async ({page}) => {
      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(4)

      await explorePage.addServiceName()
      await page.getByTestId(testIds.variables.serviceName.label).click()

      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(6)

      await explorePage.addServiceName()
      await page.getByTestId(testIds.variables.serviceName.label).click()

      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(8)

    })

    test('changing datasource will trigger new queries', async ({page}) => {
      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(4)
      await page.locator('div').filter({ hasText: /^gdev-loki$/ }).nth(1).click()
      await page.getByText('gdev-loki-copy').click()
      expect(logsVolumeCount).toEqual(2)
    })
  })
});
