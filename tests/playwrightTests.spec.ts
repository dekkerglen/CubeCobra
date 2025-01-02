import { test } from '@playwright/test';

import { CubeListPage } from '../playwright_page_objects/CubeListPage';
import { soldierOfFortune } from './../playwright_data/cardData';
import { addRemoveCube, existingCubeData, newCubeData } from './../playwright_data/cubeData';
import { userData } from './../playwright_data/testUsers';
import { CubeOverviewPage } from './../playwright_page_objects/CubeOverviewPage';
import { DashboardPage } from './../playwright_page_objects/DashboardPage';
import { SearchPage } from './../playwright_page_objects/SearchPage';
import { TopNavigationPage } from './../playwright_page_objects/topNavigationPage';

test.skip('login and create a new cube from the navigation bar', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.userLogin({ userData });
  // Not working yet. Need a way to bypass captcha
  await topNavigationPage.clickCreateANewCube(newCubeData.title);
});

test('validate tool search cards', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.clickSearchCard();
  const searchPage = new SearchPage(page);
  // to do created a card object
  await searchPage.searchCard('Soldier of Fortune');
});

test('validate test cube from dashboard, click cube and validate overview page', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.userLogin({ userData });
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.validateTestCubeDisplays(
    existingCubeData.title,
    existingCubeData.cardCount,
    existingCubeData.followerCount,
  );
  await dashboardPage.clickCubeFromYourCube(
    existingCubeData.title,
    existingCubeData.cardCount,
    existingCubeData.followerCount,
  );
  const cubeOverviewPage = new CubeOverviewPage(page);
  await cubeOverviewPage.validateCubeDescription(existingCubeData.description);
  await page.pause();
});

test.only('add and remove card from cube, validate overview blog post', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.userLogin({ userData });
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.clickCubeFromYourCube(addRemoveCube.title, addRemoveCube.cardCount, addRemoveCube.followerCount);
  const cubeOverviewPage = new CubeOverviewPage(page);
  await cubeOverviewPage.clickList();
  const cubeListPage = new CubeListPage(page);
  await cubeListPage.addToCube(soldierOfFortune.name);
  await cubeListPage.clickCard(soldierOfFortune.name);
  await cubeListPage.removefromCube();
});
