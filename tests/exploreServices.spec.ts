import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import { testIds } from '../src/services/testIds';
import { mockVolumeApiResponse } from './mocks/mockVolumeApiResponse';
import { isNumber } from 'lodash';
import { Page } from '@playwright/test';

test.describe('explore services page', () => {
  let explorePage: ExplorePage;

  test.describe('parallel', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      explorePage = new ExplorePage(page, testInfo);
      await explorePage.setDefaultViewportSize();
      await explorePage.clearLocalStorage();
      await explorePage.gotoServices();
      explorePage.captureConsoleLogs();
    });

    test.afterEach(async ({ page }) => {
      await explorePage.unroute();
      explorePage.echoConsoleLogsOnRetry();
    });

    test('should filter service labels on search', async ({ page }) => {
      await explorePage.setExtraTallViewportSize();
      await explorePage.servicesSearch.click();
      await explorePage.servicesSearch.pressSequentially('mimir');
      // Volume can differ, scroll down so all of the panels are loaded
      await explorePage.scrollToBottom();

      await page.getByTestId('data-testid Panel header mimir-ingester').first().scrollIntoViewIfNeeded();
      // service name should be in time series panel
      await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(0)).toBeVisible();
      // service name should also be in logs panel, just not visible to the user
      await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(1)).toBeVisible();

      // Exit out of the dropdown
      await page.keyboard.press('Escape');
      // Only the first title is visible
      await expect(page.getByText('mimir-ingester').nth(0)).toBeVisible();
      await expect(page.getByText('mimir-ingester').nth(1)).not.toBeVisible();
      await expect(page.getByText('Showing 4 of 4')).toBeVisible();
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
      await expect(page.getByText('mimir-ingester').nth(0)).toBeVisible();
      // And the panel title
      await expect(page.getByText('mimir-ingester').nth(1)).toBeVisible();
      // And the logs panel title should be hidden
      await expect(page.getByText('mimir-ingester').nth(2)).not.toBeVisible();
      await expect(page.getByText('Showing 1 of 1')).toBeVisible();
    });

    test('should filter service labels on partial string', async ({ page }) => {
      await explorePage.setExtraTallViewportSize();
      await explorePage.servicesSearch.click();
      await explorePage.servicesSearch.pressSequentially('imi');
      // service name should be in time series panel
      await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(0)).toBeVisible();
      // service name should also be in logs panel, just not visible to the user
      await expect(page.getByTestId('data-testid Panel header mimir-ingester').nth(1)).toBeVisible();

      // Exit out of the dropdown
      await page.keyboard.press('Escape');
      // Only the first title is visible
      await expect(page.getByText('mimir-ingester').nth(0)).toBeVisible();
      await expect(page.getByText('mimir-ingester').nth(1)).not.toBeVisible();
      await expect(page.getByText('Showing 4 of 4')).toBeVisible();
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
      await expect(page.getByText('Showing 1 of 1')).toBeVisible();
      await expect(page.getByText(/level=info/).first()).toBeVisible();
      await page.getByTitle('debug').first().click();
      await expect(page.getByText(/level=debug/).first()).toBeVisible();
      await expect(page.getByText(/level=info/)).not.toBeVisible();
    });

    test('should clear filters and levels when navigating back to previously activated service', async ({ page }) => {
      await explorePage.addServiceName();

      // Add detected_level filter
      await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
      await page.getByLabel('Select detected_level').click();
      await page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1).click();

      await expect(page.getByTestId('AdHocFilter-detected_level')).toBeVisible();

      // Navigate to patterns so the scene is cached
      await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

      await expect(page.getByTestId('AdHocFilter-detected_level')).toBeVisible();

      // Remove service so we're redirected back to the start
      await page.getByTestId(testIds.variables.serviceName.label).click();

      // Assert we're rendering the right scene and the services have loaded
      await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

      await explorePage.addServiceName();

      await expect(page.getByTestId('AdHocFilter-detected_level')).not.toBeVisible();

      await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

      await expect(page.getByTestId('AdHocFilter-detected_level')).not.toBeVisible();
    });

    test.describe('mock volume API calls', () => {
      let logsVolumeCount: number, logsQueryCount: number, labelsQueryCount: number;

      test.beforeEach(async ({ page }) => {
        logsVolumeCount = 0;
        logsQueryCount = 0;

        await page.route('**/index/volume*', async (route) => {
          const volumeResponse = mockVolumeApiResponse;
          logsVolumeCount++;
          await page.waitForTimeout(25);
          await route.fulfill({ json: volumeResponse });
        });

        await page.route('**/ds/query*', async (route) => {
          logsQueryCount++;
          await page.waitForTimeout(50);
          await route.fulfill({ json: {} });
        });

        await Promise.all([
          page.waitForResponse((resp) => resp.url().includes('index/volume')),
          page.waitForResponse((resp) => resp.url().includes('ds/query')),
        ]);
      });
      test.afterEach(async ({ page }) => {
        await explorePage.unroute();
        explorePage.echoConsoleLogsOnRetry();
      });

      test('refreshing time range should request panel data once', async ({ page }) => {
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        expect(logsVolumeCount).toEqual(1);
        expect(logsQueryCount).toEqual(4);
        await explorePage.refreshPicker.click();
        await explorePage.refreshPicker.click();
        await explorePage.refreshPicker.click();
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        // Noticed that the below assertions were flaking when not running the trace, we need to wait a tiny bit to let the last requests fire
        await page.waitForTimeout(50);
        expect(logsVolumeCount).toEqual(4);
        expect(logsQueryCount).toEqual(16);
      });

      // Since the addition of the runtime datasource, the query doesn't contain the datasource, and won't re-run when the datasource is changed, as such we need to manually re-run volume queries when the service selection scene is activated or users could be presented with an invalid set of services
      // This isn't ideal as we won't take advantage of being able to use the cached volume result for users that did not change the datasource any longer
      test('navigating back will re-run volume query', async ({ page }) => {
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        expect(logsVolumeCount).toEqual(1);
        expect(logsQueryCount).toBeLessThanOrEqual(4);

        // Click on first service
        await explorePage.addServiceName();
        await explorePage.assertTabsNotLoading();
        // Clear variable
        await page.getByTestId(testIds.variables.serviceName.label).click();

        expect(logsVolumeCount).toEqual(2);
        expect(logsQueryCount).toBeLessThanOrEqual(6);

        // Click on first service
        await explorePage.addServiceName();
        await explorePage.assertTabsNotLoading();
        // Clear variable
        await page.getByTestId(testIds.variables.serviceName.label).click();

        // Assert we're rendering the right scene and the services have loaded
        await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();
        await explorePage.assertPanelsNotLoading();

        // We just need to wait a few ms for the query to get fired?
        await page.waitForTimeout(100);

        expect(logsVolumeCount).toEqual(3);
      });

      test('changing datasource will trigger new queries', async ({ page }) => {
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        await explorePage.assertPanelsNotLoading();
        expect(logsVolumeCount).toEqual(1);
        expect(logsQueryCount).toEqual(4);
        await explorePage.changeDatasource();
        await explorePage.assertPanelsNotLoading();
        expect(logsVolumeCount).toEqual(2);
      });

      test('should re-execute volume query after being redirected back to service selection', async ({ page }) => {
        await explorePage.assertPanelsNotLoading();
        await explorePage.addServiceName();
        await expect(explorePage.logVolumeGraph).toBeVisible();
        await explorePage.changeDatasource();
        expect(logsVolumeCount).toBe(2);
      });
    });

    test.describe('tabs', () => {
      test.describe('navigation', () => {
        test('user can use browser history to navigate through tabs', async ({ page }) => {
          const addNewTab = page.getByTestId(testIds.index.addNewLabelTab);
          const selectNewLabelSelect = page.locator('[role="tooltip"]');
          const newNamespaceTabLoc = page.getByTestId('data-testid Tab namespace');
          const newLevelTabLoc = page.getByTestId('data-testid Tab level');
          const serviceTabLoc = page.getByTestId('data-testid Tab service');
          const allTabLoc = page.getByTestId(/data-testid Tab .+/);

          // Assert only 2 tabs are visible (service, add new)
          await expect(allTabLoc).toHaveCount(2);

          // Assert add new tab is visible
          await expect(addNewTab).toHaveCount(1);
          // Click "New" tab
          await addNewTab.click();

          // Dropdown should be open
          await expect(selectNewLabelSelect).toContainText('Search labels');

          // Add "namespace" as a new tab
          await page.getByText(/namespace/).click();
          await expect(newNamespaceTabLoc).toHaveCount(1);

          // Click "New" tab
          await addNewTab.click();

          // Dropdown should be open
          await expect(selectNewLabelSelect).toContainText('Search labels');
          await page.getByText(/level \(\d+\)/).click();

          // Assert we have 4 tabs open
          await expect(allTabLoc).toHaveCount(4);

          // Assert level is selected
          expect(await newLevelTabLoc.getAttribute('aria-selected')).toEqual('true');

          // Go back to last tab
          await page.goBack();
          // Assert namespace is selected
          await expect(newNamespaceTabLoc).toHaveCount(1);
          expect(await newNamespaceTabLoc.getAttribute('aria-selected')).toEqual('true');

          await page.goBack();
          await expect(serviceTabLoc).toHaveCount(1);
          expect(await serviceTabLoc.getAttribute('aria-selected')).toEqual('true');
        });
        test('removing the primary label should redirect back to index, user can go back to breakdown with browser history', async ({
          page,
        }) => {
          // Select the first service
          await explorePage.addServiceName();

          const serviceNameVariableLoc = page.getByTestId(testIds.variables.serviceName.label);
          const removeVariableBtn = serviceNameVariableLoc.getByLabel('Remove');
          await expect(serviceNameVariableLoc).toHaveCount(1);
          await expect(removeVariableBtn).toHaveCount(1);

          // Remove the only variable
          await removeVariableBtn.click();

          // assert navigated back to index page
          await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

          // Navigate back with browser history
          await page.goBack();

          // Assert the variable is visible and we're back on the breakdown view
          await expect(serviceNameVariableLoc).toHaveCount(1);
          await expect(removeVariableBtn).toHaveCount(1);

          // Logs tab should be visible and selected
          await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toHaveCount(1);
          expect(await page.getByTestId(testIds.exploreServiceDetails.tabLogs).getAttribute('aria-selected')).toEqual(
            'true'
          );

          // Navigate to the fields breakdown tab
          await explorePage.goToFieldsTab();

          // Assert fields tab is selected and active
          await expect(page.getByTestId(testIds.exploreServiceDetails.tabFields)).toHaveCount(1);
          expect(await page.getByTestId(testIds.exploreServiceDetails.tabFields).getAttribute('aria-selected')).toEqual(
            'true'
          );

          // Go back to the logs tab
          await page.goBack();

          // Logs tab should be visible and selected
          await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toHaveCount(1);
          expect(await page.getByTestId(testIds.exploreServiceDetails.tabLogs).getAttribute('aria-selected')).toEqual(
            'true'
          );

          await page.goBack();

          // assert navigated back to index page
          await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();
        });
      });
    });
  });

  test.describe('sequential', () => {
    test.describe.configure({ mode: 'serial' });
    test.describe('tabs - namespace', () => {
      let page: Page;
      let logsVolumeCount: number,
        logsQueryCount: number,
        detectedLabelsCount: number,
        patternsCount: number,
        detectedFieldsCount: number;

      test.beforeAll(async ({ browser }, testInfo) => {
        const pagePre = await browser.newPage();
        explorePage = new ExplorePage(pagePre, testInfo);
        page = explorePage.page;

        await page.route('**/index/volume*', async (route) => {
          const response = await route.fetch();
          const json = await response.json();

          logsVolumeCount++;
          await page.waitForTimeout(25);
          await route.fulfill({ response, json });
        });
        await page.route('**/resources/detected_fields*', async (route) => {
          const response = await route.fetch();
          const json = await response.json();

          detectedFieldsCount++;
          await page.waitForTimeout(25);
          await route.fulfill({ response, json });
        });
        await page.route('**/resources/detected_labels*', async (route) => {
          const response = await route.fetch();
          const json = await response.json();

          detectedLabelsCount++;
          await page.waitForTimeout(25);
          await route.fulfill({ response, json });
        });
        await page.route('**/resources/patterns*', async (route) => {
          const response = await route.fetch();
          const json = await response.json();

          patternsCount++;
          await page.waitForTimeout(25);
          await route.fulfill({ response, json });
        });

        // Can skip logs query for this test
        await page.route('**/ds/query*', async (route) => {
          logsQueryCount++;
          await route.fulfill({ json: {} });
        });

        await explorePage.gotoServices();
        await explorePage.setDefaultViewportSize();
        await explorePage.clearLocalStorage();
        explorePage.captureConsoleLogs();
      });

      test.beforeEach(async ({}) => {
        logsVolumeCount = 0;
        logsQueryCount = 0;
        patternsCount = 0;
        detectedLabelsCount = 0;
        detectedFieldsCount = 0;
      });

      test.afterAll(async ({}) => {
        await explorePage.unroute();
        explorePage.echoConsoleLogsOnRetry();
      });

      test('Part 1: user can add namespace label as a new tab and navigate to breakdown', async ({}) => {
        await expect(page.getByText('Showing 0 of 0')).not.toBeVisible();
        await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

        // Click "New" tab
        const addNewTab = page.getByTestId(testIds.index.addNewLabelTab);
        await expect(addNewTab).toHaveCount(1);
        await addNewTab.click();

        // Dropdown should be open
        const selectNewLabelSelect = page.locator('[role="tooltip"]');
        await expect(selectNewLabelSelect).toContainText('Search labels');

        // Add "namespace" as a new tab
        await page.getByText(/namespace/).click();
        const newNamespaceTabLoc = page.getByTestId('data-testid Tab namespace');
        await expect(newNamespaceTabLoc).toHaveCount(1);

        // Assert results have loaded before we search or we'll cancel the ongoing volume query
        await expect(page.getByText('Showing 6 of 6')).toBeVisible();
        // Search for "gateway"
        await page.getByTestId(testIds.index.searchLabelValueInput).fill('gate');
        await page.getByTestId(testIds.index.searchLabelValueInput).press('Escape');

        // Asser this filters down to only one result
        await expect(page.getByText('Select')).toHaveCount(1);
        await expect(page.getByText('Showing 1 of 1')).toBeVisible();

        // Select the first and only result
        await explorePage.addServiceName();
        await explorePage.assertTabsNotLoading();

        // Logs tab should be visible and selected
        await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toHaveCount(1);
        expect(await page.getByTestId(testIds.exploreServiceDetails.tabLogs).getAttribute('aria-selected')).toEqual(
          'true'
        );

        expect(page.url()).toMatch(/a\/grafana-lokiexplore-app\/explore\/namespace\/gateway\/logs/);

        await expect.poll(() => logsVolumeCount).toEqual(3);
        await expect.poll(() => patternsCount).toEqual(1);
        await expect.poll(() => detectedLabelsCount).toEqual(2);
        await expect.poll(() => detectedFieldsCount).toEqual(1);
      });

      test('Part 2: changing primary label updates tab counts', async ({}) => {
        await explorePage.assertTabsNotLoading();
        const gatewayPatternsCount = await page
          .getByTestId(testIds.exploreServiceDetails.tabPatterns)
          .locator('> span')
          .textContent();
        const gatewayFieldsCount = await page
          .getByTestId(testIds.exploreServiceDetails.tabFields)
          .locator('> span')
          .textContent();
        const gatewayLabelsCount = await page
          .getByTestId(testIds.exploreServiceDetails.tabLabels)
          .locator('> span')
          .textContent();
        expect(isNumber(Number(gatewayPatternsCount))).toEqual(true);
        expect(isNumber(Number(gatewayFieldsCount))).toEqual(true);
        expect(isNumber(Number(gatewayLabelsCount))).toEqual(true);

        // Namespace dropdown should exist
        const selectLoc = page.getByTestId('AdHocFilter-namespace').locator('svg').nth(2);
        await expect(selectLoc).toHaveCount(1);

        // Open service name / primary label dropdown
        await selectLoc.click();

        // Change to apache service
        const optionLoc = page.getByRole('option', { name: /^mimir$/ });
        await expect(optionLoc).toHaveCount(1);
        await optionLoc.click();

        await explorePage.assertTabsNotLoading();

        const mimirPatternsCount = await page
          .getByTestId(testIds.exploreServiceDetails.tabPatterns)
          .locator('> span')
          .textContent();
        const mimirFieldsCount = await page
          .getByTestId(testIds.exploreServiceDetails.tabFields)
          .locator('> span')
          .textContent();
        const mimirLabelsCount = await page
          .getByTestId(testIds.exploreServiceDetails.tabLabels)
          .locator('> span')
          .textContent();

        expect(isNumber(Number(mimirPatternsCount))).toEqual(true);
        expect(isNumber(Number(mimirFieldsCount))).toEqual(true);
        expect(isNumber(Number(mimirLabelsCount))).toEqual(true);

        expect(mimirPatternsCount).not.toEqual(gatewayPatternsCount);
        expect(mimirFieldsCount).not.toEqual(gatewayFieldsCount);

        await expect.poll(() => logsVolumeCount).toEqual(0);
        await expect.poll(() => patternsCount).toEqual(1);
        await expect.poll(() => detectedLabelsCount).toEqual(1);
        await expect.poll(() => detectedFieldsCount).toEqual(1);
      });
    });
  });
});
