import type { Page, Locator } from '@playwright/test';
import pluginJson from '../../src/plugin.json';
import { ROUTES } from '../../src/utils/routing';
import { testIds } from '../../src/Components/testIds';

export class ExplorePage {
  private readonly firstServicePageSelect: Locator;
  logVolumeGraph: Locator;
  servicesSearch: Locator;
  serviceBreakdownSearch: Locator;
  serviceBreakdownOpenExplore: Locator;

  constructor(public readonly page: Page) {
    this.firstServicePageSelect = this.page.getByText('Select').first();
    this.logVolumeGraph = this.page.getByText('Log volume');
    this.servicesSearch = this.page.getByTestId(testIds.exploreService.search);
    this.serviceBreakdownSearch = this.page.getByTestId(testIds.exploreServiceBreakdown.search);
    this.serviceBreakdownOpenExplore = this.page.getByTestId(testIds.exploreServiceBreakdown.openExplore);
  }

  async gotoServices() {
    await this.page.goto(`/a/${pluginJson.id}/${ROUTES.Explore}`);
  }

  async addServiceName() {
    await this.firstServicePageSelect.click();
  }

  async gotoServicesBreakdown() {
    await this.page.goto(
      `/a/${pluginJson.id}/${ROUTES.Explore}?mode=logs&var-patterns=&var-filters=service_name%7C%3D%7Ctempo-distributor&actionView=logs&var-logsFormat=%20%7C%20logfmt`
    );
  }
}
