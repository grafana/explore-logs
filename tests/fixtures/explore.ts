import type { Page, Locator } from '@playwright/test';
import pluginJson from '../../src/plugin.json';
import { testIds } from '../../src/services/testIds';
import {expect} from "@grafana/plugin-e2e";
import {LokiQuery} from "../../src/services/query";

export class ExplorePage {
  private readonly firstServicePageSelect: Locator;
  logVolumeGraph: Locator;
  servicesSearch: Locator;
  serviceBreakdownSearch: Locator;
  serviceBreakdownOpenExplore: Locator;
  refreshPicker: Locator;

  constructor(public readonly page: Page) {
    this.firstServicePageSelect = this.page.getByText('Select').first();
    this.logVolumeGraph = this.page.getByText('Log volume');
    this.servicesSearch = this.page.getByTestId(testIds.exploreServiceSearch.search);
    this.serviceBreakdownSearch = this.page.getByTestId(testIds.exploreServiceDetails.searchLogs);
    this.serviceBreakdownOpenExplore = this.page.getByTestId(testIds.exploreServiceDetails.openExplore);
    this.refreshPicker = this.page.getByTestId(testIds.header.refreshPicker)
  }

  async setDefaultViewportSize(){
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  async setLimoViewportSize(){
    await this.page.setViewportSize({
      height: 4000,
      width: 1280
    })
  }

  async gotoServices() {
    await this.page.goto(`/a/${pluginJson.id}/explore`);
  }

  async addServiceName() {
    await this.firstServicePageSelect.click();
  }

  async scrollToBottom() {
    const main = this.page.locator('main#pageContent')

    // Scroll the page container to the bottom
    await main.evaluate((main) => main.scrollTo(0, main.scrollHeight));
  }

  async goToFieldsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await this.assertNotLoading()
  }

  async toToLabelsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await this.assertNotLoading()
  }


  async assertNotLoading() {
    const locator = this.page.getByText('loading')
    await expect(locator).toHaveCount(0)
  }

  async click(locator: Locator) {
    await expect(locator).toBeVisible()
    await locator.scrollIntoViewIfNeeded()
    await locator.click({force: true})
  }

  async scrollToTop() {
    const main = this.page.locator('main#pageContent')

    // Scroll the page container to the bottom
    await main.evaluate((main) => main.scrollTo(0, 0));
  }

  async assertFieldsIndex() {
    // Assert the fields tab is active
    expect(await this.page.getByTestId('data-testid tab-fields').getAttribute('aria-selected')).toEqual('true')
    // Assert the all option is selected
    await expect(this.page.getByText('FieldAll')).toBeVisible()
  }

  //@todo pull service from url if not in params
  async gotoServicesBreakdown() {
    await this.page.goto(
      `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-filters=service_name|=|tempo-distributor&var-logsFormat= | logfmt`
    );
  }


  async blockAllQueriesExcept(options: {
    refIds?: string[],
    legendFormats?: string[]
  }) {
    // Let's not wait for all these queries
    await this.page.route('**/ds/query*', async route => {
      const post = route.request().postDataJSON()
      const queries = post.queries as LokiQuery[]
      const refId = queries[0].refId
      const legendFormat = queries[0].legendFormat;

      // if(refId === 'logsPanelQuery' || refId === fieldName || legendFormat === `{{${levelName}}}`){
      if(options?.refIds.includes(refId) || options?.legendFormats.includes(legendFormat)){
        await route.continue()
      }else{
        await route.fulfill({json: []})
      }
    })
  }
}
