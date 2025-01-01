import { test } from '@playwright/test';

import { newCubeData } from '../playwright_data/cubeData';
import { userData } from '../playwright_data/testUsers';
import { CubeOverviewPage } from '../playwright_page_objects/CubeOverviewPage';
import { DashboardPage } from '../playwright_page_objects/DashboardPage';
import { SearchPage } from '../playwright_page_objects/SearchPage';
import { TopNavigationPage } from '../playwright_page_objects/topNavigationPage';

test('login and create a new cube from the navigation bar', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.userLogin({ userData });
  await topNavigationPage.clickCreateANewCube(newCubeData.title);
});

test('validate tool search cards', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.clickSearchCard();
  const searchPage = new SearchPage(page);
  await searchPage.searchCard('Soldier of Fortune');
});

test('validate Test cube from dashboard', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.userLogin({ userData });
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.validateTestCubeDisplays(newCubeData.title, newCubeData.cardCount, newCubeData.followerCount);
  await dashboardPage.clickCubeFromYourCube(newCubeData.title, newCubeData.cardCount, newCubeData.followerCount);
  const cubeOverviewPage = new CubeOverviewPage(page);
  await cubeOverviewPage.validateCubeDescription(newCubeData.description);
});
