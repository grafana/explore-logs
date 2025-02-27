import { ConsoleMessage, Locator, Page, TestInfo } from '@playwright/test';
import pluginJson from '../../src/plugin.json';
import { testIds } from '../../src/services/testIds';
import { expect } from '@grafana/plugin-e2e';

import { LokiQuery } from '../../src/services/lokiQuery';
import { FilterOp, FilterOpType } from '../../src/services/filterTypes';
import { isOperatorRegex } from '../../src/services/operatorHelpers';

export interface PlaywrightRequest {
  post: any;
  url: string;
}
export class ExplorePage {
  readonly firstServicePageSelect: Locator;
  logVolumeGraph: Locator;
  servicesSearch: Locator;
  serviceBreakdownSearch: Locator;
  serviceBreakdownOpenExplore: Locator;
  refreshPicker: Locator;
  logs: Array<{ msg: ConsoleMessage; type: string }> = [];

  constructor(public readonly page: Page, public readonly testInfo: TestInfo) {
    this.firstServicePageSelect = this.page.getByTestId(testIds.index.showLogsButton).first();
    this.logVolumeGraph = this.page.getByText('Log volume');
    this.servicesSearch = this.page.getByTestId(testIds.exploreServiceSearch.search);
    this.serviceBreakdownSearch = this.page.getByTestId(testIds.exploreServiceDetails.searchLogs);
    this.serviceBreakdownOpenExplore = this.page.getByTestId(testIds.exploreServiceDetails.openExplore);
    this.refreshPicker = this.page.getByTestId(testIds.header.refreshPicker);
  }

  getTableToggleLocator() {
    return this.page.getByLabel('Table', { exact: true });
  }

  getLogsToggleLocator() {
    return this.page.getByTestId(/data-testid Panel header Logs/).getByLabel('Logs', { exact: true });
  }

  getPanelContentLocator() {
    return this.page.getByTestId('data-testid panel content');
  }

  getLogsPanelLocator() {
    return this.page.getByTestId(/data-testid Panel header Logs/);
  }

  getLogsVolumePanelLocator() {
    return this.page.getByTestId(/data-testid Panel menu Logs/);
  }

  getLogsPanelContentLocator() {
    return this.getLogsPanelLocator().locator(this.getPanelContentLocator());
  }

  getLogsPanelRow(n = 0) {
    return this.getLogsPanelContentLocator().locator('tr').nth(0);
  }

  getWrapLocator() {
    return this.page.getByLabel('Wrap', { exact: true });
  }
  getNowrapLocator() {
    return this.page.getByLabel('No wrap', { exact: true });
  }

  getLogsDirectionNewestFirstLocator() {
    return this.page.getByLabel('Newest first', { exact: true });
  }

  getLogsDirectionOldestFirstLocator() {
    return this.page.getByLabel('Oldest first', { exact: true });
  }

  captureConsoleLogs() {
    this.page.on('console', (msg) => {
      this.logs.push({ msg, type: msg.type() });
    });
  }

  echoConsoleLogsOnRetry() {
    if (this.testInfo.retry > 0) {
      console.log('logs', this.logs);
    }
  }

