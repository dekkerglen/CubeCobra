import { test } from '@playwright/test';

import { soldierOfFortune } from '../playwrightData/cardData';
import { addRemoveCube, existingCubeData, newCubeData } from '../playwrightData/cubeData';
import { userData } from '../playwrightData/testUsers';
import { CubeListPage } from '../playwrightPageObjects/CubeListPage';
import { CubeOverviewPage } from '../playwrightPageObjects/CubeOverviewPage';
import { DashboardPage } from '../playwrightPageObjects/DashboardPage';
import { SearchPage } from '../playwrightPageObjects/SearchPage';
import { TopNavigationPage } from '../playwrightPageObjects/topNavigationPage';

test.skip('should login and create a new cube from the navigation bar', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.userLogin({ userData });
  // Not working yet. Need a way to bypass captcha
  await topNavigationPage.clickCreateANewCube(newCubeData.title);
});

test('should successuflly use the card search page', async ({ page }) => {
  await page.goto('/');
  const topNavigationPage = new TopNavigationPage(page);
  await topNavigationPage.clickSearchCard();
  const searchPage = new SearchPage(page);
  // to do created a card object
  await searchPage.searchCard('Soldier of Fortune');
});

test('should open cube from Your Cube dashboard section, then click and validate cube overview and description', async ({
  page,
}) => {
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
});

test('should add and remove card from cube then validate change log blog post', async ({ page }) => {
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
  await cubeListPage.clickOverview();
  await cubeOverviewPage.validateChangeLog();
  await page.pause();
});
