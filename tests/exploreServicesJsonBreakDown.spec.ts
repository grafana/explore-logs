import {expect, test} from "@grafana/plugin-e2e";
import {ExplorePage, PlaywrightRequest} from "./fixtures/explore";
import {LokiQuery} from "../src/services/query";

const fieldName = 'method'
const levelName = 'cluster'
test.describe('explore nginx-json breakdown pages ', () => {
    let explorePage: ExplorePage;

    test.beforeEach(async ({ page }) => {
        explorePage = new ExplorePage(page);
        await explorePage.setLimoViewportSize()
        await page.evaluate(() => window.localStorage.clear());
        await explorePage.gotoServicesBreakdown('nginx-json');
        await explorePage.blockAllQueriesExcept({
            refIds: ['logsPanelQuery', fieldName],
            legendFormats: [`{{${levelName}}}`]
        })
    });

    test.afterEach(async ({page}) => {
        await page.unrouteAll({ behavior: 'ignoreErrors' })
    })

    test(`should exclude ${fieldName}, request should contain json`, async ({ page }) => {
        let requests: PlaywrightRequest[] = [];
        await explorePage.blockAllQueriesExcept({
            refIds: [fieldName],
            requests
        })
        await explorePage.goToFieldsTab()
        await page.getByTestId(`data-testid Panel header ${fieldName}`).getByRole('button', { name: 'Select' }).click();
        await explorePage.assertNotLoading()
        await page.getByRole('button', { name: 'Exclude' }).nth(0).click();

        await explorePage.assertTabsNotLoading()
        // Adhoc content filter should be added
        await expect(page.getByTestId(`data-testid Dashboard template variables submenu Label ${fieldName}`)).toBeVisible();
        await expect(page.getByText('!=')).toBeVisible();

        requests.forEach(req => {
            const post = req.post;
            const queries: Array<LokiQuery> = post.queries
            queries.forEach(query => {
                expect(query.expr).toContain(`| json | drop __error__, __error_details__ | ${fieldName}!=""`)
            })
        })
        expect(requests).toHaveLength(2)
    });
})
