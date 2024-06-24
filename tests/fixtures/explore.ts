import type { Page, Locator } from '@playwright/test';
import pluginJson from '../../src/plugin.json';
import { SLUGS } from '../../src/services/routing';
import { testIds } from '../../src/services/testIds';

export class ExplorePage {
  private readonly firstServicePageSelect: Locator;
  logVolumeGraph: Locator;
  servicesSearch: Locator;
  serviceBreakdownSearch: Locator;
  serviceBreakdownOpenExplore: Locator;

  constructor(public readonly page: Page) {
    this.firstServicePageSelect = this.page.getByText('Select').first();
    this.logVolumeGraph = this.page.getByText('Log volume');
    this.servicesSearch = this.page.getByTestId(testIds.exploreServiceSearch.search);
    this.serviceBreakdownSearch = this.page.getByTestId(testIds.exploreServiceDetails.searchLogs);
    this.serviceBreakdownOpenExplore = this.page.getByTestId(testIds.exploreServiceDetails.openExplore);
  }

  async gotoServices() {
    await this.page.goto(`/a/${pluginJson.id}/${SLUGS.explore}`);
  }

  async addServiceName() {
    await this.firstServicePageSelect.click();
  }

  async gotoServicesBreakdown() {
    await this.page.goto(
      `/a/${pluginJson.id}/${SLUGS.explore}?mode=service_details&var-patterns=&var-filters=service_name%7C%3D%7Ctempo-distributor&actionView=logs&var-logsFormat=%20%7C%20logfmt`
    );
  }
}
