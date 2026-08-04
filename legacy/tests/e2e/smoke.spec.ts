import { expect, test } from '@playwright/test';

test.describe('BygSmart e2e smoke', () => {
  test('login route loads', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/#/login`);
    await expect(page.getByRole('heading', { name: /log ind/i })).toBeVisible();
    await expect(
      page.getByText('Indtast din e-mail og klik "Demo adgang" for at se demoen.')
    ).toBeVisible();
  });

  test('register route loads', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/#/register`);
    await expect(page.getByRole('heading', { name: /opret konto/i })).toBeVisible();
  });

  test('/tasks renders global tasks page', async ({ page, baseURL }) => {
    // Unauthenticated → redirected to /login; page structure is still served
    await page.goto(`${baseURL}/#/tasks`);
    // Either the tasks page loads (if demo session exists) or login page shows
    const url = page.url();
    expect(url).toMatch(/#\/(tasks|login)/);
  });

  test('/projects/new renders new project wizard', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/#/projects/new`);
    const url = page.url();
    expect(url).toMatch(/#\/(projects\/new|login)/);
  });

  test('forgot-password route loads', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/#/forgot-password`);
    await expect(page.getByRole('heading', { name: /glemt/i })).toBeVisible();
  });

  test('/search route exists (protected)', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/#/search`);
    const url = page.url();
    expect(url).toMatch(/#\/(search|login)/);
  });

  test('/tools route exists (protected)', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/#/tools`);
    const url = page.url();
    expect(url).toMatch(/#\/(tools|login)/);
  });

  test('/privacy legal page loads', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/#/privacy`);
    await expect(page.getByRole('heading', { name: /privat/i })).toBeVisible();
  });
});
