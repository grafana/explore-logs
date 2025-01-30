import { test, expect } from '@grafana/plugin-e2e';
import { E2EComboboxStrings, ExplorePage } from './fixtures/explore';
import { testIds } from '../src/services/testIds';
import { getMockVolumeApiResponse } from './mocks/getMockVolumeApiResponse';
import { isNumber } from 'lodash';
import { Page } from '@playwright/test';

test.describe('explore services page', () => {
  let explorePage: ExplorePage;

  test.describe('parallel', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      explorePage = new ExplorePage(page, testInfo);

      // Header sizes may change, bringing up the third row in queries, which will break tests in this suite
      await page.setViewportSize({ width: 1280, height: 600 });
      await explorePage.clearLocalStorage();
      await explorePage.gotoServices();
      explorePage.captureConsoleLogs();
    });

    test.afterEach(async ({ page }) => {
      await explorePage.unroute();
      explorePage.echoConsoleLogsOnRetry();
    });

    test('should add labels to favorites', async ({ page }) => {
      await explorePage.servicesSearch.click();
      const firstResult = page.getByRole('option').first();

      // Expect the first result to be tempo-distributor
      await expect(firstResult).not.toContainText('nginx');

      // Select nginx, as it has the lowest volume, and should otherwise show up last
      await explorePage.servicesSearch.pressSequentially('^nginx$');
      await page.keyboard.press('Escape');

      // Assert the first is nginx, or we might click before it's done loading
      await expect(page.getByTestId('header-container').first()).toHaveText('nginxShow logs');
      await explorePage.addServiceName();

      // Assert we made it to the breakdown, and nginx is selected
      await expect(page.getByLabel('Edit filter with key')).toHaveText('service_name = nginx');

      // Click on nav to return to service selection
      await page.getByRole('link', { name: 'Logs' }).click();

      // Clear the existing search filter added above
      await page.getByLabel('select-clear-value').click();

      // Assert there is more then one result now
      await expect(page.getByTestId('header-container').nth(1)).toBeVisible();

      // Assert that the first element is nginx now
      await expect(page.getByTestId('header-container').first()).toHaveText('nginxShow logs');
      await explorePage.servicesSearch.click();

      // Assert there is more than one element in the dropdown
      await expect(page.getByRole('option').nth(1)).not.toContainText('nginx');

      // assert the first element is nginx now
      await expect(firstResult).toHaveText('nginx');
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
      await explorePage.assertNotLoading();
      await explorePage.scrollToBottom();
      await page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1).click();

      await expect(page.getByLabel('Edit filter with key detected_level')).toBeVisible();

      // Navigate to patterns so the scene is cached
      await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

      await expect(page.getByLabel('Edit filter with key detected_level')).toBeVisible();

      // Remove service so we're redirected back to the start
      await page.getByLabel(E2EComboboxStrings.labels.removeServiceLabel).click();

      // Assert we're rendering the right scene and the services have loaded
      await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

      await explorePage.addServiceName();

      await expect(page.getByLabel('Edit filter with key detected_level')).not.toBeVisible();

      await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

      await expect(page.getByLabel('Edit filter with key detected_level')).not.toBeVisible();
    });

    test('should add multiple includes on service selection', async ({ page }) => {
      // await explorePage.aggregatedMetricsToggle();
      const showLogsHeaderBtn = page.getByTestId(testIds.index.header.showLogsButton);

      // Button should be disabled until a filter is added
      await expect(showLogsHeaderBtn).toBeDisabled();

      // Filter results for tempo-ingester
      await explorePage.servicesSearch.click();
      await explorePage.servicesSearch.pressSequentially('tempo-ingester');

      const tempoIngesterPanelHeader = page.getByTestId('header-container');
      const tempoIngesterIncludeBtn = tempoIngesterPanelHeader.getByTestId('data-testid button-filter-include');
      await expect(tempoIngesterIncludeBtn).toHaveCount(1);
      await page.keyboard.press('Escape');

      // Assert the portal closed
      await expect(page.getByRole('listbox')).not.toBeVisible();

      // Assert the button is disabled
      await expect(page.getByRole('heading', { name: 'tempo-ingester' })).toBeVisible();

      // add positive include filter without navigating
      await tempoIngesterIncludeBtn.click();
      expect(await tempoIngesterIncludeBtn.getAttribute('aria-selected')).toEqual('true');
      // Show logs button in headers should no longer be disabled now we've added new filter
      await expect(showLogsHeaderBtn).not.toBeDisabled();

      await expect(page.getByLabel('Edit filter with key')).toHaveCount(1);

      // Filter results for tempo-distributor
      await explorePage.servicesSearch.click();
      await explorePage.servicesSearch.pressSequentially('tempo-d');

      const tempoDistributorPanelHeader = page.getByTestId('header-container');
      const tempoDistributorIncludeBtn = tempoDistributorPanelHeader.getByTestId('data-testid button-filter-include');
      await expect(tempoDistributorIncludeBtn).toHaveCount(1);
      await page.keyboard.press('Escape');

      // Assert the portal closed
      await expect(page.getByRole('listbox')).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'tempo-distributor' })).toBeVisible();

      // add positive include filter without navigating
      await tempoDistributorIncludeBtn.click();
      expect(await tempoDistributorIncludeBtn.getAttribute('aria-selected')).toEqual('true');

      // Assert the filters are visible within the combobox
      await expect(page.locator('div').filter({ hasText: /^service_name = tempo-ingester$/ })).toHaveCount(1);
      await expect(page.locator('div').filter({ hasText: /^service_name = tempo-distributor$/ })).toHaveCount(1);

      await showLogsHeaderBtn.click();

      // assert we navigated
      await expect(
        page.getByTestId('data-testid Panel header Log volume').getByTestId('header-container')
      ).toBeVisible();

      // assert the filters are still visible in the combobox
      await expect(page.locator('div').filter({ hasText: /^service_name = tempo-ingester$/ })).toHaveCount(1);
      await expect(page.locator('div').filter({ hasText: /^service_name = tempo-distributor$/ })).toHaveCount(1);
    });

    test.describe('mock volume API calls', () => {
      let logsVolumeCount: number, logsQueryCount: number, logCountQueryCount: number;

      test.beforeEach(async ({ page }) => {
        logsVolumeCount = 0;
        logsQueryCount = 0;
        logCountQueryCount = 0;

        await page.route('**/index/volume*', async (route) => {
          logsVolumeCount++;
          const volumeResponse = getMockVolumeApiResponse();
          await route.fulfill({ json: volumeResponse });
        });

        await page.route('**/ds/query*', async (route, request) => {
          const rawPostData = request.postData();

          // We only want to mock the actual field requests, and not the initial request that returns us our list of fields
          if (rawPostData) {
            const postData = JSON.parse(rawPostData);
            const refId: string = postData.queries[0].refId;
            // Logs panel and timeseries queries on service selection, and logs panel on breakdowns
            if (refId === 'logsPanelQuery' || refId.includes('ts-') || refId.includes('logs-')) {
              logsQueryCount++;
            }
            if (refId === 'logsCountQuery') {
              logCountQueryCount++;
            }
          }
          await route.fulfill({ json: {} });
        });

        // Don't wait for a response if we've already got it!
        if (logsVolumeCount === 0) {
          await page.waitForResponse((resp) => {
            return logsVolumeCount > 0 || resp.url().includes('index/volume');
          });
        }

        // Don't wait for a response if we've already got it!
        if (logsQueryCount === 0) {
          await page.waitForResponse((resp) => {
            return logsQueryCount > 0 || resp.url().includes('ds/query');
          });
        }
      });

      test.afterEach(async ({ page }) => {
        await explorePage.unroute();
        explorePage.echoConsoleLogsOnRetry();
      });

      test('refreshing time range should request panel data once', async ({ page }) => {
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        expect(logsVolumeCount).toEqual(1);
        expect(logsQueryCount).toEqual(4);

        // We're only updating if the time range is more then a second diff...
        await page.waitForTimeout(1001);
        await explorePage.refreshPicker.click();
        await page.waitForTimeout(1001);
        await explorePage.refreshPicker.click();
        await page.waitForTimeout(1001);
        await explorePage.refreshPicker.click();
        await page.waitForTimeout(1001);
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        // Noticed that the below assertions were flaking when not running the trace, we need to wait a tiny bit to let the last requests fire
        await page.waitForTimeout(50);
        expect(logsVolumeCount).toEqual(4);
        expect(logsQueryCount).toEqual(16);
        expect(logCountQueryCount).toEqual(0);
      });

      // Since the addition of the runtime datasource, the query doesn't contain the datasource, and won't re-run when the datasource is changed, as such we need to manually re-run volume queries when the service selection scene is activated or users could be presented with an invalid set of services
      // This isn't ideal as we won't take advantage of being able to use the cached volume result for users that did not change the datasource any longer
      test('navigating back will re-run volume query', async ({ page }) => {
        const removeVariableBtn = page.getByLabel(E2EComboboxStrings.labels.removeServiceLabel);
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        expect(logsVolumeCount).toEqual(1);
        expect(logsQueryCount).toBeLessThanOrEqual(4);
        await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

        // Click on first service
        await explorePage.addServiceName();
        await explorePage.assertTabsNotLoading();

        // Clear variable
        await expect(page.getByText(/Showing \d+ of \d+/)).toHaveCount(0);
        await expect(removeVariableBtn).toHaveCount(1);
        await removeVariableBtn.click();

        // Assert we navigated back
        await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

        expect(logsVolumeCount).toEqual(2);
        expect(logsQueryCount).toBeLessThanOrEqual(6);

        // Click on first service
        await explorePage.addServiceName();
        await explorePage.assertTabsNotLoading();

        // Clear variable
        await expect(page.getByText(/Showing \d+ of \d+/)).toHaveCount(0);
        await expect(removeVariableBtn).toHaveCount(1);
        await removeVariableBtn.click();

        // Assert we're rendering the right scene and the services have loaded
        await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();
        await explorePage.assertPanelsNotLoading();

        // We just need to wait a few ms for the query to get fired?
        await page.waitForTimeout(100);

        // Volume should fire initially, after navigating back from breakdown x2
        expect(logsVolumeCount).toEqual(3);

        // Should fire on breakdown x2
        expect(logCountQueryCount).toEqual(2);
      });

      test('changing datasource will trigger new queries', async ({ page }) => {
        await page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
        await explorePage.assertPanelsNotLoading();
        expect(logsVolumeCount).toEqual(1);
        expect(logsQueryCount).toEqual(4);
        await explorePage.changeDatasource();
        await explorePage.assertPanelsNotLoading();
        expect(logsVolumeCount).toEqual(2);
        expect(logCountQueryCount).toEqual(0);
      });

      test('should re-execute volume query after being redirected back to service selection', async ({ page }) => {
        await explorePage.assertPanelsNotLoading();
        await explorePage.addServiceName();
        await expect(explorePage.logVolumeGraph).toBeVisible();
        await explorePage.changeDatasource();
        expect(logsVolumeCount).toBe(2);
        expect(logCountQueryCount).toEqual(1);
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
          await page.getByRole('option', { name: 'level' }).click();
          // await page.getByText(/level/, { exact: true }).click();

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
          await expect(serviceNameVariableLoc).toHaveCount(1);
          const removeVariableBtn = page.getByLabel(E2EComboboxStrings.labels.removeServiceLabel);
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
      let logsVolumeCount = 0;
      let logsQueryCount = 0;
      let detectedLabelsCount = 0;
      let patternsCount = 0;
      let detectedFieldsCount = 0;

      const resetQueryCounts = () => {
        logsVolumeCount = 0;
        logsQueryCount = 0;
        patternsCount = 0;
        detectedLabelsCount = 0;
        detectedFieldsCount = 0;
      };

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
        await page.getByTestId(testIds.index.searchLabelValueInput).fill('Gate');
        await page.getByTestId(testIds.index.searchLabelValueInput).press('Escape');

        // Asser this filters down to only one result
        await expect(page.getByTestId(testIds.index.showLogsButton)).toHaveCount(1);
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
        resetQueryCounts();
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

        // Namespace filter should exist
        const selectLoc = page.getByLabel('Edit filter with key namespace');
        await expect(selectLoc).toHaveCount(1);

        // Open service name / primary label dropdown
        await selectLoc.click();

        // Change to mimir namespace
        const optionLoc = page.getByRole('option', { name: 'mimir', exact: true });
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
