import { test } from '@playwright/test';

import { DashboardPage } from './../playwright_page_objects/DashboardPage';
import { TopNavigationPage } from './../playwright_page_objects/topNavigationPage';


test('login and create a new cube from the navigation bar', async ({ page }) => {
  await page.goto('/')
  const topNavigationPage = new TopNavigationPage(page)
  await topNavigationPage.userLogin();
  await topNavigationPage.createNewCube();

})

test('login and create a new cube from the dashoard page', async ({ page }) => {
  await page.goto('/')
  const topNavigationPage = new TopNavigationPage(page)
  await topNavigationPage.userLogin()
  const dashboardPage = new DashboardPage(page)
  dashboardPage.createCube()

})

test.only('validate card search', async ({ page }) => {
  await page.goto('/')
  const topNavigationPage = new TopNavigationPage(page)
  await topNavigationPage.searchCardDropDownLink()

})
