import { expect, test } from '@grafana/plugin-e2e';
import { ExplorePage, PlaywrightRequest } from './fixtures/explore';
import { testIds } from '../src/services/testIds';
import { mockEmptyQueryApiResponse } from './mocks/mockEmptyQueryApiResponse';
import { LokiQuery } from '../src/services/lokiQuery';

const fieldName = 'caller';
const levelName = 'detected_level';
const labelName = 'cluster';
test.describe('explore services breakdown page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);

    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    await explorePage.gotoServicesBreakdownOldUrl();
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', fieldName],
      legendFormats: [`{{${levelName}}}`],
    });
    explorePage.captureConsoleLogs();
  });

  test.afterEach(async ({ page }) => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test('should filter logs panel on search for broadcast field', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(page.getByRole('table').locator('tr').first().getByText('broadcast').first()).toBeVisible();
    await expect(page).toHaveURL(/broadcast/);
  });

  test(`should replace service_name with ${labelName} in url`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
      legendFormats: [`{{${labelName}}}`, `{{service_name}}`],
    });
    await explorePage.goToLabelsTab();

    // Select cluster
    const selectClusterButton = page.getByLabel(`Select ${labelName}`);
    await expect(selectClusterButton).toHaveCount(1);
    await page.getByLabel(`Select ${labelName}`).click();

    // exclude "us-east-1" cluster
    const excludeCluster = 'us-east-1';
    const clusterExcludeSelectButton = page
      .getByTestId(`data-testid Panel header ${excludeCluster}`)
      .getByTestId('data-testid button-filter-exclude');
    await expect(clusterExcludeSelectButton).toHaveCount(1);
    await clusterExcludeSelectButton.click();

    // include eu-west-1 cluster
    const includeCluster = 'eu-west-1';
    const clusterIncludeSelectButton = page
      .getByTestId(`data-testid Panel header ${includeCluster}`)
      .getByTestId('data-testid button-filter-include');
    await expect(clusterIncludeSelectButton).toHaveCount(1);
    await clusterIncludeSelectButton.click();

    // Include should navigate us back to labels tab
    await explorePage.assertTabsNotLoading();
    await expect(selectClusterButton).toHaveCount(1);

    // Now remove service_name variable
    const removeServiceNameFilterBtn = page
      .getByTestId('data-testid Dashboard template variables submenu Label service_name')
      .getByLabel('Remove');
    await expect(removeServiceNameFilterBtn).toHaveCount(1);
    await removeServiceNameFilterBtn.click();

    // Assert cluster has been added as the new URL slug
    await explorePage.assertTabsNotLoading();
    await expect(page).toHaveURL(/\/cluster\/eu-west-1\//);

    // Assert service_name is visible as a normal label
    const serviceNameSelect = page.getByLabel('Select service_name');
    await expect(serviceNameSelect).toHaveCount(1);
    await serviceNameSelect.click();

    // exclude nginx service
    const nginxExcludeBtn = page
      .getByTestId('data-testid Panel header nginx')
      .getByTestId('data-testid button-filter-exclude');
    await expect(nginxExcludeBtn).toHaveCount(1);
    await nginxExcludeBtn.click();

    const serviceNameFilter = page.getByTestId('data-testid Dashboard template variables submenu Label service_name');
    await expect(serviceNameFilter).toHaveCount(1);
  });

  test('logs panel should have panel-content class suffix', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(page.getByTestId('data-testid Panel header Logs').locator('[class$="panel-content"]')).toBeVisible();
  });

  test('should filter table panel on text search for field broadcast', async ({ page }) => {
    const initialText = await page.getByTestId(testIds.table.wrapper).allTextContents();
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(1).click();
    const afterFilterText = await page.getByTestId(testIds.table.wrapper).allTextContents();
    expect(initialText).not.toBe(afterFilterText);
  });

  test(`should add ${levelName} filter on table click`, async ({ page }) => {
    // Switch to table view
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(1).click();

    const table = page.getByTestId(testIds.table.wrapper);
    // Get a level pill, and click it
    const levelPill = table.getByRole('cell').getByText('level=').first();
    await levelPill.click();
    // Get the context menu
    const pillContextMenu = table.getByRole('img', { name: 'Add to search' });
    // Assert menu is open
    await expect(pillContextMenu).toBeVisible();
    // Click the filter button
    await pillContextMenu.click();
    // New level filter should be added
    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${levelName}`)).toBeVisible();
  });

  test('should show inspect modal', async ({ page }) => {
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(1).click();
    // Expect table to be rendered
    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible();

    await page.getByTestId(testIds.table.inspectLine).last().click();
    await expect(page.getByRole('dialog', { name: 'Inspect value' })).toBeVisible();
  });

  test(`should select label ${levelName}, update filters, open in explore`, async ({ page }) => {
    const valueName = 'info';
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();
    await page.getByTestId(`data-testid Panel header ${valueName}`).getByRole('button', { name: 'Include' }).click();
    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${levelName}`)).toBeVisible();
    const page1Promise = page.waitForEvent('popup');
    await explorePage.serviceBreakdownOpenExplore.click();
    const page1 = await page1Promise;
    await expect(page1.getByText(`{service_name=\`tempo-distributor\`} | ${levelName}=\`${valueName}\``)).toBeVisible();
  });

  test(`should select label ${labelName}, update filters, open in explore`, async ({ page, browser }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [],
      legendFormats: [`{{${labelName}}}`],
    });
    const valueName = 'eu-west-1';
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${labelName}`).click();
    await page.getByTestId(`data-testid Panel header ${valueName}`).getByRole('button', { name: 'Include' }).click();
    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${labelName}`)).toBeVisible();
    const page1Promise = page.waitForEvent('popup');
    await explorePage.serviceBreakdownOpenExplore.click();
    const page1 = await page1Promise;
    // Assert logQL string is as expected
    await expect(
      page1.getByText(
        `{service_name=\`tempo-distributor\`, ${labelName}=\`${valueName}\`} | json | logfmt | drop __error__, __error_details__`
      )
    ).toBeVisible();

    const toolBar = page1.getByLabel('Explore toolbar');
    // Assert toolbar is visible before proceeding
    await expect(toolBar).toBeVisible();
    const extensionsButton = page1.getByLabel('Add', { exact: true });
    await expect(extensionsButton).toHaveCount(1);
    // Click on extensions button
    await extensionsButton.click();
    const openInExploreLocator = page1.getByLabel('Open in Explore Logs');
    await expect(openInExploreLocator).toBeVisible();
    // Click on open in logs explore
    await openInExploreLocator.click();

    const openInThisTabButtonLoc = page1.getByRole('button', { name: 'Open', exact: true });
    await expect(openInThisTabButtonLoc).toBeVisible();
    // Click to open in this tab
    await openInThisTabButtonLoc.click();

    // Assert the variables are visible
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label cluster')).toBeVisible();
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label service_name')).toBeVisible();
    await explorePage.assertTabsNotLoading();

    // Assert the label variable has the correct value
    const labelFilter = page.getByTestId('AdHocFilter-cluster');
    await expect(labelFilter).toBeVisible();
    await expect(labelFilter).toHaveText('cluster=eu-west-1');

    // Assert service variable has correct value
    const serviceFilter = page.getByTestId('AdHocFilter-service_name');
    await expect(serviceFilter).toBeVisible();
    await expect(serviceFilter).toHaveText('service_name=tempo-distributor');
  });

  test('should select a label, label added to url', async ({ page }) => {
    await explorePage.goToLabelsTab();
    const labelsUrlArray = page.url().split('/');
    expect(labelsUrlArray[labelsUrlArray.length - 1].startsWith('labels')).toEqual(true);

    await page.getByLabel(`Select ${levelName}`).click();
    const urlArray = page.url().split('/');
    expect(urlArray[urlArray.length - 1].startsWith(`${levelName}`)).toEqual(true);
    // Can't import the enum as it's in the same file as the PLUGIN_ID which doesn't like being imported
    expect(urlArray[urlArray.length - 2]).toEqual('label');
  });

  test(`should update label ${levelName} sort order`, async ({ page }) => {
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();

    // Assert loading is done and panels are showing
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();
    const panelTitles: Array<string | null> = [];

    for (const panel of await panels.all()) {
      const panelTitle = await panel.getByRole('heading').textContent();
      panelTitles.push(panelTitle);
    }

    expect(panelTitles.length).toBeGreaterThan(0);

    await page.getByTestId('data-testid SortBy direction').click();
    // Desc is the default option, this should be a noop
    await page.getByRole('option', { name: 'Desc' }).click();

    await expect(panels.first()).toBeVisible();
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[i]);
    }

    await page.getByTestId('data-testid SortBy direction').click();
    // Now change the sort order
    await page.getByRole('option', { name: 'Asc' }).click();

    await expect(panels.first()).toBeVisible();
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[panelTitles.length - i - 1]);
    }
  });

  test('should search for tenant field, changing sort order updates value breakdown position', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', fieldName, 'tenant'],
      legendFormats: [`{{${levelName}}}`],
    });
    await explorePage.goToFieldsTab();

    // Use the dropdown since the tenant field might not be visible
    await page.getByText('FieldAll').click();
    await page.keyboard.type('tenan');
    await page.keyboard.press('Enter');

    // Assert loading is done and panels are showing
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();
    const panelTitles: Array<string | null> = [];

    for (const panel of await panels.all()) {
      const panelTitle = await panel.getByRole('heading').textContent();
      panelTitles.push(panelTitle);
    }

    expect(panelTitles.length).toBeGreaterThan(0);

    await page.getByTestId('data-testid SortBy direction').click();
    // Desc is the default option, this should be a noop
    await page.getByRole('option', { name: 'Desc' }).click();

    await expect(panels.first()).toBeVisible();
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[i]);
    }

    await page.getByTestId('data-testid SortBy direction').click();
    // Now change the sort order
    await page.getByRole('option', { name: 'Asc' }).click();

    await expect(panels.first()).toBeVisible();
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[panelTitles.length - i - 1]);
    }
  });

  test(`should search labels for ${levelName}`, async ({ page }) => {
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();
    await page.getByPlaceholder('Search for value').click();
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();
    await expect(panels).toHaveCount(4);
    await page.keyboard.type('errr');
    await expect(panels).toHaveCount(1);
  });

  test(`should search fields for ${fieldName}`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await explorePage.assertNotLoading();
    await explorePage.click(page.getByLabel(`Select ${fieldName}`));
    await explorePage.click(page.getByPlaceholder('Search for value'));
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();
    expect(await panels.count()).toBeGreaterThan(1);
    await page.keyboard.type('brod');
    await expect(panels).toHaveCount(1);
  });

  // Broken after latest loki update, all fields return both parsers
  test(`should exclude ${fieldName}, request should contain logfmt`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
      requests,
    });

    await explorePage.goToFieldsTab();

    const allPanels = explorePage.getAllPanelsLocator();
    await page.getByTestId(`data-testid Panel header ${fieldName}`).getByRole('button', { name: 'Select' }).click();

    // Should see 8 panels after it's done loading
    await expect(allPanels).toHaveCount(8);
    // And we'll have 2 requests, one on the aggregation, one for the label values
    expect(requests).toHaveLength(2);

    // This should trigger more queries
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();

    // Should have removed a panel
    await expect(allPanels).toHaveCount(7);
    // Adhoc content filter should be added
    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${fieldName}`)).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr).toContain('| logfmt | caller!=""');
      });
    });
    // Now we should have 3 queries, one more after adding the field exclusion filter
    expect(requests).toHaveLength(3);
  });

  test(`should include field ${fieldName}, update filters, open filters breakdown`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await explorePage.scrollToBottom();
    await page.getByTestId(`data-testid Panel header ${fieldName}`).getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();

    await explorePage.assertFieldsIndex();
    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${fieldName}`)).toBeVisible();
    await expect(page.getByText('=').nth(1)).toBeVisible();
  });

  test('should only load fields that are in the viewport', async ({ page }) => {
    await explorePage.setDefaultViewportSize();
    let requestCount = 0;

    // We don't need to mock the response, but it speeds up the test
    await page.route('**/api/ds/query*', async (route, request) => {
      const mockResponse = mockEmptyQueryApiResponse;
      const rawPostData = request.postData();

      // We only want to mock the actual field requests, and not the initial request that returns us our list of fields
      if (rawPostData) {
        const postData = JSON.parse(rawPostData);
        const refId = postData.queries[0].refId;
        // Field subqueries have a refId of the field name
        if (refId !== 'logsPanelQuery' && refId !== 'A') {
          requestCount++;
          // simulate the query taking some time
          await page.waitForTimeout(100);
          return await route.fulfill({ json: mockResponse });
        }
      }

      // Otherwise let the request go through normally
      const response = await route.fetch();
      const json = await response.json();
      return route.fulfill({ response, json });
    });
    // Navigate to fields tab
    await explorePage.goToFieldsTab();
    // Make sure the panels have started to render
    await expect(page.getByTestId(/data-testid Panel header/).first()).toBeInViewport();

    await explorePage.assertTabsNotLoading();
    // Fields on top should be loaded
    expect(requestCount).toEqual(6);
    await explorePage.scrollToBottom();
    // Panel on the bottom should be visible
    await expect(page.getByTestId(/data-testid Panel header/).last()).toBeInViewport();
    // Panel on the top should not
    await expect(page.getByTestId(/data-testid Panel header/).first()).not.toBeInViewport();
    // Wait for a bit for the requests to be made
    await page.waitForTimeout(250);
    // if this flakes we could just assert that it's greater then 3
    expect(requestCount).toEqual(17);
  });

  test(`should select field ${fieldName}, update filters, open log panel`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await page.getByTestId(`data-testid Panel header ${fieldName}`).getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    await explorePage.assertFieldsIndex();
    // Adhoc content filter should be added
    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${fieldName}`)).toBeVisible();
  });

  test('should show sample table on `<_>` click in patterns', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['A'],
    });
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    const key = page.getByText('<_>').last().click();
    // `From a sample of` is the indicator that the underlying query perfomed successfully
    await expect(page.getByText(`From a sample of`)).toBeVisible();
  });

  test('should filter patterns in table on legend click', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    const row = page.getByTestId(testIds.patterns.tableWrapper).getByRole('table').getByRole('row');
    await expect(page.getByTestId(`data-testid panel content`).getByRole('button').nth(1)).toBeVisible();
    expect(await row.count()).toBeGreaterThan(2);
    await page.getByTestId(`data-testid panel content`).getByRole('button').nth(1).click();
    expect(await row.count()).toEqual(2);
  });

  test('should search patterns by text', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    // Get the cell within the second row
    const patternTextCell = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByRole('cell')
      .nth(3);

    // Assert the target row is visible
    await expect(patternTextCell).toBeVisible();

    // Count all of the rows in the table before filtering
    const countOfAllRows = await page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .count();

    // Get the full pattern from the cell
    const searchText = (await patternTextCell.textContent()) as string;
    expect(searchText).not.toBeUndefined();

    // Get the input
    const patternSearchInput = page.getByPlaceholder('Search patterns');

    // Set the content
    await patternSearchInput.fill(searchText);

    // Expect input is visible
    await expect(patternSearchInput).toBeVisible();

    // Get the first row after filtering
    const patternTextCellAfterFilter = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      // First row is header?
      .nth(1)
      .getByRole('cell')
      .nth(3);

    // Assert that the visible row has the desired search string
    await expect(patternTextCellAfterFilter).toBeVisible();
    expect(await patternTextCellAfterFilter.textContent()).toBeDefined();

    // Count the rows after filtering
    const countOfAllRowsAfterFilter =
      (await page
        .getByTestId(testIds.patterns.tableWrapper)
        .getByRole('table')
        .getByRole('row')
        // Header takes up a row
        .count()) - 1;

    // Assert count should always be 1 unless one pattern contains another
    expect(countOfAllRowsAfterFilter).toBeGreaterThanOrEqual(1);
    expect(countOfAllRows).toBeGreaterThan(countOfAllRowsAfterFilter);

    // Assert the viz was filtered as well
    const legendIconsCount = await page.getByTestId('series-icon').count();
    expect(legendIconsCount).toBe(countOfAllRowsAfterFilter);
  });

  test('should select an include pattern field in default single view, update filters, not open log panel', async ({
    page,
  }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    // Include pattern
    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);

    await expect(firstIncludeButton).toHaveCount(1);
    //Flake (M)
    await firstIncludeButton.click();
    // Should not open logs panel and should stay in patterns tab as we allow multiple  patterns
    await expect(page.getByTestId(testIds.exploreServiceDetails.searchLogs)).not.toBeVisible();
    await expect(page.getByTestId(testIds.patterns.tableWrapper)).toBeVisible();
    // Pattern filter should be added
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
  });

  test('Should add multiple exclude patterns, which are replaced by include pattern', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const firstExcludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterExclude);

    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).toBeVisible();

    // Include pattern
    await firstExcludeButton.click();

    // Both buttons should be visible
    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).toBeVisible();

    const secondExcludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(3)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterExclude);
    await secondExcludeButton.click();

    // Both exclude patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).not.toBeVisible();
    await expect(page.getByTestId(testIds.patterns.buttonExcludedPattern)).toBeVisible();

    await expect(firstIncludeButton).toHaveCount(1);
    await firstIncludeButton.click();
    // Include and exclude patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
    await expect(page.getByTestId(testIds.patterns.buttonExcludedPattern)).toBeVisible();
  });

  test('Should add multiple include patterns', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const secondIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(3)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);

    await expect(firstIncludeButton).toBeVisible();
    await expect(secondIncludeButton).toBeVisible();

    // Include pattern
    await firstIncludeButton.click();

    // Both buttons should be visible
    await expect(firstIncludeButton).toBeVisible();
    await expect(secondIncludeButton).toBeVisible();

    await secondIncludeButton.click();

    // Both include patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonRemovePattern).nth(0)).toBeVisible();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonRemovePattern).nth(1)).toBeVisible();
  });

  test('should update a filter and run new logs', async ({ page }) => {
    await page.getByTestId('AdHocFilter-service_name').locator('svg').nth(2).click();
    await page.getByText('mimir-distributor').click();

    // Assert the panel is done loading before going on
    await expect(page.getByTestId(testIds.logsPanelHeader.header).getByLabel('Panel loading bar')).toHaveCount(0);

    await explorePage.assertTabsNotLoading();
    await explorePage.assertNotLoading();
    // @todo this test was flaking because the row is clicked before the logs panel renders the final rows. Potential grafana/grafana bug in the logs panel?
    // assert that the logs panel is done rendering
    await expect(page.getByText(/Rendering \d+ rows.../)).toHaveCount(0);

    // open log details
    await page.getByTitle('See log details').nth(1).click();

    await explorePage.scrollToBottom();
    const adHocLocator = page
      .getByTestId('data-testid Panel header Logs')
      .getByText('mimir-distributor', { exact: true });
    await expect(adHocLocator).toHaveCount(1);
    // find text corresponding text to match adhoc filter
    await expect(adHocLocator).toBeVisible();
  });

  test('should include all logs that contain bytes field', async ({ page }) => {
    let numberOfQueries = 0;
    // Click on the fields tab
    await explorePage.goToFieldsTab();
    // Selector
    const bytesIncludeButton = page
      .getByTestId('data-testid Panel header bytes')
      .getByTestId('data-testid button-filter-include');
    // Assert button isn't selected
    expect(await bytesIncludeButton.getAttribute('aria-selected')).toEqual('false');
    // Wait for all panels to finish loading, or we might intercept an ongoing query below
    await expect(page.getByLabel('Panel loading bar')).toHaveCount(0);
    // Now we'll intercept any further queries, note that the intercept above is still-preventing the actual request so the panels will return with no-data instantly
    await page.route('**/ds/query*', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];

      expect(queries[0].expr).toContain('bytes!=""');
      numberOfQueries++;

      await route.fulfill({ json: [] });
      // await route.continue()
    });
    // Click the button
    await bytesIncludeButton.click();

    // Assert the panel is still there
    expect(page.getByTestId('data-testid Panel header bytes')).toBeDefined();

    // Assert that the button has been removed, as "bytes" is now on 100% of the logs
    await expect(bytesIncludeButton).not.toBeVisible();

    // Assert that we actually had some queries
    expect(numberOfQueries).toBeGreaterThan(0);
  });

  test('should exclude all logs that contain bytes field', async ({ page }) => {
    let numberOfQueries = 0;
    // Let's not wait for all these queries
    await page.route('**/ds/query*', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];

      if (queries[0].refId === 'logsPanelQuery') {
        await route.continue();
      } else {
        await route.fulfill({ json: [] });
      }
    });
    // Click on the fields tab
    await explorePage.goToFieldsTab();
    // Selector
    const bytesIncludeButton = page
      .getByTestId('data-testid Panel header bytes')
      .getByTestId('data-testid button-filter-exclude');
    // Assert button isn't selected
    expect(await bytesIncludeButton.getAttribute('aria-selected')).toEqual('false');
    // Wait for all panels to finish loading, or we might intercept an ongoing query below
    await expect(page.getByLabel('Panel loading bar')).toHaveCount(0);
    // Now we'll intercept any further queries, note that the intercept above is still-preventing the actual request so the panels will return with no-data instantly
    await page.route('**/ds/query*', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];

      expect(queries[0].expr).toContain('bytes=""');
      numberOfQueries++;

      await route.fulfill({ json: [] });
    });
    // Click the button
    await bytesIncludeButton.click();
    // Assert that the panel is no longer rendered
    await expect(bytesIncludeButton).not.toBeInViewport();
    // Assert that the viz was excluded
    await expect(page.getByTestId('data-testid Panel header bytes')).toHaveCount(0);
    // Assert that we actually had some queries
    expect(numberOfQueries).toBeGreaterThan(0);
  });

  test('should open logs context', async ({ page }) => {
    let responses = [];
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', /log-row-context-query.+/],
      legendFormats: [`{{${levelName}}}`],
      responses: responses,
    });
    const logRow = page.getByTitle('See log details').nth(1);
    await expect(logRow).toHaveCount(1);
    await expect(page.getByText(/Rendering \d+ rows.../)).toHaveCount(0);

    await page.getByTitle('See log details').nth(1).hover();
    const showContextMenu = page.getByLabel('Show context');
    await showContextMenu.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByText('Log context')).toHaveCount(1);
    await expect(dialog.getByText('Log context')).toBeVisible();

    await expect(dialog.getByTestId('entry-row')).toHaveCount(1);
    await expect(dialog.getByTestId('entry-row')).toBeVisible();

    // Select the second so we don't pick the only row
    const secondClosestRow = dialog.getByTitle('See log details').nth(2);
    await expect(secondClosestRow).toHaveCount(1);
    await expect(secondClosestRow).toBeVisible();
    await expect(dialog.getByLabel('Fields')).toHaveCount(0);
    await secondClosestRow.click();
    await expect(dialog.getByLabel('Fields')).toHaveCount(1);

    // Get the last request and assert it returned a 200
    const key = Object.keys(responses[responses.length - 1]);
    expect(responses[responses.length - 1][key[0]].results[key[0]].status).toBe(200);
  });

  test('should see empty fields UI', async ({ page }) => {
    await page.goto(
      '/a/grafana-lokiexplore-app/explore/service/nginx/fields?var-ds=gdev-loki&from=now-5m&to=now&patterns=%5B%5D&var-fields=&var-levels=&var-patterns=&var-lineFilter=&var-filters=service_name%7C%3D%7Cnginx&urlColumns=%5B%5D&visualizationType=%22logs%22&displayedFields=%5B%5D&var-fieldBy=$__all'
    );
    await expect(page.getByText('We did not find any fields for the given timerange.')).toHaveCount(1);
    await expect(explorePage.getAllPanelsLocator()).toHaveCount(0);
  });
  test('should see clear fields UI', async ({ page }) => {
    await page.goto(
      '/a/grafana-lokiexplore-app/explore/service/nginx-json/fields?var-ds=gdev-loki&from=now-5m&to=now&patterns=%5B%5D&var-fields=bytes|=|""&var-levels=&var-patterns=&var-lineFilter=&var-filters=service_name%7C%3D%7Cnginx-json&urlColumns=%5B%5D&visualizationType=%22logs%22&displayedFields=%5B%5D&var-fieldBy=$__all'
    );
    await expect(page.getByText('No labels match these filters.')).toHaveCount(1);
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label bytes')).toHaveCount(1);
    await expect(explorePage.getAllPanelsLocator()).toHaveCount(0);
    await page.getByText('Clear filters').click();
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label bytes')).toHaveCount(0);
    await expect(explorePage.getAllPanelsLocator().first()).toHaveCount(1);
    await expect(explorePage.getAllPanelsLocator().first()).toBeVisible();
    await expect(explorePage.getAllPanelsLocator().first()).toBeInViewport();
  });

  test('should not see maximum of series limit reached after changing filters', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', 'content', 'version'],
      legendFormats: [`{{${levelName}}}`],
    });

    const panelErrorLocator = page.getByTestId('data-testid Panel status error');
    const contentPanelLocator = page.getByTestId('data-testid Panel header content');
    const versionPanelLocator = page.getByTestId('data-testid Panel header version');
    const versionVariableLocator = page.getByTestId('AdHocFilter-version');
    const versionIncludeButton = versionPanelLocator.getByTestId('data-testid button-filter-exclude');

    // Go to the fields tab and assert errors aren't showing
    await explorePage.goToFieldsTab();
    await expect(panelErrorLocator).toHaveCount(0);
    // Now assert that content is hidden (will hit 1000 series limit and throw error)
    await expect(contentPanelLocator).toHaveCount(0);
    await expect(versionPanelLocator).toHaveCount(1);

    await versionIncludeButton.click();
    await expect(versionVariableLocator).toHaveCount(1);
    await expect(versionPanelLocator.locator('[aria-selected="true"]')).toHaveCount(1);
    await expect(versionVariableLocator.getByText('=', { exact: true })).toHaveCount(1);
    await expect(versionVariableLocator.getByText(/^!=$/)).toHaveCount(0);
    await expect(versionVariableLocator.getByText(/^=$/)).toHaveCount(1);

    // Open the menu
    await versionVariableLocator.locator('svg').nth(1).click();

    // assert the options are showing
    await expect(page.getByRole('option', { name: '=', exact: true })).toHaveCount(1);
    await expect(page.getByRole('option', { name: '!=', exact: true })).toHaveCount(1);

    // Click the other option and exclude version
    await page.getByRole('option', { name: '!=', exact: true }).click();

    // Check the right options are visible
    await expect(versionVariableLocator.getByText(/^!=$/)).toHaveCount(1);
    await expect(versionVariableLocator.getByText(/^=$/)).toHaveCount(0);

    // Assert no errors are visible
    await expect(panelErrorLocator).toHaveCount(0);
    // Now assert that content is hidden (will hit 1000 series limit and throw error)
    await expect(contentPanelLocator).toHaveCount(0);
    // But version should exist
    await expect(versionPanelLocator).toHaveCount(1);
  });

  test('should update label set if detected_labels is loaded in another tab', async ({ page }) => {
    explorePage.blockAllQueriesExcept({});
    await explorePage.assertNotLoading();
    await explorePage.assertTabsNotLoading();
    await explorePage.goToLabelsTab();

    const tabCountLocator = page.getByTestId(testIds.exploreServiceDetails.tabLabels).locator('> span');
    await expect(tabCountLocator).not.toBeEmpty();
    const panels = explorePage.getAllPanelsLocator();
    // Count panels, compare to tab count
    await expect(panels).toHaveCount(parseInt((await tabCountLocator.textContent()) as string, 10));

    await explorePage.assertTabsNotLoading();
    await explorePage.goToLogsTab();
    await page.getByTestId('AdHocFilter-service_name').click();
    await page.getByText('mimir-ingester').click();
    await explorePage.assertTabsNotLoading();
    await explorePage.goToLabelsTab();

    // Count panels, compare to tab count
    await expect(panels).toHaveCount(parseInt((await tabCountLocator.textContent()) as string, 10));
  });
});
