import { expect, test } from '@grafana/plugin-e2e';
import { ComboBoxIndex, E2EComboboxStrings, ExplorePage, levelTextMatch, PlaywrightRequest } from './fixtures/explore';
import { testIds } from '../src/services/testIds';
import { mockEmptyQueryApiResponse } from './mocks/mockEmptyQueryApiResponse';
import { LokiQuery, LokiQueryDirection } from '../src/services/lokiQuery';
import { FilterOp } from '../src/services/filterTypes';
import { SERVICE_NAME } from '../src/services/variables';

const fieldName = 'caller';
const levelName = 'detected_level';
const metadataName = 'pod';
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
    // Submit filter
    await page.getByRole('button', { name: 'Include' }).click();
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

    // include eu-west-1 cluster
    const includeCluster = 'eu-west-1';
    const clusterIncludeSelectButton = page
      .getByTestId(`data-testid Panel header ${includeCluster}`)
      .getByTestId('data-testid button-filter-include');
    await expect(clusterIncludeSelectButton).toHaveCount(1);
    await clusterIncludeSelectButton.click();

    // include us-west-1 cluster
    const includeCluster2 = 'us-west-1';
    const cluster2IncludeSelectButton = page
      .getByTestId(`data-testid Panel header ${includeCluster2}`)
      .getByTestId('data-testid button-filter-include');
    await expect(clusterIncludeSelectButton).toHaveCount(1);
    await cluster2IncludeSelectButton.click();

    // assert there are 2 includes selected
    await expect(clusterIncludeSelectButton).toHaveAttribute('aria-selected', 'true');
    await expect(cluster2IncludeSelectButton).toHaveAttribute('aria-selected', 'true');

    // exclude "us-east-1" cluster
    const excludeCluster = 'us-east-1';
    const clusterExcludeSelectButton = page
      .getByTestId(`data-testid Panel header ${excludeCluster}`)
      .getByTestId('data-testid button-filter-exclude');
    await expect(clusterExcludeSelectButton).toHaveCount(1);
    await clusterExcludeSelectButton.click();

    // assert the includes were removed, exclude is shown
    await expect(clusterIncludeSelectButton).not.toHaveAttribute('aria-selected', 'true');
    await expect(cluster2IncludeSelectButton).not.toHaveAttribute('aria-selected', 'true');
    await expect(clusterExcludeSelectButton).toHaveAttribute('aria-selected', 'true');

    // Add an include which should remove exclude button
    await clusterIncludeSelectButton.click();
    await expect(clusterExcludeSelectButton).not.toHaveAttribute('aria-selected', 'true');
    await expect(clusterIncludeSelectButton).toHaveAttribute('aria-selected', 'true');

    // Navigate to labels tab
    await explorePage.goToLabelsTab();

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
  test(`combobox should replace service_name with regex ${labelName} in url`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['LABEL_BREAKDOWN_VALUES'],
    });

    await explorePage.assertTabsNotLoading();
    // Add custom value to combobox
    await explorePage.addCustomValueToCombobox(labelName, FilterOp.RegexEqual, ComboBoxIndex.labels, `us-.+`);

    // Remove current "primary" label used in the URL
    await page.getByLabel(E2EComboboxStrings.removeByKey(SERVICE_NAME)).click();

    // Assert cluster has been added as the new URL slug
    await expect(page).toHaveURL(/\/cluster\/us-\.\+\//);

    // Navigate to labels aggregation view
    await explorePage.goToLabelsTab();

    // Assert service_name is visible as a normal label
    const clusterNameSelect = page.getByLabel('Select cluster');

    // Assert cluster is visible as a normal label
    const serviceNameSelect = page.getByLabel('Select service_name');

    await expect(serviceNameSelect).toHaveCount(1);
    await expect(clusterNameSelect).toHaveCount(1);

    // add service exclude
    await clusterNameSelect.click();

    // Assert all three us-.+ cluster values are showing
    await expect(page.getByTestId(/data-testid Panel header us-.+/)).toHaveCount(3);

    // Assert there are only 4 panels (3 value panels + summary panel)
    await expect(page.getByTestId(/data-testid Panel header/)).toHaveCount(4);

    // exclude nginx service
    const usEastExcludeButton = page
      .getByTestId('data-testid Panel header us-east-1')
      .getByTestId('data-testid button-filter-exclude');

    await expect(usEastExcludeButton).toHaveCount(1);
    await usEastExcludeButton.click();

    // Assert service name exclusion filter is visible
    const clusterExcludeFilter = page.getByLabel(E2EComboboxStrings.editByKey('cluster')).last();
    await expect(clusterExcludeFilter).toHaveCount(1);
    await expect(clusterExcludeFilter).toHaveText('cluster != us-east-1');

    // Assert remaining two us-.+ cluster values are showing
    await expect(page.getByTestId(/data-testid Panel header us-.+/)).toHaveCount(3);

    // Assert there are only 3 panels (2 value panels + summary panel)
    await expect(page.getByTestId(/data-testid Panel header/)).toHaveCount(4);
  });

  test('logs panel should have panel-content class suffix', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(explorePage.getLogsPanelLocator().locator('[class$="panel-content"]')).toBeVisible();
  });

  test(`should show "Explore" on table panel menu`, async ({ page }) => {
    await explorePage.goToLogsTab();
    // Switch to table view
    await explorePage.getTableToggleLocator().click();

    await page.getByTestId('data-testid Panel menu Logs').click();
    await page.getByTestId('data-testid Panel menu item Explore').click();

    await expect(page.getByText(`drop __error__, __error_details__`)).toBeVisible();
  });

  test(`should persist column ordering`, async ({ page }) => {
    const table = page.getByTestId(testIds.table.wrapper);
    await explorePage.goToLogsTab();
    // Switch to table view
    await explorePage.getTableToggleLocator().click();

    // Assert table column order
    await expect(table.getByRole('columnheader').nth(0)).toContainText('timestamp');
    await expect(table.getByRole('columnheader').nth(0)).not.toContainText('body');
    await expect(table.getByRole('columnheader').nth(1)).toContainText('body');

    // Open the menu for "Line"
    await page.getByLabel(/Show body|Line menu/).click();
    await page.getByText('Move left').click();
    await expect(table.getByRole('columnheader').nth(0)).toContainText('body');

    // Refresh the page to see if the columns were saved in the url state
    await page.reload();
    await expect(table.getByRole('columnheader').nth(0)).toContainText('body');
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
    await expect(page.getByTestId(testIds.variables.levels.inputWrap)).toBeVisible();
    await expect(page.getByTestId(testIds.variables.levels.inputWrap)).toContainText(levelTextMatch);
  });

  test('table log line state should persist in the url', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });
    await explorePage.getTableToggleLocator().click();
    const table = page.getByTestId(testIds.table.wrapper);

    // assert the table doesn't contain the raw log line option by default
    await expect(table.getByTestId(testIds.table.rawLogLine)).toHaveCount(0);

    // Open menu
    await await page.getByLabel(/Show body|Line menu/).click();

    // Show log text option should be visible by default
    await expect(page.getByText('Show log text')).toBeVisible();

    // Change the option
    await page.getByText('Show log text').click();

    // Assert the change was made to the table
    await expect(table.getByTestId(testIds.table.rawLogLine).nth(0)).toBeVisible();

    await page.reload();
    await expect(table.getByTestId(testIds.table.rawLogLine).nth(0)).toBeVisible();
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

    await expect(page.getByTestId(testIds.variables.levels.inputWrap)).toContainText(valueName);
    await explorePage.goToLogsTab();
    await explorePage.getLogsVolumePanelLocator().click();
    await page.getByTestId('data-testid Panel menu item Explore').click();
    await expect(page.getByText(`{service_name="tempo-distributor"} | ${levelName}="${valueName}"`)).toBeVisible();
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
        `{service_name="tempo-distributor", ${labelName}="${valueName}"} | json | logfmt | drop __error__, __error_details__`
      )
    ).toBeVisible();

    const toolBar = page.getByLabel('Explore toolbar');
    // Assert toolbar is visible before proceeding
    await expect(toolBar).toBeVisible();
    const extensionsButton = page.getByRole('button', { name: 'Go queryless' });
    await expect(extensionsButton).toHaveCount(1);
    // Click on extensions button
    await extensionsButton.click();
    const openInExploreLocator = page.getByLabel('Open in Grafana Logs Drilldown').first();
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

    const excludeButton = page.getByRole('button', { name: 'Exclude' }).nth(0);

    // This should trigger more queries
    await excludeButton.click();
    // Should have excluded a panel
    await expect(excludeButton).toHaveAttribute('aria-selected', 'true');

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr).toContain('| logfmt | caller!=""');
      });
    });
    // Now we should still have 2 queries
    expect(requests).toHaveLength(2);
  });

  test(`should include field ${fieldName}, update filters, open filters breakdown`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await explorePage.scrollToBottom();
    await page.getByTestId(`data-testid Panel header ${fieldName}`).getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
    await expect(page.getByText('=').nth(1)).toBeVisible();
  });

  test(`Fields: can regex include ${fieldName} values containing "st"`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
    });
    await explorePage.goToFieldsTab();
    await explorePage.assertNotLoading();

    // Go to caller values breakdown
    await page.getByLabel(`Select ${fieldName}`).click();
    // Add custom regex value
    await explorePage.addCustomValueToCombobox(fieldName, FilterOp.RegexEqual, ComboBoxIndex.fields, `.+st.+`, 'ca');

    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
    await expect(page.getByText('=~')).toBeVisible();
    const panels = explorePage.getAllPanelsLocator();
    await expect(panels).toHaveCount(4);
    await expect(page.getByTestId(/data-testid Panel header .+st.+/).getByTestId('header-container')).toHaveCount(3);
  });

  test(`Levels: include ${levelName} values`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${levelName}}}`],
    });
    await explorePage.goToLabelsTab();

    // Go to caller values breakdown
    await page.getByLabel(`Select ${levelName}`).click();

    // Open fields combobox
    const comboboxLocator = page.getByTestId(testIds.variables.levels.inputWrap);
    await comboboxLocator.click();

    // Select debug|error
    await page.getByRole('option', { name: 'debug' }).click();
    await page.getByRole('option', { name: 'error' }).click();
    await page.keyboard.press('Escape');

    const panels = explorePage.getAllPanelsLocator();
    await expect(panels).toHaveCount(5);
    await expect(page.getByTestId(/data-testid Panel header debug|error/).getByTestId('header-container')).toHaveCount(
      2
    );
  });

  test(`Metadata: can regex include ${metadataName} values containing "0\\d"`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [metadataName],
    });

    await explorePage.goToFieldsTab();

    // Go to caller values breakdown
    await page.getByLabel(`Select ${metadataName}`).click();

    // Filter by cluster
    await explorePage.addCustomValueToCombobox('cluster', FilterOp.RegexEqual, ComboBoxIndex.labels, `.+east-1$`);
    // Add both tempo services
    await explorePage.addCustomValueToCombobox('service_name', FilterOp.RegexEqual, ComboBoxIndex.labels, `tempo.+`);
    await explorePage.addCustomValueToCombobox('namespace', FilterOp.RegexEqual, ComboBoxIndex.labels, `.+dev.*`);
    // Remove tempo-distributor
    await page.getByLabel('Remove filter with key').first().click();

    await explorePage.assertNotLoading();
    await explorePage.assertPanelsNotLoading();

    // Get panel count to ensure the pod regex filter reduces the result set
    const panelCount = await explorePage.getAllPanelsLocator().count();
    expect(panelCount).toBeGreaterThan(8);
    // Filter hardcoded pod names for tempo-ingester service
    await explorePage.addCustomValueToCombobox(
      metadataName,
      FilterOp.RegexEqual,
      ComboBoxIndex.fields,
      `tempo-ingester-[hc]{2}-\\d.+`
    );

    await expect(page.getByLabel(E2EComboboxStrings.editByKey(metadataName))).toBeVisible();
    await expect(page.getByText('=~').nth(3)).toBeVisible();
    const panels = explorePage.getAllPanelsLocator();
    await expect(panels).toHaveCount(9);
    await expect(
      page.getByTestId(/data-testid Panel header tempo-ingester-[hc]{2}-\d.+/).getByTestId('header-container')
    ).toHaveCount(8);
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

    // Assert the container size of the plugin hasn't changed, or that will mess with the assumptions below
    const pageContainerSize = await page.locator('#pageContent').boundingBox();
    expect(pageContainerSize.width).toEqual(1280);
    expect(pageContainerSize.height).toEqual(640);

    const INITIAL_ROWS = 2;
    const COUNT_PER_ROW = 3;
    const TOTAL_ROWS = 7;

    // Fields on top should be loaded
    expect(requestCount).toEqual(INITIAL_ROWS * COUNT_PER_ROW);
    expect(logsCountQueryCount).toEqual(2);

    await explorePage.scrollToBottom();
    // Panel on the bottom should be visible
    await expect(page.getByTestId(/data-testid Panel header/).last()).toBeInViewport();
    // Panel on the top should not
    await expect(page.getByTestId(/data-testid Panel header/).first()).not.toBeInViewport();
    // Wait for a bit for the requests to be made
    await page.waitForTimeout(250);
    // 7 rows, last row only has 2
    expect(requestCount).toEqual(TOTAL_ROWS * COUNT_PER_ROW - 1);
    expect(logsCountQueryCount).toEqual(2);
  });

  test('Patterns should show error state when API call returns error', async ({ page }) => {
    // Block everything to speed up the test
    explorePage.blockAllQueriesExcept({
      refIds: ['C'],
    });

    await page.route('**/resources/patterns**', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: '{"message":"","traceID":"abc123"}',
      });
    });
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    await expect(page.getByText('Pattern matching has not been configured.')).toBeVisible();
  });

  test(`should select field ${fieldName}, update filters, open log panel`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await page.getByTestId(`data-testid Panel header ${fieldName}`).getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
  });

  test('should show sample table on `<_>` click in patterns', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['A'],
    });
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    await page.getByText('<_>').last().click();
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
      'sum by (pod) (count_over_time({service_name="tempo-distributor"} | pod!=""       [$__auto]))'
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
      'sum by (pod) (count_over_time({service_name="tempo-distributor"} | pod!=""     | logfmt  | bytes<=2KB | bytes>500B [$__auto]))'
    );

    // Assert that the variables were added to the UI
    await expect(page.getByText(/^bytes > 500B$/)).toHaveCount(1);
    await expect(page.getByText(/^bytes <= 2KB$/)).toHaveCount(1);

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
    await expect(page.getByLabel(E2EComboboxStrings.editByKey('bytes'))).toHaveCount(1);
    await expect(explorePage.getAllPanelsLocator()).toHaveCount(0);
    await page.getByText('Clear filters').click();
    await expect(page.getByLabel(E2EComboboxStrings.editByKey('bytes'))).toHaveCount(0);
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
    const versionVariableLocator = page.getByLabel(E2EComboboxStrings.editByKey('version'));
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
    await expect(versionVariableLocator).toContainText('=');
    await expect(versionVariableLocator).not.toContainText('!=');

    // Open the menu
    await versionVariableLocator.click();
    await page.getByLabel('Edit filter operator').click();

    // assert the options are showing
    await expect(explorePage.getOperatorLocator(FilterOp.Equal)).toHaveCount(1);
    await expect(explorePage.getOperatorLocator(FilterOp.NotEqual)).toHaveCount(1);
    await expect(explorePage.getOperatorLocator(FilterOp.RegexEqual)).toHaveCount(1);
    await expect(explorePage.getOperatorLocator(FilterOp.RegexNotEqual)).toHaveCount(1);

    // Click the other option and exclude version
    await explorePage.getOperatorLocator(FilterOp.NotEqual).click();

    // Need to use the keyboard because by default the combobox matches everything until the user starts typing, even if a value is already present
    // @todo is this a bug in the combobox?
    await page.keyboard.press('Tab');

    // Check the right options are visible
    await expect(versionVariableLocator).toContainText('!=');

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
    expect((await firstRow.boundingBox())?.width).toBeGreaterThanOrEqual(viewportSize?.width ?? -1);

    // Change line wrap
    await explorePage.getWrapLocator().click();

    await expect(explorePage.getNowrapLocator()).not.toBeChecked();
    await expect(explorePage.getWrapLocator()).toBeChecked();

    // Assert that the width is less than or equal to the window width (cannot scroll horizontally)
    expect((await firstRow.boundingBox())?.width).toBeLessThanOrEqual(viewportSize?.width ?? Infinity);

    // Reload the page and verify the setting in local storage is applied to the panel
    await page.reload();
    await expect(explorePage.getNowrapLocator()).not.toBeChecked();
    await expect(explorePage.getWrapLocator()).toBeChecked();
    expect((await firstRow.boundingBox())?.width).toBeLessThanOrEqual(viewportSize?.width ?? Infinity);
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

    // assert timestamps are ASC (oldest first)
    expect(new Date(await firstRowTimeCell.textContent()).valueOf()).toBeLessThanOrEqual(
      new Date(await secondRowTimeCell.textContent()).valueOf()
    );

    // Changing the sort order triggers a new query with the opposite query direction
    let queryWithForwardDirectionExecuted = false;
    await explorePage.waitForRequest(
      () => {
        queryWithForwardDirectionExecuted = true;
      },
      (q) => q.direction === LokiQueryDirection.Forward
    );

    expect(queryWithForwardDirectionExecuted).toEqual(true);

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

  test('logs panel options: url sync', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', 'A'],
    });

    // Check default values
    await expect(explorePage.getLogsDirectionNewestFirstLocator()).toBeChecked();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).not.toBeChecked();

    await expect(explorePage.getNowrapLocator()).toBeChecked();
    await expect(explorePage.getWrapLocator()).not.toBeChecked();

    const viewportSize = page.viewportSize();

    // Check annotation location
    const boundingBoxDesc = await page.getByTestId('data-testid annotation-marker').boundingBox();

    // Annotation should be on the right side of the viewport
    expect(boundingBoxDesc?.x).toBeGreaterThan((viewportSize?.width ?? -1) / 2);

    // Check non-default values
    await explorePage.gotoLogsPanel('Ascending', 'true');

    await expect(explorePage.getLogsDirectionNewestFirstLocator()).not.toBeChecked();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).toBeChecked();

    await expect(explorePage.getNowrapLocator()).not.toBeChecked();
    await expect(explorePage.getWrapLocator()).toBeChecked();

    // Check annotation location
    const boundingBoxAsc = await page.getByTestId('data-testid annotation-marker').boundingBox();

    // Annotation should be on the left side of the viewport
    expect(boundingBoxAsc?.x).toBeLessThan((viewportSize?.width ?? Infinity) / 2);
  });

  test('url sharing', async ({ page }) => {
    explorePage.blockAllQueriesExcept({ refIds: ['NA'] });
    await page.getByLabel('Copy shortened URL').click();
    await expect(page.getByText('Shortened link copied to')).toBeVisible();
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
      'sum(count_over_time({service_name="tempo-distributor"} | detected_level != "" [$__auto])) by (detected_level)'
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
      'sum(count_over_time({service_name="tempo-distributor"} | detected_level != "" [$__auto])) by (detected_level)'
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
      `sum by (${fieldName}) (count_over_time({service_name="tempo-distributor"} | logfmt | ${fieldName}!="" [$__auto]))`
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
      `sum by (${fieldName}) (count_over_time({service_name="tempo-distributor"} | logfmt | ${fieldName}!="" [$__auto]))`
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
    await page.getByLabel('Clear search').click();

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

  test.describe('line filters', () => {
    test('line filter', async ({ page }) => {
      let requestCount = 0,
        logsCountQueryCount = 0,
        logsPanelQueryCount = 0;

      explorePage.blockAllQueriesExcept({
        refIds: ['logsPanelQuery'],
        legendFormats: [],
      });

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
            return await route.fulfill({ json: mockResponse });
          }
          if (refId === 'logsCountQuery') {
            logsCountQueryCount++;
          }
          if (refId === 'logsPanelQuery') {
            logsPanelQueryCount++;
          }
        }

        // Otherwise let the request go through normally
        const response = await route.fetch();
        const json = await response.json();
        return route.fulfill({ response, json });
      });

      requestCount = 0;
      logsCountQueryCount = 0;
      logsPanelQueryCount = 0;

      // Locators
      const lastLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).last();
      const firstLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).first();
      // const lineFilters = page.getByTestId(testIds.exploreServiceDetails.searchLogs)
      const logsPanelContent = explorePage.getLogsPanelLocator().getByTestId('data-testid panel content');
      const rows = logsPanelContent.getByRole('row');
      const firstRow = rows.nth(0);
      const highlightedMatchesInFirstRow = firstRow.locator('mark');

      await explorePage.goToLogsTab();
      await expect(lastLineFilterLoc).toHaveCount(1);
      await expect(logsPanelContent).toHaveCount(1);
      await expect(firstRow).toHaveCount(1);
      await expect(highlightedMatchesInFirstRow).toHaveCount(0);

      // One logs panel query should have fired
      expect(logsCountQueryCount).toEqual(1);
      expect(logsPanelQueryCount).toEqual(1);

      await lastLineFilterLoc.click();
      await page.keyboard.type('Debug');
      await page.getByRole('button', { name: 'Include' }).click();
      await expect(highlightedMatchesInFirstRow).toHaveCount(1);

      // Now 2 queries should have fired
      expect(logsCountQueryCount).toEqual(2);
      expect(logsPanelQueryCount).toEqual(2);

      // switch to case-sensitive in the global variable
      await page.getByLabel('Enable case match').nth(0).click();
      await expect(rows).toHaveCount(0);
      expect(logsCountQueryCount).toEqual(3);
      expect(logsPanelQueryCount).toEqual(3);

      // Clear the text - should trigger query
      await page.getByLabel('Line filter variable').click();
      // Enable regex - should not trigger empty query
      await page.getByLabel('Enable regex').click();
      // Enable case - should not trigger empty query
      await page.getByLabel('Enable case match').click();
      await expect(firstRow).toHaveCount(1);
      expect(logsCountQueryCount).toEqual(4);
      expect(logsPanelQueryCount).toEqual(4);

      // Add regex string
      await lastLineFilterLoc.click();
      await page.keyboard.type('[dD]ebug');
      await page.getByRole('button', { name: 'Include' }).click();
      await expect(highlightedMatchesInFirstRow).toHaveCount(1);
      expect(logsCountQueryCount).toEqual(5);
      expect(logsPanelQueryCount).toEqual(5);

      // Disable regex - expect no results show
      await page.getByLabel('Disable regex').nth(0).click();
      await expect(rows).toHaveCount(0);
      expect(logsCountQueryCount).toEqual(6);
      expect(logsPanelQueryCount).toEqual(6);

      // Re-enable regex - results should show
      await page.getByLabel('Enable regex').click();
      await expect(highlightedMatchesInFirstRow).toHaveCount(1);
      expect(logsCountQueryCount).toEqual(7);
      expect(logsPanelQueryCount).toEqual(7);

      // Change the filter in the "saved" variable that will return 0 results
      await firstLineFilterLoc.click();
      await page.keyboard.type('__');
      await expect(rows).toHaveCount(0);
      expect(logsCountQueryCount).toEqual(8);
      expect(logsPanelQueryCount).toEqual(8);
    });
    test('line filter migration case sensitive', async ({ page }) => {
      // Checks chars that are escaped on-behalf of the user and chars that are user-escaped, e.g. `\n` (`%5C%5Cn`) => \n, `%5C.` (\.) => .
      const urlEncodedAndEscaped =
        '%5C%5Cnpage_url%3D%22https:%2F%2Fgrafana%5C.net%2Fexplore%5C%3Fleft%3D%5C%7B%22datasource%22:%22grafanacloud-prom%22,%22queries%22:%5C%5B%5C%7B%22datasource%22:%5C%7B%22type%22:%22prometheus%22,%22uid%22:%22grafanacloud-prom%22%5C%7D,%22expr%22:%22max%20by%20%5C%28kube_cluster_name,%20kube_namespace%5C%29%20%5C%28quantile_over_time%5C%280%5C.85,%20kubernetes_state_pod_age%5C%7Bplatform%3D%22data%22,kube_namespace%21~%22data-dev%5C%7Cdata-stg-%5C.%5C%2B%22,pod_phase%3D%22pending%22%5C%7D%5C%5B5m%5C%5D%5C%29%5C%29%20%3E%20600%22,%22refId%22:%22A%22%5C%7D%5C%5D,%22range%22:%5C%7B%22from%22:%22now-1h%22,%22to%22:%22now%22%5C%7D%5C%7D%22%60';
      const decodedAndUnescaped =
        '`\\npage_url="https://grafana.net/explore?left={"datasource":"grafanacloud-prom","queries":[{"datasource":{"type":"prometheus","uid":"grafanacloud-prom"},"expr":"max by (kube_cluster_name, kube_namespace) (quantile_over_time(0.85, kubernetes_state_pod_age{platform="data",kube_namespace!~"data-dev|data-stg-.+",pod_phase="pending"}[5m])) > 600","refId":"A"}],"range":{"from":"now-1h","to":"now"}}"`';
      await explorePage.gotoServicesOldUrlLineFilters('tempo-distributor', true, urlEncodedAndEscaped);
      const firstLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).first();

      await expect(firstLineFilterLoc).toHaveCount(1);
      await expect(page.getByLabel('Enable case match').nth(0)).toHaveCount(1);
      await expect(page.getByLabel('Disable case match')).toHaveCount(0);
      await expect(firstLineFilterLoc).toHaveValue(decodedAndUnescaped);
    });
    test('line filter migration case insensitive', async ({ page }) => {
      // The behavior for user entered escape chars differed between case sensitive/insensitive before the line filter regex feature, we want to preserve this bug in the migration so links from before this feature will return the same results
      const urlEncodedAndEscaped =
        '%5C%5Cnpage_url%3D%22https:%2F%2Fgrafana%5C.net%2Fexplore%5C%3Fleft%3D%5C%7B%22datasource%22:%22grafanacloud-prom%22,%22queries%22:%5C%5B%5C%7B%22datasource%22:%5C%7B%22type%22:%22prometheus%22,%22uid%22:%22grafanacloud-prom%22%5C%7D,%22expr%22:%22max%20by%20%5C%28kube_cluster_name,%20kube_namespace%5C%29%20%5C%28quantile_over_time%5C%280%5C.85,%20kubernetes_state_pod_age%5C%7Bplatform%3D%22data%22,kube_namespace%21~%22data-dev%5C%7Cdata-stg%22,pod_phase%3D%22pending%22%5C%7D%5C%5B5m%5C%5D%5C%29%5C%29%20%3E%20600%22,%22refId%22:%22A%22%5C%7D%5C%5D,%22range%22:%5C%7B%22from%22:%22now-1h%22,%22to%22:%22now%22%5C%7D%5C%7D%22%60';
      const decodedAndUnescaped =
        '\\\\npage_url="https://grafana.net/explore?left={"datasource":"grafanacloud-prom","queries":[{"datasource":{"type":"prometheus","uid":"grafanacloud-prom"},"expr":"max by (kube_cluster_name, kube_namespace) (quantile_over_time(0.85, kubernetes_state_pod_age{platform="data",kube_namespace!~"data-dev|data-stg",pod_phase="pending"}[5m])) > 600","refId":"A"}],"range":{"from":"now-1h","to":"now"}}"';
      await explorePage.gotoServicesOldUrlLineFilters('tempo-distributor', false, urlEncodedAndEscaped);
      const firstLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).first();

      await expect(firstLineFilterLoc).toHaveCount(1);
      await expect(page.getByLabel('Disable case match')).toHaveCount(1);
      await expect(page.getByLabel('Enable case match')).toHaveCount(1);
      await expect(firstLineFilterLoc).toHaveValue(decodedAndUnescaped);
    });
    test('line filter links', async ({ page }) => {
      explorePage.blockAllQueriesExcept({
        refIds: ['logsPanelQuery'],
        legendFormats: [],
      });

      // raw logQL query: '{cluster="us-west-1"} |~ "\\\\n" |= "\\n" |= "getBookTitles(Author.java:25)\\n" |~ "getBookTitles\\(Author\\.java:25\\)\\\\n" | json | logfmt | drop __error__, __error_details__'
      const queryInUrl =
        '{cluster=\\"us-west-1\\"} |~ \\"\\\\\\\\\\\\\\\\n\\" |= \\"\\\\\\\\n\\" |= \\"getBookTitles(Author.java:25)\\\\\\\\n\\" |~ \\"getBookTitles\\\\\\\\(Author\\\\\\\\.java:25\\\\\\\\)\\\\\\\\\\\\\\\\n\\" | json | logfmt | drop __error__, __error_details__';
      await page.goto(
        `/explore?schemaVersion=1&panes={"dx6":{"datasource":"gdev-loki","queries":[{"refId":"logsPanelQuery","expr":"${queryInUrl}","datasource":{"type":"loki","uid":"gdev-loki"}}],"range":{"from":"now-30m","to":"now"},"panelsState":{"logs":{"visualisationType":"logs"}}}}&orgId=1`
      );

      // Assert there are results
      const firstExplorePanelRow = page.getByTestId('logRows').locator('tr').first();
      await expect(firstExplorePanelRow).toHaveCount(1);
      await expect(firstExplorePanelRow).toBeVisible();
      const queryFieldText = await page.getByTestId('data-testid Query field').textContent();

      // Open "Go queryless" menu
      const extensionsButton = page.getByText('Go queryless');
      await expect(extensionsButton).toHaveCount(1);
      await extensionsButton.click();

      // Go to explore logs
      const openInExploreLocator = page.getByLabel('Open in Grafana Logs Drilldown').first();
      await expect(openInExploreLocator).toBeVisible();
      await openInExploreLocator.click();
      await page.getByRole('button', { name: 'Open', exact: true }).click();

      // Assert query returned results after nav
      const firstExploreLogsRow = page
        .getByTestId(/data-testid Panel header Logs/)
        .getByTestId('data-testid panel content')
        .locator('tr')
        .first();
      await expect(firstExploreLogsRow).toHaveCount(1);
      await expect(firstExploreLogsRow).toBeVisible();

      const lineFilters = page.getByTestId('data-testid search-logs');

      // Assert the line filters have escaped the values correctly and are in the right order
      await expect(lineFilters).toHaveCount(5);
      await expect(lineFilters.nth(0)).toHaveValue('\\\\n');
      await expect(lineFilters.nth(1)).toHaveValue('\\n');
      await expect(lineFilters.nth(2)).toHaveValue('getBookTitles(Author.java:25)\\n');
      await expect(lineFilters.nth(3)).toHaveValue('getBookTitles\\(Author\\.java:25\\)\\\\n');

      // go back to explore
      await page.getByTestId(/data-testid Panel menu Logs/).click();
      await page.getByTestId('data-testid Panel menu item Explore').click();

      // Explore query should be unchanged
      expect(await page.getByTestId('data-testid Query field').textContent()).toContain(
        queryFieldText?.replace('Enter to Rename, Shift+Enter to Preview', '')
      );
    });
  });
});
