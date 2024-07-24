import {expect, test} from '@grafana/plugin-e2e';
import {ExplorePage} from './fixtures/explore';
import {testIds} from '../src/services/testIds';
import {FilterOp} from '../src/services/filters';
import {async} from "rxjs";
import {APIResponse} from "@playwright/test";
import * as Buffer from "buffer";

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

  test('detected_labels that returns labels should not show empty state', async({page}) => {
    await page.route(/detected_labels/, (route) => route.fulfill({
      status: 200,
      body: JSON.stringify({
        "detectedLabels": [
          {
            "label": "cluster",
            "cardinality": 4
          },
          {
            "label": "pod",
            "cardinality": 40
          }
        ]
      })
    }));

    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await expect(page.getByTestId('Spinner')).not.toBeVisible()
    await expect(page.getByText('The labels are not available at this moment.')).not.toBeVisible()
    await expect(page.getByTestId('data-testid Panel header cluster')).toBeVisible()
  })

  test('detected_labels that returns no labels should show empty state', async({page}) => {
    await page.route(/detected_labels/, (route) => route.fulfill({
      status: 200,
      body: '{}'
    }));
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await expect(page.getByTestId('Spinner')).not.toBeVisible()
    await expect(page.getByText('The labels are not available at this moment.')).toBeVisible()
  })

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

  test('should exclude a label, update filters, open log panel', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    await expect(page.getByTestId(testIds.exploreServiceDetails.searchLogs)).toBeVisible();
    // Adhoc err filter should be added
    await expect(page.getByTestId('data-testid Dashboard template variables submenu Label err')).toBeVisible();
    await expect(page.getByText(FilterOp.NotEqual)).toBeVisible();
  });


  test('should select a field, update filters, open log panel', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await page.getByTestId('data-testid Panel header err').getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    // Should see the logs panel full of errors
    await expect(page.getByTestId(testIds.exploreServiceDetails.searchLogs)).toBeVisible();
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
    await page.getByTestId('AdHocFilter-service_name').getByRole('img').nth(1).click();
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
