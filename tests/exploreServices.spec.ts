import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';
import {testIds} from "../src/services/testIds";

test.describe('explore services page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
    await page.evaluate(() => window.localStorage.clear());
    await explorePage.gotoServices();
  });

  test('should filter service labels on search', async ({ page }) => {
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('mimir');
    await expect(page.getByTestId('data-testid Panel header mimir-ingester')).toBeVisible();
    await expect(page.getByText('Showing 4 services')).toBeVisible();
  });

  test('should select a service label value and navigate to log view', async ({ page }) => {
    await explorePage.addServiceName();
    await expect(explorePage.logVolumeGraph).toBeVisible();
  });
});
