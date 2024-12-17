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
    const removeServiceNameFilterBtn = page.getByLabel('Remove filter with key service_name');
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

    // Assert service name exclusion filter is visible
    const serviceNameFilter = page.getByLabel('Edit filter with key service_name');
    await expect(serviceNameFilter).toHaveCount(1);
    await expect(serviceNameFilter).toHaveText('service_name != nginx');
  });

  test('logs panel should have panel-content class suffix', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(explorePage.getLogsPanelLocator().locator('[class$="panel-content"]')).toBeVisible();
  });

  test(`should add ${levelName} filter on table click`, async ({ page }) => {
    // Switch to table view
    await explorePage.getTableToggleLocator().click();

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
    await explorePage.getTableToggleLocator().click();
    // Expect table to be rendered
    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible();

    await page.getByTestId(testIds.table.inspectLine).last().click();
    await expect(page.getByRole('dialog', { name: 'Inspect value' })).toBeVisible();
  });

  test(`should select label ${levelName}, update filters, open in explore`, async ({ page }) => {
    await explorePage.assertTabsNotLoading();
    const valueName = 'info';
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();
    await page.getByTestId(`data-testid Panel header ${valueName}`).getByRole('button', { name: 'Include' }).click();

    await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${levelName}`)).toBeVisible();
    await explorePage.goToLogsTab();
    await explorePage.getLogsVolumePanelLocator().click();
    await page.getByTestId('data-testid Panel menu item Explore').click();
    await expect(page.getByText(`{service_name=\`tempo-distributor\`} | ${levelName}=\`${valueName}\``)).toBeVisible();
  });

  test(`should select label ${labelName}, update filters, open in explore`, async ({ page, browser }) => {
    await explorePage.assertTabsNotLoading();
    explorePage.blockAllQueriesExcept({
      refIds: [],
      legendFormats: [`{{${labelName}}}`],
    });
    const valueName = 'eu-west-1';
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${labelName}`).click();
    await page.getByTestId(`data-testid Panel header ${valueName}`).getByRole('button', { name: 'Include' }).click();
    await expect(page.getByLabel(`Edit filter with key ${labelName}`)).toBeVisible();

    // Navigate to logs query
    await explorePage.goToLogsTab();
    await explorePage.getLogsVolumePanelLocator().click();
    await page.getByTestId('data-testid Panel menu item Explore').click();

    await expect(
      page.getByText(
        `{service_name=\`tempo-distributor\`, ${labelName}=\`${valueName}\`} | json | logfmt | drop __error__, __error_details__`
      )
    ).toBeVisible();

    const toolBar = page.getByLabel('Explore toolbar');
    // Assert toolbar is visible before proceeding
    await expect(toolBar).toBeVisible();
    const extensionsButton = page.getByLabel('Add', { exact: true });
    await expect(extensionsButton).toHaveCount(1);
    // Click on extensions button
    await extensionsButton.click();
    const openInExploreLocator = page.getByLabel('Open in Explore Logs');
    await expect(openInExploreLocator).toBeVisible();
    // Click on open in logs explore
    await openInExploreLocator.click();

    const openInThisTabButtonLoc = page.getByRole('button', { name: 'Open', exact: true });
    await expect(openInThisTabButtonLoc).toBeVisible();
    // Click to open in this tab
    await openInThisTabButtonLoc.click();

    // Assert the variables are visible
    await expect(page.getByLabel(`Edit filter with key ${labelName}`)).toBeVisible();
    await expect(page.getByLabel(`Edit filter with key service_name`)).toBeVisible();

    await explorePage.assertTabsNotLoading();

    // Assert the label variable has the correct value
    // const labelFilter = page.getByTestId('AdHocFilter-cluster');
    const labelFilter = page.getByLabel(`Edit filter with key ${labelName}`);
    await expect(labelFilter).toBeVisible();
    await expect(labelFilter).toHaveText('cluster = eu-west-1');

    // Assert service variable has correct value
    const serviceFilter = page.getByLabel(`Edit filter with key service_name`);
    await expect(serviceFilter).toBeVisible();
    await expect(serviceFilter).toHaveText('service_name = tempo-distributor');
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
      refIds: ['logsPanelQuery'],
      legendFormats: [`{{${levelName}}}`],
    });
    await explorePage.goToFieldsTab();

    // Use the dropdown since the tenant field might not be visible
    await page.getByText('FieldAll').click();
    await page.keyboard.type('tenan');
    await page.keyboard.press('Enter');
    await explorePage.assertNotLoading();

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

    await explorePage.scrollToBottom();
    await expect(panels).toHaveCount(5);
    await page.keyboard.type('errr');
    await expect(panels).toHaveCount(2);
  });

  test(`should search fields for ${fieldName}`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await explorePage.assertNotLoading();
    await explorePage.click(page.getByLabel(`Select ${fieldName}`));
    await explorePage.click(page.getByPlaceholder('Search for value'));
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();
    await explorePage.assertNotLoading();
    // Assert there is at least 2 panels
    await expect(panels.nth(1)).toBeVisible();
    // expect(await panels.count()).toBeGreaterThan(1);
    await page.keyboard.type('brod');
    await expect(panels).toHaveCount(2);
  });

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
    await expect(allPanels).toHaveCount(9);
    // And we'll have 2 requests, one on the aggregation, one for the label values
    expect(requests).toHaveLength(2);

    // This should trigger more queries
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();

    // Should have removed a panel
    await expect(allPanels).toHaveCount(8);
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
    let requestCount = 0,
      logsCountQueryCount = 0;

    // We don't need to mock the response, but it speeds up the test
    await page.route('**/api/ds/query*', async (route, request) => {
      const mockResponse = mockEmptyQueryApiResponse;
      const rawPostData = request.postData();

      // We only want to mock the actual field requests, and not the initial request that returns us our list of fields
      if (rawPostData) {
        const postData = JSON.parse(rawPostData);
        const refId = postData.queries[0].refId;
        // Field subqueries have a refId of the field name
        if (refId !== 'logsPanelQuery' && refId !== 'A' && refId !== 'logsCountQuery') {
          requestCount++;
          // simulate the query taking some time
          await page.waitForTimeout(100);
          return await route.fulfill({ json: mockResponse });
        }
        if (refId === 'logsCountQuery') {
          logsCountQueryCount++;
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
    expect(logsCountQueryCount).toEqual(2);

    await explorePage.scrollToBottom();
    // Panel on the bottom should be visible
    await expect(page.getByTestId(/data-testid Panel header/).last()).toBeInViewport();
    // Panel on the top should not
    await expect(page.getByTestId(/data-testid Panel header/).first()).not.toBeInViewport();
    // Wait for a bit for the requests to be made
    await page.waitForTimeout(250);
    // if this flakes we could just assert that it's greater then 3
    expect(requestCount).toEqual(17);
    expect(logsCountQueryCount).toEqual(2);
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
    await expect(explorePage.getPanelContentLocator().getByRole('button').nth(1)).toBeVisible();
    expect(await row.count()).toBeGreaterThan(2);
    await explorePage.getPanelContentLocator().getByRole('button').nth(1).click();
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
    await page.getByLabel('Edit filter with key').click();
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
    const adHocLocator = explorePage.getLogsPanelLocator().getByText('mimir-distributor', { exact: true });
    await expect(adHocLocator).toHaveCount(1);
    // find text corresponding text to match adhoc filter
    await expect(adHocLocator).toBeVisible();
  });

  test('should filter logs by bytes range', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', 'bytes', 'pod'],
      legendFormats: [`{{${levelName}}}`],
    });

    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();

    // Wait for pod query to execute
    const expressions: string[] = [];
    await explorePage.waitForRequest(
      (q) => expressions.push(q.expr),
      (q) => q.expr.includes('pod')
    );

    expect(expressions[0]).toEqual(
      'sum by (pod) (count_over_time({service_name=`tempo-distributor`} | pod!=""       [$__auto]))'
    );

    const bytesIncludeButton = page
      .getByTestId('data-testid Panel header bytes')
      .getByTestId(testIds.breakdowns.common.filterButtonGroup);
    await expect(bytesIncludeButton).toHaveText('Add to filter');

    // Show the popover
    await bytesIncludeButton.click();
    const popover = page.getByRole('tooltip');
    await expect(popover).toHaveCount(1);

    // Popover copy assertions
    await expect(
      popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThanInclusive)
    ).toHaveText('Greater than');
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive)).toHaveText(
      'Less than'
    );

    // Bytes should be default unit
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThanUnit)).toHaveText(
      'UnitB'
    );
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanUnit)).toHaveText(
      'UnitB'
    );

    // Add button should be disabled
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton)).toBeDisabled();
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.cancelButton)).not.toBeDisabled();

    // Assert that the first input is focused
    const expectedFocusedElement = popover
      .getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThan)
      .locator('input:focus');
    await expect(expectedFocusedElement).toHaveCount(1);

    // Input 100 for greater than value
    await page.keyboard.type('500');

    // Submit button should be visible now
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton)).not.toBeDisabled();

    // input 500 for less than value
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThan).click();
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThan).pressSequentially('2');

    // Open unit "select"
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanUnit).locator('svg').click();

    // select kilobytes
    await popover
      .getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanUnit)
      .getByRole('listbox')
      .getByText('KB', { exact: true })
      .click();

    // Make inclusive
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive).click();
    await popover.getByText('Less than or equal').click();

    // Add the filter
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton).click();

    // Wait for pod query to execute
    const expressionsAfterNumericFilter: string[] = [];
    await explorePage.waitForRequest(
      (q) => expressionsAfterNumericFilter.push(q.expr),
      (q) => q.expr.includes('pod')
    );

    expect(expressionsAfterNumericFilter[0]).toEqual(
      'sum by (pod) (count_over_time({service_name=`tempo-distributor`} | pod!=""     | logfmt  | bytes>500B | bytes<=2KB [$__auto]))'
    );

    // Assert that the variables were added to the UI
    await expect(page.getByText(/^bytes>500B$/)).toHaveCount(1);
    await expect(page.getByText(/^bytes<=2KB$/)).toHaveCount(1);

    // Assert the pod and bytes panels have data
    await expect(
      page.getByTestId('data-testid Panel header pod').getByTestId('data-testid Panel data error message')
    ).toHaveCount(0);
    await expect(
      page.getByTestId('data-testid Panel header bytes').getByTestId('data-testid Panel data error message')
    ).toHaveCount(0);
  });

  test('should include all logs that contain bytes field', async ({ page }) => {
    let numberOfQueries = 0;
    // Click on the fields tab
    await explorePage.goToFieldsTab();
    // Selector
    const bytesIncludeButton = page
      .getByTestId('data-testid Panel header bytes')
      .getByTestId(testIds.breakdowns.common.filterButtonGroup);

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

    // Include
    await bytesIncludeButton.getByTestId(testIds.breakdowns.common.filterSelect).click();
    await bytesIncludeButton.getByText('Include', { exact: true }).click();

    // Assert the panel is still there
    expect(page.getByTestId('data-testid Panel header bytes')).toBeDefined();

    // Assert that the button state is now "include"
    await expect(bytesIncludeButton).toHaveText('Include');

    // Assert that we actually ran some queries
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
      .getByTestId(testIds.breakdowns.common.filterButtonGroup);

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

    // Open the dropdown and change from include to exclude
    await bytesIncludeButton.getByTestId(testIds.breakdowns.common.filterSelect).click();
    await bytesIncludeButton.getByText('Exclude', { exact: true }).click();

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
    const versionFilterButton = versionPanelLocator.getByTestId(testIds.breakdowns.common.filterButtonGroup);

    // Go to the fields tab and assert errors aren't showing
    await explorePage.goToFieldsTab();
    await expect(panelErrorLocator).toHaveCount(0);

    // Now assert that content is hidden (will hit 1000 series limit and throw error)
    await expect(contentPanelLocator).toHaveCount(0);
    await expect(versionPanelLocator).toHaveCount(1);

    // Open the dropdown and change from include to exclude
    await versionPanelLocator.getByTestId(testIds.breakdowns.common.filterSelect).click();
    await versionFilterButton.getByText('Exclude', { exact: true }).click();

    // Exclude version
    await expect(versionVariableLocator).toHaveCount(1);
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
    await page.getByLabel('Edit filter with key').click();
    await page.getByText('mimir-ingester').click();
    await explorePage.assertTabsNotLoading();
    await explorePage.goToLabelsTab();

    // Count panels, compare to tab count
    await expect(panels).toHaveCount(parseInt((await tabCountLocator.textContent()) as string, 10));
  });

  test('logs panel options: line wrap', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });

    // Check default values
    await expect(explorePage.getLogsDirectionNewestFirstLocator()).toBeChecked();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).not.toBeChecked();

    await expect(explorePage.getNowrapLocator()).toBeChecked();
    await expect(explorePage.getWrapLocator()).not.toBeChecked();

    await expect(explorePage.getTableToggleLocator()).not.toBeChecked();
    await expect(explorePage.getLogsToggleLocator()).toBeChecked();

    const firstRow = explorePage.getLogsPanelRow();
    const viewportSize = page.viewportSize();

    // Assert that the row has more width then the viewport (can scroll horizontally)
    expect((await firstRow.boundingBox()).width).toBeGreaterThanOrEqual(viewportSize.width);

    // Change line wrap
    await explorePage.getWrapLocator().click();

    await expect(explorePage.getNowrapLocator()).not.toBeChecked();
    await expect(explorePage.getWrapLocator()).toBeChecked();

    // Assert that the width is less than or equal to the window width (cannot scroll horizontally)
    expect((await firstRow.boundingBox()).width).toBeLessThanOrEqual(viewportSize.width);

    // Reload the page and verify the setting in local storage is applied to the panel
    await page.reload();
    await expect(explorePage.getNowrapLocator()).not.toBeChecked();
    await expect(explorePage.getWrapLocator()).toBeChecked();
    expect((await firstRow.boundingBox()).width).toBeLessThanOrEqual(viewportSize.width);
  });

  test('logs panel options: sortOrder', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });
    const firstRow = explorePage.getLogsPanelRow();
    const secondRow = explorePage.getLogsPanelRow(1);
    // third td/cell is time
    const firstRowTimeCell = firstRow.getByRole('cell').nth(2);
    const secondRowTimeCell = secondRow.getByRole('cell').nth(2);

    // Check default values
    await expect(explorePage.getLogsDirectionNewestFirstLocator()).toBeChecked();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).not.toBeChecked();

    await expect(explorePage.getNowrapLocator()).toBeChecked();
    await expect(explorePage.getWrapLocator()).not.toBeChecked();

    await expect(explorePage.getTableToggleLocator()).not.toBeChecked();
    await expect(explorePage.getLogsToggleLocator()).toBeChecked();

    const newestLogContent = await firstRow.textContent();

    // assert timesstamps are DESC (newest first)
    expect(new Date(await firstRowTimeCell.textContent()).valueOf()).toBeGreaterThanOrEqual(
      new Date(await secondRowTimeCell.textContent()).valueOf()
    );

    // Change sort order
    await explorePage.getLogsDirectionOldestFirstLocator().click();

    await expect(explorePage.getLogsDirectionNewestFirstLocator()).not.toBeChecked();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).toBeChecked();

    // Scroll the whole page to the bottom so the whole logs panel is visible
    await explorePage.scrollToBottom();

    // The logs panel keeps the lines in the viewport the same, but will scroll us down
    await expect(firstRow).not.toBeInViewport();
    await expect(page.getByText(newestLogContent)).toBeInViewport();

    // assert timestamps are ASC (oldest first)
    expect(new Date(await firstRowTimeCell.textContent()).valueOf()).toBeLessThanOrEqual(
      new Date(await secondRowTimeCell.textContent()).valueOf()
    );

    // Reload the page
    await page.reload();

    // Verify options are correct
    await expect(explorePage.getLogsDirectionNewestFirstLocator()).not.toBeChecked();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).toBeChecked();

    // assert timestamps are still ASC (oldest first)
    expect(new Date(await firstRowTimeCell.textContent()).valueOf()).toBeLessThanOrEqual(
      new Date(await secondRowTimeCell.textContent()).valueOf()
    );
  });

  test('panel menu: label name panel should open links in explore', async ({ page, context }) => {
    await explorePage.goToLabelsTab();
    await page.getByTestId('data-testid Panel menu detected_level').click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = page.getByRole('code').locator('div').filter({ hasText: 'sum(count_over_time({' }).nth(4);
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      'sum(count_over_time({service_name=`tempo-distributor`} | detected_level != "" [$__auto])) by (detected_level)'
    );
  });

  test('panel menu: label value panel should open links in explore', async ({ page, context }) => {
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();
    await page.getByTestId('data-testid Panel menu error').click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = page.getByRole('code').locator('div').filter({ hasText: 'sum(count_over_time({' }).nth(4);
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      'sum(count_over_time({service_name=`tempo-distributor`} | detected_level != "" [$__auto])) by (detected_level)'
    );
  });

  test('panel menu: field name panel should open links in explore', async ({ page, context }) => {
    await explorePage.goToFieldsTab();
    await page.getByTestId(`data-testid Panel menu ${fieldName}`).click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = page
      .getByRole('code')
      .locator('div')
      .filter({ hasText: `sum by (${fieldName}) (count_over_time({` })
      .nth(4);
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      `sum by (${fieldName}) (count_over_time({service_name=\`tempo-distributor\`} | logfmt | ${fieldName}!="" [$__auto]))`
    );
  });

  test('panel menu: field value panel should open links in explore', async ({ page, context }) => {
    await explorePage.goToFieldsTab();
    await page.getByLabel('Select caller').click();

    // Assert we've navigated to the sub page
    await expect(page.getByTestId('data-testid Panel menu poller.go:133')).toHaveCount(1);
    await page.getByTestId('data-testid Panel menu poller.go:133').click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = page
      .getByRole('code')
      .locator('div')
      .filter({ hasText: `sum by (${fieldName}) (count_over_time({` })
      .nth(4);
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      `sum by (${fieldName}) (count_over_time({service_name=\`tempo-distributor\`} | logfmt | ${fieldName}!="" [$__auto]))`
    );
  });

  test('label value summary panel: text search', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [],
      legendFormats: [`{{${levelName}}}`],
    });
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();

    const summaryPanel = page.getByTestId('data-testid Panel header detected_level');
    const summaryPanelBody = summaryPanel.getByTestId('data-testid panel content');
    const labelValueTextSearch = page.getByPlaceholder('Search for value');

    const debugPanel = page.getByTestId('data-testid Panel header debug');
    const warnPanel = page.getByTestId('data-testid Panel header warn');
    const infoPanel = page.getByTestId('data-testid Panel header info');
    const errorPanel = page.getByTestId('data-testid Panel header error');

    const debugLegend = page.getByTestId('data-testid VizLegend series debug').getByRole('button', { name: 'debug' });
    const warnLegend = page.getByTestId('data-testid VizLegend series warn').getByRole('button', { name: 'warn' });
    const infoLegend = page.getByTestId('data-testid VizLegend series info').getByRole('button', { name: 'info' });
    const errorLegend = page.getByTestId('data-testid VizLegend series error').getByRole('button', { name: 'error' });

    async function assertAllLevelsAreVisible() {
      // Assert the value panels are visible
      await expect(errorPanel).toBeVisible();
      await expect(warnPanel).toBeVisible();
      await expect(infoPanel).toBeVisible();
      await expect(debugPanel).toBeVisible();

      // Assert the legend options are visible
      await expect(errorLegend).toBeVisible();
      await expect(warnLegend).toBeVisible();
      await expect(infoLegend).toBeVisible();
      await expect(debugLegend).toBeVisible();
    }

    // assert by default, the summary panel is expanded
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).toBeVisible();

    await assertAllLevelsAreVisible();

    // Add text search
    await labelValueTextSearch.pressSequentially('wa');

    // Assert the value panels are not visible (except warn)
    await expect(errorPanel).not.toBeVisible();
    await expect(warnPanel).toBeVisible();
    await expect(infoPanel).not.toBeVisible();
    await expect(debugPanel).not.toBeVisible();

    // Assert the legend options are visible (except warn)
    await expect(errorLegend).not.toBeVisible();
    await expect(warnLegend).toBeVisible();
    await expect(infoLegend).not.toBeVisible();
    await expect(debugLegend).not.toBeVisible();

    // Clear the text search
    await page.getByRole('img', { name: 'Clear search' }).click();

    // Assert the value panels are visible
    await assertAllLevelsAreVisible();
  });

  test('field value summary panel: collapsable', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
    });

    await explorePage.goToFieldsTab();
    await explorePage.assertNotLoading();
    await explorePage.click(page.getByLabel(`Select ${fieldName}`));

    const summaryPanel = page.getByTestId(`data-testid Panel header ${fieldName}`);
    const summaryPanelBody = summaryPanel.getByTestId('data-testid panel content');
    const summaryPanelCollapseButton = page.getByRole('button', { name: fieldName, exact: true });

    const vizPanelMenu = page.getByTestId(`data-testid Panel menu ${fieldName}`);
    const vizPanelMenuExpandOption = page.getByTestId('data-testid Panel menu item Expand');

    // assert by default, the summary panel is expanded
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).toBeVisible();

    // Collapse
    await summaryPanelCollapseButton.click();

    // assert panel is collapsed
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).not.toBeVisible();

    // Reload the page
    await page.reload();
    await explorePage.assertNotLoading();

    // Assert the collapse state was saved to local storage and set as default
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).not.toBeVisible();

    // Open viz panel menu and toggle collapse state that way
    await vizPanelMenu.click();

    // Assert the "expand" option is visible in the menu
    await expect(vizPanelMenuExpandOption).toBeVisible();

    // Expand the panel
    await vizPanelMenuExpandOption.click();

    // Assert the panel body is visible again
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).toBeVisible();
  });
});
