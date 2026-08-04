import { expect, Page, test } from '@playwright/test';

const runFullE2E = process.env.E2E_FULL === '1';
const loginIdentifier = process.env.E2E_LOGIN_IDENTIFIER;
const loginPassword = process.env.E2E_PASSWORD;

const getBaseUrl = (baseURL: string | undefined): string => baseURL || 'http://127.0.0.1:4174';

const stubExternalApiDependencies = async (page: Page, baseURL: string): Promise<void> => {
  await page.route('**/api/gemini', async (route) => {
    const body = route.request().postData() || '';
    const isProjectPlanRequest =
      /Lav en projektplan|shoppingList|projectplan|projektplan/i.test(body);

    const text = isProjectPlanRequest
      ? JSON.stringify({
          tasks: [
            {
              title: 'E2E plan-opgave',
              description: 'Automatisk e2e plan-opgave',
              estimatedHours: 2,
            },
          ],
          shoppingList: [
            {
              name: 'E2E materialer',
              quantity: 1,
              details: 'Automatisk e2e post',
            },
          ],
        })
      : 'E2E stub response';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text }),
    });
  });

  await page.route('**/api/create-checkout-session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: `${baseURL}/#/settings?billing=success` }),
    });
  });

  await page.route('**/api/delete-account', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Kontoen er slettet permanent.' }),
    });
  });
};

const loginViaUi = async (page: Page, baseURL: string): Promise<void> => {
  await page.goto(`${baseURL}/#/login`);
  await page.getByLabel(/E-mail eller brugernavn/i).fill(loginIdentifier || '');
  await page.getByLabel(/Adgangskode/i).fill(loginPassword || '');
  await Promise.all([
    page.waitForURL(/#\/home/, { timeout: 30_000 }),
    page.getByRole('button', { name: /^Log ind$/i }).click(),
  ]);
};

test.describe('BygSmart full business flows', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!runFullE2E, 'Set E2E_FULL=1 to run full end-to-end business flows.');

  test('auth + project + task lifecycle', async ({ page, baseURL }) => {
    test.skip(
      !loginIdentifier || !loginPassword,
      'Set E2E_LOGIN_IDENTIFIER and E2E_PASSWORD for full auth/project/task flow.'
    );

    const appBaseUrl = getBaseUrl(baseURL);
    const projectName = `E2E Projekt ${Date.now()}`;
    const initialTaskName = `E2E Opgave ${Date.now()}`;
    const updatedTaskName = `${initialTaskName} Opdateret`;

    await stubExternalApiDependencies(page, appBaseUrl);
    await loginViaUi(page, appBaseUrl);

    await page.goto(`${appBaseUrl}/#/projects`);
    await page.locator('button.fixed.bottom-24.right-4').click();

    await expect(page.getByRole('heading', { name: /Opret Nyt Projekt/i })).toBeVisible();
    await page.getByLabel(/Projekttitel/i).fill(projectName);
    await page
      .getByLabel(/^Beskrivelse$/i)
      .fill('E2E projekt-oprettelse for kritisk business flow.');

    await page.getByRole('button', { name: /Gener.*Plan/i }).click();
    await expect(page.getByRole('button', { name: /Opret Projekt|Opretter/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: /Opret Projekt|Opretter/i }).click();
    await page.waitForURL(/#\/project-detail\/.+/, { timeout: 30_000 });

    await page.getByRole('button', { name: /^Opgaver$/i }).click();
    await page.locator('button.fixed.bottom-28.right-4').click();

    await page.getByLabel(/^Titel$/i).fill(initialTaskName);
    await page
      .getByLabel(/^Beskrivelse$/i)
      .fill('E2E beskrivelse for opgavens livscyklus.');
    await page.getByRole('button', { name: /^Opret$/i }).click();

    const createdTaskTitle = page.getByText(initialTaskName, { exact: true });
    await expect(createdTaskTitle).toBeVisible();

    await createdTaskTitle.click();
    await page.getByLabel(/^Titel$/i).fill(updatedTaskName);
    await page.getByRole('button', { name: /^Gem$/i }).click();

    const updatedTaskTitle = page.getByText(updatedTaskName, { exact: true });
    await expect(updatedTaskTitle).toBeVisible();

    await updatedTaskTitle.click();
    await page.getByRole('button', { name: /^Slet$/i }).click();

    await expect(page.getByText(updatedTaskName, { exact: true })).toHaveCount(0);
  });

  test('subscription + account deletion lifecycle', async ({ page, baseURL }) => {
    test.skip(
      !loginIdentifier || !loginPassword,
      'Set E2E_LOGIN_IDENTIFIER and E2E_PASSWORD for full subscription/account flow.'
    );

    const appBaseUrl = getBaseUrl(baseURL);
    await stubExternalApiDependencies(page, appBaseUrl);
    await loginViaUi(page, appBaseUrl);

    await page.goto(`${appBaseUrl}/#/settings`);
    await page.getByTestId('settings-subscription-button').click();

    await expect(page.getByRole('heading', { name: /PRO/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /PREMIUM/i })).toBeVisible();

    await page.getByRole('heading', { name: /PREMIUM/i }).click();
    let redirected = await page
      .waitForURL(/#\/settings\?billing=success/, { timeout: 6_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      await page.getByRole('heading', { name: /PRO/i }).click();
      redirected = await page
        .waitForURL(/#\/settings\?billing=success/, { timeout: 6_000 })
        .then(() => true)
        .catch(() => false);
    }

    expect(redirected).toBeTruthy();

    await page.getByTestId('settings-delete-account-open-button').click();
    await page.getByTestId('settings-delete-account-input').fill('SLET');
    await page.getByTestId('settings-delete-account-confirm-button').click();

    await page.waitForURL(/#\/welcome/, { timeout: 20_000 });
    await expect(page.getByText(/BYG SMART/i)).toBeVisible();
  });
});
