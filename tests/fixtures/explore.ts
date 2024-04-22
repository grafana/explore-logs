import type { Page, Locator } from '@playwright/test';
import pluginJson from '../../src/plugin.json';
import { ROUTES } from '../../src/utils/routing';

export class ExplorePage {
  private readonly firstServicePageSelect: Locator;
  private readonly logVolumeGraph: Locator;

  constructor(public readonly page: Page) {
    this.firstServicePageSelect = this.page.getByText('Select').first();
    this.logVolumeGraph = this.page.getByText('Log volume');
  }

  async goto() {
    await this.page.goto(`/a/${pluginJson.id}/${ROUTES.Explore}`);
  }

  async addServiceName() {
    await this.firstServicePageSelect.click();
  }
}
