import { test, expect } from '@grafana/plugin-e2e';
import { ExplorePage } from './fixtures/explore';

test.describe('explore page', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    explorePage = new ExplorePage(page);
    await explorePage.goto();
  });

  test('should select a service label value and navigate to log view', async ({ page }) => {
    await explorePage.addServiceName();
    await expect(page.getByText('Log volume')).toBeVisible();
  });
});
