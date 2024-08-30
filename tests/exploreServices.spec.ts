import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import { testIds } from "../src/services/testIds";
import { mockVolumeApiResponse } from "./mocks/mockVolumeApiResponse";
import {waitFor} from "@testing-library/react";

test.describe('explore services page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
    await explorePage.setDefaultViewportSize();
    await page.evaluate(() => window.localStorage.clear());
    await explorePage.gotoServices();
  });

  test.afterEach(async({page}) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  })

  test('should filter service labels on search', async ({ page }) => {
    await explorePage.setLimoViewportSize();
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('mimir');
    // Volume can differ, scroll down so all of the panels are loaded
    await explorePage.scrollToBottom();

    await page.getByTestId('data-testid Panel header mimir-ingester').first().scrollIntoViewIfNeeded()
    // service name should be in time series panel
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(0)).toBeVisible()
    // service name should also be in logs panel, just not visible to the user
    await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(1)).toBeVisible();

    // Exit out of the dropdown
    await page.keyboard.press('Escape');
    // Only the first title is visible
    await expect(page.getByText('mimir-ingester').nth(0)).toBeVisible()
    await expect(page.getByText('mimir-ingester').nth(1)).not.toBeVisible()
    await expect(page.getByText('Showing 4 of 4 services')).toBeVisible();
  });

  test('should filter service labels on exact search', async ({ page }) => {
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('mimir-ingester');
    // Volume can differ, scroll down so all of the panels are loaded
    await explorePage.scrollToBottom();
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
    await expect(page.getByText('Showing 1 of 1 service')).toBeVisible();
  });

  test('should filter service labels on partial string', async ({ page }) => {
    await explorePage.setLimoViewportSize()
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
    await expect(page.getByText('Showing 4 of 4 services')).toBeVisible();
  });

  test('should select a service label value and navigate to log view', async ({ page }) => {
    await explorePage.addServiceName();
    await expect(explorePage.logVolumeGraph).toBeVisible();
  });

  test('should filter logs by clicking on the chart levels', async ({ page }) => {
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('tempo-distributor');
    await page.keyboard.press('Escape');
    // Volume can differ, scroll down so all of the panels are loaded
    await explorePage.scrollToBottom();
    await expect(page.getByText('Showing 1 of 1 service')).toBeVisible();
    await expect(page.getByText(/level=info/).first()).toBeVisible();
    await page.getByTitle('debug').first().click();
    await expect(page.getByText(/level=debug/).first()).toBeVisible();
    await expect(page.getByText(/level=info/)).not.toBeVisible();
  });

  test('should clear filters and levels when navigating back to previously activated service', async ({page}) => {
    await explorePage.addServiceName();

    // Add detected_level filter
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click()
    await page.getByLabel('Select detected_level').click()
    await page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1).click()

    await expect(page.getByTestId('AdHocFilter-detected_level')).toBeVisible()

    // Navigate to patterns so the scene is cached
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    await expect(page.getByTestId('AdHocFilter-detected_level')).toBeVisible()

    // Remove service so we're redirected back to the start
    await page.getByTestId(testIds.variables.serviceName.label).click()

    // Assert we're rendering the right scene and the services have loaded
    await expect(page.getByText(/Showing \d+ of \d+ services/)).toBeVisible();

    await explorePage.addServiceName();

    await expect(page.getByTestId('AdHocFilter-detected_level')).not.toBeVisible()

    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    await expect(page.getByTestId('AdHocFilter-detected_level')).not.toBeVisible()
  })

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
        await route.fulfill({json: {}})
      })

      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('index/volume')),
        page.waitForResponse(resp => resp.url().includes('ds/query')),
      ]);
    })

    test('refreshing time range should request panel data once', async ({page}) => {
      await page.pause()
      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(4)
      await explorePage.refreshPicker.click()
      await explorePage.refreshPicker.click()
      await explorePage.refreshPicker.click()
      expect(logsVolumeCount).toEqual(4)
      expect(logsQueryCount).toEqual(16)
    });

    test.only('navigating back will not re-run volume query', async ({page}) => {
      const tabSelector = page.getByTestId(testIds.exploreServiceDetails.tabLogs)
      const tabsLoadingSelector = tabSelector.filter({has: page.locator('svg')})

      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(4)

      // Click on first service
      await explorePage.addServiceName()
      //Assert we can see the tabs
      await expect(tabSelector).toHaveCount(1)
      // Assert that the loading svg is not present
      await expect(tabsLoadingSelector).toHaveCount(0)
      // Clear variable
      await page.getByTestId(testIds.variables.serviceName.label).click()
      
      expect(logsVolumeCount).toEqual(1)
      expect(logsQueryCount).toEqual(6)

      // Click on first service
      await explorePage.addServiceName()
      //Assert we can see the tabs
      await expect(tabSelector).toHaveCount(1)
      // Assert that the loading svg is not present
      await expect(tabsLoadingSelector).toHaveCount(0)
      // Clear variable
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
