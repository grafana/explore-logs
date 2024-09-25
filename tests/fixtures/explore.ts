import { ConsoleMessage, Locator, Page } from '@playwright/test';
import pluginJson from '../../src/plugin.json';
import { testIds } from '../../src/services/testIds';
import { expect } from '@grafana/plugin-e2e';
import { LokiQuery } from '../../src/services/query';

export interface PlaywrightRequest {
  post: any;
  url: string;
}
export class ExplorePage {
  private readonly firstServicePageSelect: Locator;
  logVolumeGraph: Locator;
  servicesSearch: Locator;
  serviceBreakdownSearch: Locator;
  serviceBreakdownOpenExplore: Locator;
  refreshPicker: Locator;
  logs: Array<{ msg: ConsoleMessage; type: string }> = [];

  constructor(public readonly page: Page) {
    this.firstServicePageSelect = this.page.getByText('Select').first();
    this.logVolumeGraph = this.page.getByText('Log volume');
    this.servicesSearch = this.page.getByTestId(testIds.exploreServiceSearch.search);
    this.serviceBreakdownSearch = this.page.getByTestId(testIds.exploreServiceDetails.searchLogs);
    this.serviceBreakdownOpenExplore = this.page.getByTestId(testIds.exploreServiceDetails.openExplore);
    this.refreshPicker = this.page.getByTestId(testIds.header.refreshPicker);
  }

  captureConsoleLogs() {
    this.page.on('console', (msg) => {
      this.logs.push({ msg, type: msg.type() });
    });
  }

  echoConsoleLogs() {
    console.log('logs', this.logs);
  }

  /**
   * Don't know how accurate or helpful these are yet, but figured it won't hurt to log the results for now as we continue to iterate on performance measurement
   */
  async measurePerformanceStart() {
    await this.page.evaluate(() => {
      window.performance.mark('start');
    });
  }

  async measurePerformanceStop() {
    const resourceUsage = await this.page.evaluate(() => {
      return {
        cpuUsage: window.performance.now(), // Example CPU usage metric
        //@ts-expect-error
        usedJSHeapSize: window.performance?.memory?.usedJSHeapSize,
        //@ts-expect-error
        totalJSHeapSize: window.performance?.memory?.totalJSHeapSize,
      };
    });

    console.log('Resource usage:', resourceUsage);
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => window.localStorage.clear());
  }

  async setDefaultViewportSize() {
    await this.page.setViewportSize({ width: 1280, height: 720 });
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

  async scrollToBottom() {
    const main = this.page.locator('main#pageContent');

    // Scroll the page container to the bottom
    await main.evaluate((main) => main.scrollTo(0, main.scrollHeight));
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

  //@todo pull service from url if not in params
  async gotoServicesBreakdown(serviceName = 'tempo-distributor') {
    await this.page.goto(
      `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-filters=service_name|=|${serviceName}&var-logsFormat= | logfmt`
    );
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
}
