import {expect, test} from '@grafana/plugin-e2e';
import {ExplorePage} from './fixtures/explore';
import {testIds} from '../src/services/testIds';
import {mockEmptyQueryApiResponse} from "./mocks/mockEmptyQueryApiResponse";

test.describe('explore services breakdown page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
    await page.evaluate(() => window.localStorage.clear());
    await explorePage.gotoServicesBreakdown();
  });

  test('should filter logs panel on search', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(page.getByRole('table').locator('tr').first().getByText('broadcast')).toBeVisible();
    await expect(page).toHaveURL(/broadcast/);
  });

  test('logs panel should have panel-content class suffix', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(page.getByTestId('data-testid Panel header Logs').locator('[class$="panel-content"]')).toBeVisible();
  });

  test('should filter table panel on text search', async ({ page }) => {
    const initialText = await page.getByTestId(testIds.table.wrapper).allTextContents()
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(1).click()
    const afterFilterText = await page.getByTestId(testIds.table.wrapper).allTextContents()
    expect(initialText).not.toBe(afterFilterText)
  })

  test('should change filters on table click', async ({ page }) => {
    // Switch to table view
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(1).click()

    const table = page.getByTestId(testIds.table.wrapper);
    // Get a level pill, and click it
    const levelPill = table.getByRole('cell').getByText("level=").first()
    await levelPill.click()
    // Get the context menu
    const pillContextMenu = table.getByRole('img', { name: 'Add to search' });
    // Assert menu is open
    await expect(pillContextMenu).toBeVisible()
    // Click the filter button
    await pillContextMenu.click()
    // New level filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label detected_level')).toBeVisible()
  })

  test('should show inspect modal', async ({ page }) => {
    await page.getByRole('radiogroup').getByTestId(testIds.logsPanelHeader.radio).nth(1).click()
    // Expect table to be rendered
    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible();

    await page.getByTestId(testIds.table.inspectLine).last().click();
    await expect(page.getByRole('dialog', { name: 'Inspect value' })).toBeVisible()
  });

  test('should select a label, update filters, open in explore', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await page.getByLabel('Select detected_level').click();
    await page.getByTestId('data-testid Panel header info').getByRole('button', { name: 'Include' }).click();
    await expect(
      page.getByTestId('data-testid Dashboard template variables submenu Label detected_level')
    ).toBeVisible();
    const page1Promise = page.waitForEvent('popup');
    await explorePage.serviceBreakdownOpenExplore.click();
    const page1 = await page1Promise;
    await expect(page1.getByText('{service_name=`tempo-distributor`}')).toBeVisible();
  });

  test('should select a label, label added to url', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    const labelsUrlArray = page.url().split('/')
    expect(labelsUrlArray[labelsUrlArray.length - 1].startsWith('labels')).toEqual(true)

    await page.getByLabel('Select detected_level').click();
    const urlArray = page.url().split('/')
    expect(urlArray[urlArray.length - 1].startsWith('detected_level')).toEqual(true)
    // Can't import the enum as it's in the same file as the PLUGIN_ID which doesn't like being imported
    expect(urlArray[urlArray.length - 2]).toEqual('label')
  });

  test('should update labels sort order', async ({page}) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await page.getByLabel('Select detected_level').click();

    // Assert loading is done and panels are showing
    const panels = page.getByTestId(/data-testid Panel header/)
    await expect(panels.first()).toBeVisible()
    const panelTitles: Array<string | null> = [];

    for (const panel of await panels.all()) {
      const panelTitle = await panel.getByRole('heading').textContent()
      panelTitles.push(panelTitle)
    }

    expect(panelTitles.length).toBeGreaterThan(0)

    await page.getByTestId('data-testid SortBy direction').click()
    // Desc is the default option, this should be a noop
    await page.getByRole('option', {name: 'Desc'}).click()

    await expect(panels.first()).toBeVisible()
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[i])
    }

    await page.getByTestId('data-testid SortBy direction').click()
    // Now change the sort order
    await page.getByRole('option', {name: 'Asc'}).click()

    await expect(panels.first()).toBeVisible()
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[panelTitles.length - i - 1])
    }
  })

  test('should update fields sort order', async ({page}) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    // Use the dropdown since the tenant field might not be visible
    await page.getByText('FieldAll').click();
    await page.keyboard.type('tenan');
    await page.keyboard.press('Enter');

    // Assert loading is done and panels are showing
    const panels = page.getByTestId(/data-testid Panel header/)
    await expect(panels.first()).toBeVisible()
    const panelTitles: Array<string | null> = [];

    for (const panel of await panels.all()) {
      const panelTitle = await panel.getByRole('heading').textContent()
      panelTitles.push(panelTitle)
    }

    expect(panelTitles.length).toBeGreaterThan(0)

    await page.getByTestId('data-testid SortBy direction').click()
    // Desc is the default option, this should be a noop
    await page.getByRole('option', {name: 'Desc'}).click()

    await expect(panels.first()).toBeVisible()
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[i])
    }

    await page.getByTestId('data-testid SortBy direction').click()
    // Now change the sort order
    await page.getByRole('option', {name: 'Asc'}).click()

    await expect(panels.first()).toBeVisible()
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[panelTitles.length - i - 1])
    }
  })

  test('should search labels', async({page}) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await page.getByLabel('Select detected_level').click();
    await page.getByPlaceholder('Search for value').click()
    const panels = page.getByTestId(/data-testid Panel header/)
    await expect(panels.first()).toBeVisible()
    expect(await panels.count()).toEqual(4)
    await page.keyboard.type('errr')
    expect(await panels.count()).toEqual(1)
  })

  test('should search fields', async({page}) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await page.getByLabel('Select caller').click();
    await page.getByPlaceholder('Search for value').click()
    const panels = page.getByTestId(/data-testid Panel header/)
    await expect(panels.first()).toBeVisible()
    expect(await panels.count()).toBeGreaterThan(1)
    await page.keyboard.type('brod')
    expect(await panels.count()).toEqual(1)
  })

  test('should exclude a label, update filters', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // Adhoc err filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label err')).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();
  });

  test('should include a label, update filters, open filters breakdown', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();

    await explorePage.assertFieldsIndex()
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label err')).toBeVisible();
    await expect(page.getByText('=').nth(1)).toBeVisible();
  });

  test('should only load fields that are in the viewport', async ({page}) => {
    let requestCount = 0;

    // We don't need to mock the response, but it speeds up the test
    await page.route('**/api/ds/query*', async (route, request) => {
      const mockResponse = mockEmptyQueryApiResponse;
      const rawPostData= request.postData()

      // We only want to mock the actual field requests, and not the initial request that returns us our list of fields
      if(rawPostData){
        const postData = JSON.parse(rawPostData);
        const refId = postData.queries[0].refId
        // Field subqueries have a refId of the field name
        if(refId !== 'logsPanelQuery' && refId !== 'A'){
          requestCount++
          return await route.fulfill({json: mockResponse})
        }
      }

      // Otherwise let the request go through normally
      const response = await route.fetch();
      const json = await response.json()
      return route.fulfill({response, json})
    })

    // Navigate to fields tab
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();

    // Make sure the panels have started to render
    await expect(page.getByTestId('data-testid Panel header active_series')).toBeInViewport()

    // Fields on top should be loaded
    expect(requestCount).toEqual(6)

    await explorePage.scrollToBottom()
    // Panel on the bottom should be visible
    await expect(page.getByTestId('data-testid Panel header version')).toBeInViewport()

    // Panel on the top should not
    await expect(page.getByTestId('data-testid Panel header detected_level')).not.toBeInViewport()

    // if this flakes we could just assert that it's greater then 3
    expect(requestCount).toEqual(13)

    await page.unrouteAll();
  })

  test('should select a field, update filters, open log panel', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    await explorePage.assertFieldsIndex()
    // Adhoc err filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label err')).toBeVisible();
  });

  test('should search patterns by text', async ({
    page
  }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    // Get the cell within the second row
    const patternTextCell = page
        .getByTestId(testIds.patterns.tableWrapper)
        .getByRole('table')
        .getByRole('row')
        .nth(2)
        .getByRole('cell')
        .nth(3)

    // Assert the target row is visible
    await expect(patternTextCell).toBeVisible()

    // Count all of the rows in the table before filtering
    const countOfAllRows = await page
        .getByTestId(testIds.patterns.tableWrapper)
        .getByRole('table')
        .getByRole('row')
        .count()

    // Get the full pattern from the cell
    const searchText = await patternTextCell.textContent() as string;
    expect(searchText).not.toBeUndefined()

    // Get the input
    const patternSearchInput = page.getByPlaceholder('Search patterns');

    // Set the content
    await patternSearchInput.fill(searchText)

    // Expect input is visible
    await expect(patternSearchInput).toBeVisible()

    // Get the first row after filtering
    const patternTextCellAfterFilter = page
        .getByTestId(testIds.patterns.tableWrapper)
        .getByRole('table')
        .getByRole('row')
        // First row is header?
        .nth(1)
        .getByRole('cell')
        .nth(3)

    // Assert that the visible row has the desired search string
    await expect(patternTextCellAfterFilter).toBeVisible()
    expect(await patternTextCellAfterFilter.textContent()).toBeDefined()

    // Count the rows after filtering
    const countOfAllRowsAfterFilter = await page
        .getByTestId(testIds.patterns.tableWrapper)
        .getByRole('table')
        .getByRole('row')
        // Header takes up a row
        .count() - 1

    // Assert count should always be 1 unless one pattern contains another
    expect(countOfAllRowsAfterFilter).toBeGreaterThanOrEqual(1)
    expect(countOfAllRows).toBeGreaterThan(countOfAllRowsAfterFilter)

    // Assert the viz was filtered as well
    const legendIconsCount = await page.getByTestId('series-icon').count()
    expect(legendIconsCount).toBe(countOfAllRowsAfterFilter)
  });

    test('should select an include pattern field in default single view, update filters, not open log panel', async ({
    page,
  }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    // Include pattern
    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
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
      .getByRole('row').nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const firstExcludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(2)
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
      .getByRole('row').nth(3)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterExclude);
    await secondExcludeButton.click();

    // Both exclude patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).not.toBeVisible();
    await expect(page.getByTestId(testIds.patterns.buttonExcludedPattern)).toBeVisible();


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
      .getByRole('row').nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const secondIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row').nth(3)
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
    await expect(page.getByTestId(testIds.logsPanelHeader.header).getByLabel('Panel loading bar')).not.toBeVisible()

    // open logs panel
    await page.getByTitle('See log details').nth(1).click();

    // find text corresponding text to match adhoc filter
    await expect(
      page.getByRole('cell', { name: 'Fields Ad-hoc statistics' }).getByText('mimir-distributor').nth(0)
    ).toBeVisible();
  });
});
