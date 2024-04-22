import pluginJson from '../src/plugin.json';
import { test, expect } from '@grafana/plugin-e2e';
import { ROUTES } from '../src/utils/routing';

test.describe('navigating app', () => {
  test('explore page should render successfully', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/${ROUTES.Explore}`);
    await expect(page.getByText('Data source')).toBeVisible();
  });
});