  async aggregatedMetricsToggle() {
    const menuOpenBtn = this.page.getByTestId(testIds.index.aggregatedMetricsMenu);
    await expect(menuOpenBtn).toHaveCount(1);
    await menuOpenBtn.click();

    const aggregatedMetricsToggleBtn = this.page.getByLabel('Toggle aggregated metrics');
    await expect(aggregatedMetricsToggleBtn).toHaveCount(1);
    await aggregatedMetricsToggleBtn.click();
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => window.localStorage.clear());
  }

  async setDefaultViewportSize() {
    await this.page.setViewportSize({ width: 1280, height: 680 });
  }

  async setExtraTallViewportSize() {
    await this.page.setViewportSize({
      height: 3000,
      width: 1280,
    });
  }

  /**
   * Clears any custom routes created with page.route
   */
  async unroute() {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
  }

  async gotoServices() {
    await this.page.goto(`/a/${pluginJson.id}/explore`);
  }

  async addServiceName() {
    await this.firstServicePageSelect.click();
  }

  /**
   * Changes the datasource from gdev-loki to gdev-loki-copy
   */
  async changeDatasource(sourceUID = 'gdev-loki', targetUID = 'gdev-loki-copy') {
    await this.page
      .locator('div')
      .filter({ hasText: new RegExp(`^${sourceUID}$`) })
      .nth(1)
      .click();
    await this.page.getByText(targetUID).click();
  }

  async scrollToBottom() {
    const main = this.page.locator('html');

    // Scroll the page container to the bottom, smoothly
    await main.evaluate((main) => main.scrollTo({ left: 0, top: main.scrollHeight, behavior: 'smooth' }));
  }

  async goToLogsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabLogs).click();
    await this.assertNotLoading();
    await this.assertTabsNotLoading();
  }

  async goToFieldsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await this.assertNotLoading();
    await this.assertTabsNotLoading();
  }

  async goToLabelsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await this.assertNotLoading();
    await this.assertTabsNotLoading();
  }

  getAllPanelsLocator() {
    return this.page.getByTestId(/data-testid Panel header/).getByTestId('header-container');
  }

  async assertNotLoading() {
    const locator = this.page.getByText('loading');
    await expect(locator).toHaveCount(0);
  }

  async assertPanelsNotLoading() {
    await expect(this.page.getByLabel('Panel loading bar')).toHaveCount(0);
    await this.page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
  }

  async waitForRequest(
    init: () => Promise<any>,
    callback: (lokiQuery: LokiQuery) => void,
    test: (lokiQuery: LokiQuery) => boolean
  ) {
    await Promise.all([
      init(),
      this.page.waitForResponse(
        (resp) => {
          const post = resp.request().postDataJSON();
          const queries = post?.queries as LokiQuery[];
          if (queries && test(queries[0])) {
            callback(queries[0]);
            return true;
          }
          return false;
        },
        { timeout: 30000 }
      ),
    ]);
  }

  // This is flakey, panels won't show the state if the requests come back in < 75ms
  async assertPanelsLoading() {
    await expect(this.page.getByLabel('Panel loading bar').first()).toBeVisible();
  }

  async assertTabsNotLoading() {
    const tabSelectors = [
      this.page.getByTestId(testIds.exploreServiceDetails.tabLogs),
      this.page.getByTestId(testIds.exploreServiceDetails.tabPatterns),
      this.page.getByTestId(testIds.exploreServiceDetails.tabLabels),
      this.page.getByTestId(testIds.exploreServiceDetails.tabFields),
    ];
    for (let loc of tabSelectors) {
      const tabsLoadingSelector = loc.filter({ has: this.page.locator('svg') });

      //Assert we can see the tabs
      await expect(loc).toHaveCount(1);
      // Assert that the loading svg is not present
      await expect(tabsLoadingSelector).toHaveCount(0);
    }
  }

  async click(locator: Locator) {
    await expect(locator).toBeVisible();
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ force: true });
  }

  async scrollToTop() {
    const main = this.page.locator('main#pageContent');

    // Scroll the page container to the bottom
    await main.evaluate((main) => main.scrollTo(0, 0));
  }

  async assertFieldsIndex() {
    // Assert the fields tab is active
    expect(await this.page.getByTestId('data-testid tab-fields').getAttribute('aria-selected')).toEqual('true');
    // Assert the all option is selected
    await expect(this.page.getByText('FieldAll')).toHaveCount(1);
    await expect(this.page.getByText('FieldAll')).toBeVisible();
  }

  async gotoServicesBreakdownOldUrl(serviceName = 'tempo-distributor') {
    await this.page.goto(
      `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-filters=service_name|=|${serviceName}&var-logsFormat= | logfmt`
    );
  }

  async gotoServicesOldUrlLineFilters(
    serviceName = 'tempo-distributor',
    caseSensitive?: boolean,
    lineFilterValue = 'debug'
  ) {
    if (caseSensitive) {
      await this.page.goto(
        // case insensitive
        `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-lineFilter=%7C~%20%60%28%3Fi%29%60${lineFilterValue}%60&var-filters=service_name|=|${serviceName}&var-logsFormat= | logfmt`
      );
    } else {
      await this.page.goto(
        // case insensitive
        `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-lineFilter=%7C%3D%20%60${lineFilterValue}%60&var-filters=service_name|=|${serviceName}&var-logsFormat= | logfmt`
      );
    }
  }

  async gotoLogsPanel(
    sortOrder: 'Ascending' | 'Descending' = 'Descending',
    wrapLogMessage: 'true' | 'false' = 'false'
  ) {
    const url = `/a/grafana-lokiexplore-app/explore/service/tempo-distributor/logs?patterns=[]&from=now-5m&to=now&var-all-fields=&var-ds=gdev-loki&var-filters=service_name|=|tempo-distributor&var-fields=&var-levels=&var-metadata=&var-patterns=&var-lineFilter=&timezone=utc&urlColumns=["Time","Line"]&visualizationType="logs"&displayedFields=[]&sortOrder="${sortOrder}"&wrapLogMessage=${wrapLogMessage}&var-lineFilterV2=&var-lineFilters=`;
    await this.page.goto(url);
  }

  blockAllQueriesExcept(options: {
    refIds?: Array<string | RegExp>;
    legendFormats?: string[];
    responses?: Array<{ [refIDOrLegendFormat: string]: any }>;
    requests?: PlaywrightRequest[];
  }) {
    // Let's not wait for all these queries
    this.page.route('**/ds/query**', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];
      const refId = queries[0].refId;
      const legendFormat = queries[0].legendFormat;

      if (
        options?.refIds?.some((refIdToTarget) => refId.match(refIdToTarget)) ||
        (legendFormat && options?.legendFormats?.includes(legendFormat))
      ) {
        if (options.responses || options.requests) {
          const response = await route.fetch();
          const json = await response.json();
          if (options.responses) {
            options?.responses?.push({ [refId ?? legendFormat]: json });
          }

          if (options?.requests) {
            const request = route.request();
            const requestObject: PlaywrightRequest = {
              post: request.postDataJSON(),
              url: request.url(),
            };
            options?.requests?.push(requestObject);
          }

          await route.fulfill({ response, json });
        } else {
          await route.continue();
        }
      } else {
        await route.fulfill({ json: [] });
      }
    });
  }

  async addNthValueToCombobox(
    labelName: string,
    operator: FilterOpType,
    comboBox: ComboBoxIndex,
    n: number,
    typeAhead?: string
  ) {
    // Open combobox
    const comboboxLocator = this.page.getByPlaceholder('Filter by label values').nth(comboBox);
    await comboboxLocator.click();

    if (typeAhead) {
      await this.page.keyboard.type(typeAhead);
    }

    // Select detected_level key
    await this.page.getByRole('option', { name: labelName, exact: true }).click();
    await expect(this.getOperatorLocator(operator)).toHaveCount(1);
    await expect(this.getOperatorLocator(operator)).toBeVisible();
    // Select operator
    await this.getOperatorLocator(operator).click();

    // assert the values have loaded
    await expect(this.page.getByRole('option', { name: /\[compactor-.+]/ }).nth(0)).toBeVisible();

    // Select the nth item
    for (let i = 0; i < n; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
    // Select the item
    await this.page.keyboard.press('Enter');
    // Close the label name dropdown that opens after adding a value
    await this.page.keyboard.press('Escape');
  }

  /**
   *
   * @param labelName
   * @param operator
   * @param comboBox
   * @param text
   * @param typeAhead - if there are many options, the test can flake if the option isn't visible, if this string is passed in we'll type these chars to filter things down before attempting to click
   */
  async addCustomValueToCombobox(
    labelName: string,
    operator: FilterOpType,
    comboBox: ComboBoxIndex,
    text: string,
    typeAhead?: string
  ) {
    // Open combobox
    const comboboxLocator = this.page.getByPlaceholder('Filter by label values').nth(comboBox);
    await comboboxLocator.click();
    if (typeAhead) {
      await this.page.keyboard.type(typeAhead);
    }
    // Select detected_level key
    await this.page.getByRole('option', { name: labelName }).click();
    await expect(this.getOperatorLocator(operator)).toHaveCount(1);
    await expect(this.getOperatorLocator(operator)).toBeVisible();
    // Select operator
    await this.getOperatorLocator(operator).click();
    // Enter custom value
    await this.page.keyboard.type(text);
    if (isOperatorRegex(operator)) {
      // Custom value should be the first option for regex
      await this.page.keyboard.press('Enter');
    } else {
      // Custom value should be the last option for regex, arrow up to get to it
      await this.page.keyboard.press('ArrowUp');
    }

    // Select custom value
    await this.page.getByRole('option', { name: /Use custom value/ }).click();
    // Close the label name dropdown that opens after adding a value
    await this.page.keyboard.press('Escape');
  }

  getOperatorLocator(filter: FilterOpType): Locator {
    switch (filter) {
      case FilterOp.Equal:
        return this.page.getByRole('option', { name: E2EComboboxStrings.operatorNames.equal, exact: true });
      case FilterOp.NotEqual:
        return this.page.getByRole('option', { name: E2EComboboxStrings.operatorNames.notEqual, exact: true });
      case FilterOp.RegexEqual:
        return this.page.getByRole('option', { name: E2EComboboxStrings.operatorNames.regexEqual, exact: true });
      case FilterOp.RegexNotEqual:
        return this.page.getByRole('option', { name: E2EComboboxStrings.operatorNames.regexNotEqual, exact: true });
      default:
        throw new Error('invalid filter op');
    }
  }
}

export const E2EComboboxStrings = {
  editByKey: (keyName: string) => `Edit filter with key ${keyName}`,
  removeByKey: (keyName: string) => `Remove filter with key ${keyName}`,
  labels: {
    removeServiceLabel: 'Remove filter with key service_name',
  },
  operatorNames: {
    equal: '= Equals',
    notEqual: '!= Not equal',
    regexEqual: '=~ Matches regex',
    regexNotEqual: '!~ Does not match regex',
  },
};

export const levelTextMatch = /error|warn|info|debug/;

export enum ComboBoxIndex {
  labels,
  fields,
}

export const serviceSelectionPaginationTextMatch = /of \d+/;
